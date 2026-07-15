"""
payments/views.py
~~~~~~~~~~~~~~~~~
Handles enrollments, lesson progress, checkout (Stripe & PayPal), webhooks,
payment listing, and refunds.

This module is intentionally thin: it deals with requests, permissions,
validation, and responses only. All business logic (state transitions,
notifications, gateway calls, webhook processing, refunds) lives in
services.py, notification_service.py, webhook_service.py, refund_service.py,
stripe_client.py, and paypal_client.py.
"""

import json
import logging

import stripe
from django.conf import settings
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from courses.models import Course

from .models import Enrollment, Payment
from progress.models import LessonProgress
from certificates.models import Certificate
from . import paypal_client
from . import refund_service
from . import services
from . import stripe_client
from . import webhook_service
from .serializers import (
    EnrollmentSerializer,
    PaymentSerializer,
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# Enrollment ViewSet
# ══════════════════════════════════════════════════════════════════════════════

class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for student course enrollments.
    Free courses enroll directly; paid courses must go through CheckoutViewSet.
    """

    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Enrollment.objects.all().select_related('student', 'course', 'course__mentor')
        if user.is_staff or user.role == 'ADMIN':
            return queryset
        if user.role == 'MENTOR':
            return queryset.filter(course__mentor=user, course__is_deleted=False)
        return queryset.filter(student=user, course__is_deleted=False)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'STUDENT':
            raise PermissionDenied("Only students can enroll in courses.")

        course_id = self.request.data.get('course')
        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            raise ValidationError({"course": "Invalid course ID."})

        if not (course.is_approved and course.is_published):
            raise PermissionDenied("This course is not currently available for enrollment.")

        if Enrollment.objects.filter(student=user, course=course, course__is_deleted=False).exists():
            raise ValidationError({"detail": "You are already enrolled in this course."})

        if float(course.price) > 0:
            raise ValidationError(
                {"detail": "Payment is required for this paid course. Please complete checkout."}
            )

        enrollment = services.create_free_enrollment(user, course)
        serializer.instance = enrollment

    @action(detail=False, methods=['get'])
    def check(self, request):
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response(
                {"detail": "course_id parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            course_id = int(course_id)
        except ValueError:
            return Response(
                {"detail": "course_id must be a valid integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if user.is_staff or user.role == 'ADMIN':
            return Response({
                "enrolled": True,
                "is_active": True,
                "progress_percent": 100,
                "completed_lessons": [],
                "certificate_url": None,
            })

        if user.role == 'MENTOR':
            from courses.models import Course as CourseModel
            try:
                CourseModel.objects.get(pk=course_id, mentor=user)
                return Response({
                    "enrolled": True,
                    "is_active": True,
                    "progress_percent": 100,
                    "completed_lessons": [],
                    "certificate_url": None,
                })
            except CourseModel.DoesNotExist:
                pass

        try:
            enrollment = Enrollment.objects.get(student=user, course_id=course_id,course__is_deleted=False)

            completed_lesson_ids = list(
                LessonProgress.objects.filter(
                    student=user,
                    lesson__module__course_id=course_id,
                    is_completed=True,
                ).values_list('lesson_id', flat=True)
            )

            certificate_url = None
            try:
                cert = enrollment.certificate
                if cert and cert.pdf_file:
                    certificate_url = request.build_absolute_uri(cert.pdf_file.url)
            except Certificate.DoesNotExist:
                pass

            return Response({
                "enrolled": True,
                "is_active": enrollment.is_active,
                "progress_percent": enrollment.progress_percent,
                "completed_lessons": completed_lesson_ids,
                "certificate_url": certificate_url,
            })

        except Enrollment.DoesNotExist:
            return Response({
                "enrolled": False,
                "is_active": False,
                "progress_percent": 0.00,
                "completed_lessons": [],
                "certificate_url": None,
            })


# ══════════════════════════════════════════════════════════════════════════════
# Checkout ViewSet
# ══════════════════════════════════════════════════════════════════════════════

class CheckoutViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    # ── create-session ────────────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='create-session')
    def create_session(self, request):
        user = request.user
        if user.role != 'STUDENT':
            raise PermissionDenied("Only students can purchase courses.")

        course_id = request.data.get('course_id')
        gateway   = request.data.get('gateway', '').upper()

        if not course_id or not gateway:
            return Response(
                {"detail": "course_id and gateway are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if gateway not in ('STRIPE', 'PAYPAL'):
            return Response(
                {"detail": "Invalid gateway. Choose STRIPE or PAYPAL."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

        if not (course.is_approved and course.is_published):
            return Response(
                {"detail": "This course is not available for purchase."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if float(course.price) <= 0:
            return Response(
                {"detail": "This is a free course. Use the enrollment endpoint directly."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment, err = services.get_or_create_pending_enrollment(user, course)
        if err:
            return err

        # ── Stripe ──────────────────────────────────────────────────────
        if gateway == 'STRIPE':
            try:
                session = stripe_client.create_checkout_session(course, user, enrollment)
                transaction_id = session.id
                checkout_url   = session.url
            except stripe.error.StripeError as exc:
                logger.error("[Stripe] Session creation failed: %s", exc)
                return Response(
                    {"detail": f"Stripe session creation failed: {exc.user_message}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        # ── PayPal ──────────────────────────────────────────────────────
        else:
            try:
                order_data   = paypal_client.create_order(course, enrollment)
                transaction_id = order_data['id']
                checkout_url   = paypal_client.get_approve_url(order_data)
            except RuntimeError as exc:
                logger.error("[PayPal] Order creation failed: %s", exc)
                return Response(
                    {"detail": f"PayPal order creation failed: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        # ── Create or reuse a PENDING payment row ──────────────────────
        # Enrollment is unique per (student, course), so it gets reused
        # across a refund → re-purchase cycle. We must NOT key this off
        # `enrollment` alone via update_or_create, or a repeat purchase
        # after a refund silently overwrites the original (refunded)
        # Payment row instead of creating a fresh sales record.
        pending_payment = Payment.objects.filter(
            enrollment=enrollment,
            status=Payment.StatusChoices.PENDING,
        ).first()

        if pending_payment:
            pending_payment.student = user
            pending_payment.gateway = gateway
            pending_payment.transaction_id = transaction_id
            pending_payment.amount = course.price
            pending_payment.save(update_fields=['student', 'gateway', 'transaction_id', 'amount'])
        else:
            Payment.objects.create(
                enrollment=enrollment,
                student=user,
                gateway=gateway,
                transaction_id=transaction_id,
                amount=course.price,
                status=Payment.StatusChoices.PENDING,
            )

        return Response(
            {"checkout_url": checkout_url, "transaction_id": transaction_id},
            status=status.HTTP_201_CREATED,
        )

    # ── verify ────────────────────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='verify')
    def verify_payment(self, request):
        gateway   = (request.data.get('gateway') or '').lower()
        course_id = request.data.get('course_id')

        if not gateway or not course_id:
            return Response(
                {"detail": "gateway and course_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

        # ── Stripe verify ────────────────────────────────────────────────
        if gateway == 'stripe':
            session_id = request.data.get('session_id')
            if not session_id:
                return Response(
                    {"detail": "session_id is required for Stripe verification."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                payment = Payment.objects.get(
                    transaction_id=session_id, enrollment__course_id=course_id
                )
            except Payment.DoesNotExist:
                return Response(
                    {"detail": "Payment record not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if payment.student != request.user:
                return Response(
                    {"detail": "This payment does not belong to your account."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if payment.status == Payment.StatusChoices.COMPLETED:
                return Response({"verified": True, "detail": "Payment already verified."})

            try:
                session = stripe_client.retrieve_session(session_id)
            except stripe.error.StripeError as exc:
                logger.error("[Stripe] Session retrieve failed: %s", exc)
                return Response(
                    {"detail": f"Stripe verification failed: {exc.user_message}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            if session.payment_status == 'paid':
                services.activate_enrollment(payment)
                return Response({"verified": True, "detail": "Stripe payment verified."})

            return Response({
                "verified": False,
                "detail": f"Stripe payment status is '{session.payment_status}'.",
            })

        # ── PayPal verify ────────────────────────────────────────────────
        elif gateway == 'paypal':
            order_id = request.data.get('order_id')
            if not order_id:
                return Response(
                    {"detail": "order_id is required for PayPal verification."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                payment = Payment.objects.get(
                    transaction_id=order_id, enrollment__course_id=course_id
                )
            except Payment.DoesNotExist:
                return Response(
                    {"detail": "Payment record not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if payment.student != request.user:
                return Response(
                    {"detail": "This payment does not belong to your account."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if payment.status == Payment.StatusChoices.COMPLETED:
                return Response({"verified": True, "detail": "Payment already verified."})

            try:
                cap_data = paypal_client.capture_order(order_id)
                if cap_data.get('status') == 'COMPLETED':
                    services.activate_enrollment(payment)
                    return Response({"verified": True, "detail": "PayPal payment captured and verified."})

                return Response({
                    "verified": False,
                    "detail": f"PayPal capture status: {cap_data.get('status')}.",
                })

            except RuntimeError as exc:
                if 'ORDER_ALREADY_CAPTURED' in str(exc):
                    if payment.status != Payment.StatusChoices.COMPLETED:
                        services.activate_enrollment(payment)
                    return Response({"verified": True, "detail": "PayPal payment already captured."})

                logger.error("[PayPal] Capture failed: %s", exc)
                return Response(
                    {"detail": f"PayPal capture failed: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response({"detail": "Invalid gateway."}, status=status.HTTP_400_BAD_REQUEST)

    # ── Stripe Webhook ────────────────────────────────────────────────────

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[permissions.AllowAny],
        url_path='stripe-webhook',
    )
    def stripe_webhook(self, request):
        payload    = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        try:
            event = stripe_client.construct_webhook_event(payload, sig_header)
        except ValueError:
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError:
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

        webhook_service.handle_stripe_event(event)

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

    # ── PayPal Webhook ────────────────────────────────────────────────────

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[permissions.AllowAny],
        url_path='paypal-webhook',
    )
    def paypal_webhook(self, request):
        try:
            event_data = json.loads(request.body.decode('utf-8'))
        except ValueError:
            return Response({"detail": "Invalid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        webhook_service.handle_paypal_event(event_data)

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# Payment ViewSet  (list + refund)
# ══════════════════════════════════════════════════════════════════════════════

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.all().select_related('student', 'enrollment__course')
        if user.is_staff or user.role == 'ADMIN':
            return queryset.order_by('-created_at')
        if user.role == 'MENTOR':
            return queryset.filter(
                enrollment__course__mentor=user
            ).order_by('-created_at')
        return queryset.filter(student=user).order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='refund')
    def refund(self, request, pk=None):
        payment = self.get_object()
        user    = request.user

        is_admin  = user.is_staff or user.role == 'ADMIN'
        is_mentor = user.role == 'MENTOR' and payment.enrollment.course.mentor == user

        if not (is_admin or is_mentor):
            raise PermissionDenied("You do not have permission to refund this payment.")

        if payment.status != Payment.StatusChoices.COMPLETED:
            return Response(
                {"detail": "Only completed payments can be refunded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refund_service.process_refund(payment, refunded_by=user)
        except refund_service.RefundError as exc:
            return Response({"detail": exc.detail}, status=exc.status_code)

        return Response({
            "detail": "Payment refunded and student enrollment revoked.",
            "status": "REFUNDED",
        }, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard Stats View
# ══════════════════════════════════════════════════════════════════════════════

from rest_framework.views import APIView
from . import dashboard_service


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == 'MENTOR':
            data = dashboard_service.get_mentor_dashboard(user)
        elif user.role == 'ADMIN':
            data = dashboard_service.get_admin_dashboard()
        else:
            data = dashboard_service.get_student_dashboard(user, request)

        return Response(data)