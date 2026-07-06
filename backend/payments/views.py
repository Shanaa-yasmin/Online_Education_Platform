"""
payments/views.py
~~~~~~~~~~~~~~~~~
Handles enrollments, lesson progress, checkout (Stripe & PayPal), webhooks,
payment listing, and refunds.
"""

import json
import logging

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from courses.models import Course, Lesson
from notifications.models import Notification

from .models import Enrollment, Payment
from progress.models import LessonProgress
from certificates.models import Certificate
from .paypal_client import (
    capture_order as pp_capture_order,
    create_order as pp_create_order,
    get_approve_url as pp_get_approve_url,
    get_capture_id as pp_get_capture_id,
    refund_capture as pp_refund_capture,
)
from .serializers import (
    EnrollmentSerializer,
    PaymentSerializer,
)

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

User = get_user_model()


def _stripe_attr(obj, key, default=None):
    """
    Safely read a field from a Stripe object across SDK versions.
    Newer stripe-python releases raise AttributeError on .get(), since
    StripeObject routes unknown attributes through __getitem__ instead
    of behaving like a plain dict.
    """
    try:
        return obj[key]
    except (KeyError, TypeError):
        return getattr(obj, key, default)


def _notify_admins(title, message, sender=None, notification_type=Notification.NotificationType.SYSTEM,
                    related_object_id=None, related_object_type=None):
    """Send a notification to every admin/staff user."""
    admins = User.objects.filter(is_staff=True) | User.objects.filter(role='ADMIN')
    admins = admins.distinct()
    for admin in admins:
        Notification.objects.create(
            recipient=admin,
            sender=sender,
            title=title,
            message=message,
            notification_type=notification_type,
            related_object_id=related_object_id,
            related_object_type=related_object_type,
        )


# ══════════════════════════════════════════════════════════════════════════════
# Shared enrollment / payment state-transition helpers
# ══════════════════════════════════════════════════════════════════════════════
# These live at module level (not inside a ViewSet) because both
# CheckoutViewSet (webhooks, verify) and PaymentViewSet (manual refund)
# need to trigger the exact same state changes + notifications. Defining
# them as a method on one ViewSet and calling `self._method` from another
# class fails with AttributeError — that was the previous bug.

def _activate_enrollment(payment: Payment) -> None:
    """Mark payment COMPLETED and activate the associated enrollment.
    Notifies the student, the course mentor, and all admins."""
    payment.status = Payment.StatusChoices.COMPLETED
    payment.save(update_fields=['status'])

    enrollment = payment.enrollment
    enrollment.is_active = True
    enrollment.save(update_fields=['is_active'])

    course = enrollment.course
    student = enrollment.student

    Notification.objects.create(
        recipient=student,
        sender=course.mentor,
        title="Payment Successful",
        message=f"Your payment for '{course.title}' was successful. You're enrolled!",
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )

    Notification.objects.create(
        recipient=course.mentor,
        sender=student,
        title="New Course Sale",
        message=f"{student.username} just purchased '{course.title}' for ${payment.amount}.",
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )

    _notify_admins(
        title="New Course Sale",
        message=f"{student.username} purchased '{course.title}' (mentor: {course.mentor.username}) for ${payment.amount}.",
        sender=student,
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )

    logger.info(
        "[Payment] Enrollment %s activated via %s (%s).",
        enrollment.id, payment.gateway, payment.transaction_id,
    )


def _mark_refunded(payment: Payment, refunded_by=None) -> None:
    """
    Mark a payment REFUNDED, revoke enrollment, and notify the student,
    the course mentor, and all admins. Used by manual refund, Stripe
    webhook, and PayPal webhook paths so behaviour stays consistent
    everywhere.
    """
    if payment.status == Payment.StatusChoices.REFUNDED:
        return  # already processed — avoid duplicate notifications

    payment.status = Payment.StatusChoices.REFUNDED
    payment.refunded_at = timezone.now()
    payment.save(update_fields=['status', 'refunded_at'])

    enrollment = payment.enrollment
    enrollment.is_active = False
    enrollment.save(update_fields=['is_active'])

    course = enrollment.course
    student = enrollment.student

    Notification.objects.create(
        recipient=student,
        sender=refunded_by or course.mentor,
        title="Refund Processed",
        message=f"Your payment for '{course.title}' has been refunded. Access has been revoked.",
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )

    Notification.objects.create(
        recipient=course.mentor,
        sender=refunded_by,
        title="Course Sale Refunded",
        message=f"A payment from {student.username} for '{course.title}' was refunded (${payment.amount}).",
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )

    _notify_admins(
        title="Course Sale Refunded",
        message=f"Payment from {student.username} for '{course.title}' (mentor: {course.mentor.username}) was refunded (${payment.amount}).",
        sender=refunded_by,
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )

    logger.info(
        "[Refund] Payment %s refunded; enrollment %s revoked.",
        payment.transaction_id, enrollment.id,
    )


def _dispute_enrollment(payment: Payment, detail: str) -> None:
    payment.status = Payment.StatusChoices.DISPUTED
    payment.disputed_at = timezone.now()
    payment.dispute_detail = detail[:5000]
    payment.save(update_fields=['status', 'disputed_at', 'dispute_detail'])

    enrollment = payment.enrollment
    enrollment.is_active = False
    enrollment.save(update_fields=['is_active'])

    logger.warning(
        "[Dispute] Enrollment %s revoked. Transaction %s. Detail: %s",
        enrollment.id, payment.transaction_id, detail[:200],
    )


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
        if user.is_staff or user.role == 'ADMIN':
            return Enrollment.objects.all()
        if user.role == 'MENTOR':
            return Enrollment.objects.filter(course__mentor=user)
        return Enrollment.objects.filter(student=user)

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

        if Enrollment.objects.filter(student=user, course=course).exists():
            raise ValidationError({"detail": "You are already enrolled in this course."})

        if float(course.price) > 0:
            raise ValidationError(
                {"detail": "Payment is required for this paid course. Please complete checkout."}
            )

        serializer.save(student=user, course=course, is_active=True)

        Notification.objects.create(
            recipient=user,
            sender=course.mentor,
            title="Enrollment Confirmed",
            message=f"You have successfully enrolled in '{course.title}'.",
            notification_type=Notification.NotificationType.ENROLLMENT,
            related_object_id=course.id,
            related_object_type="Course",
        )

        Notification.objects.create(
            recipient=course.mentor,
            sender=user,
            title="New Student Enrolled",
            message=f"{user.username} enrolled in '{course.title}' (free course).",
            notification_type=Notification.NotificationType.ENROLLMENT,
            related_object_id=course.id,
            related_object_type="Course",
        )

        _notify_admins(
            title="New Student Enrolled",
            message=f"{user.username} enrolled in '{course.title}' (mentor: {course.mentor.username}).",
            sender=user,
            notification_type=Notification.NotificationType.ENROLLMENT,
            related_object_id=course.id,
            related_object_type="Course",
        )

    @action(detail=False, methods=['get'])
    def check(self, request):
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response(
                {"detail": "course_id parameter is required."},
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
            enrollment = Enrollment.objects.get(student=user, course_id=course_id)

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

    def _get_or_create_pending_enrollment(self, user, course):
        existing = Enrollment.objects.filter(student=user, course=course).first()
        if existing:
            if existing.is_active:
                return None, Response(
                    {"detail": "You are already enrolled in this course."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return existing, None
        return Enrollment.objects.create(student=user, course=course, is_active=False), None

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

        enrollment, err = self._get_or_create_pending_enrollment(user, course)
        if err:
            return err

        import uuid
        is_mock_stripe = (gateway == 'STRIPE') and (not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY == 'sk_test_mock' or settings.STRIPE_SECRET_KEY.endswith('_mock'))
        is_mock_paypal = (gateway == 'PAYPAL') and (not settings.PAYPAL_CLIENT_ID or settings.PAYPAL_CLIENT_ID == 'paypal_mock' or settings.PAYPAL_SECRET == 'paypal_mock')

        # ── Stripe ──────────────────────────────────────────────────────
        if gateway == 'STRIPE':
            if is_mock_stripe:
                transaction_id = f"mock_stripe_sess_{uuid.uuid4().hex}"
                checkout_url = (
                    f"{settings.FRONTEND_URL}/mock-checkout"
                    f"?gateway=stripe"
                    f"&course_id={course.id}"
                    f"&transaction_id={transaction_id}"
                )
                logger.warning("[Stripe] Using local simulated checkout for course %s", course.id)
            else:
                try:
                    session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        line_items=[{
                            'price_data': {
                                'currency': 'usd',
                                'product_data': {
                                    'name': course.title,
                                    'description': (course.description or '')[:255],
                                },
                                'unit_amount': int(float(course.price) * 100),
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=(
                            f"{settings.FRONTEND_URL}/courses/{course.id}"
                            f"?payment_success=true&gateway=stripe"
                            f"&session_id={{CHECKOUT_SESSION_ID}}"
                        ),
                        cancel_url=(
                            f"{settings.FRONTEND_URL}/courses/{course.id}?payment_cancel=true"
                        ),
                        metadata={
                            'course_id':    str(course.id),
                            'student_id':   str(user.id),
                            'enrollment_id': str(enrollment.id),
                        },
                    )
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
            if is_mock_paypal:
                transaction_id = f"mock_paypal_order_{uuid.uuid4().hex}"
                checkout_url = (
                    f"{settings.FRONTEND_URL}/mock-checkout"
                    f"?gateway=paypal"
                    f"&course_id={course.id}"
                    f"&transaction_id={transaction_id}"
                )
                logger.warning("[PayPal] Using local simulated checkout for course %s", course.id)
            else:
                try:
                    order_data   = pp_create_order(course, enrollment)
                    transaction_id = order_data['id']
                    checkout_url   = pp_get_approve_url(order_data)
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

            if payment.status == Payment.StatusChoices.COMPLETED:
                return Response({"verified": True, "detail": "Payment already verified."})

            if session_id.startswith('mock_'):
                _activate_enrollment(payment)
                return Response({"verified": True, "detail": "Stripe mock payment verified."})

            try:
                session = stripe.checkout.Session.retrieve(session_id)
            except stripe.error.StripeError as exc:
                logger.error("[Stripe] Session retrieve failed: %s", exc)
                return Response(
                    {"detail": f"Stripe verification failed: {exc.user_message}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            if session.payment_status == 'paid':
                _activate_enrollment(payment)
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

            if payment.status == Payment.StatusChoices.COMPLETED:
                return Response({"verified": True, "detail": "Payment already verified."})

            if order_id.startswith('mock_'):
                _activate_enrollment(payment)
                return Response({"verified": True, "detail": "PayPal mock payment captured and verified."})

            try:
                cap_data = pp_capture_order(order_id)
                if cap_data.get('status') == 'COMPLETED':
                    _activate_enrollment(payment)
                    return Response({"verified": True, "detail": "PayPal payment captured and verified."})

                return Response({
                    "verified": False,
                    "detail": f"PayPal capture status: {cap_data.get('status')}.",
                })

            except RuntimeError as exc:
                if 'ORDER_ALREADY_CAPTURED' in str(exc):
                    if payment.status != Payment.StatusChoices.COMPLETED:
                        _activate_enrollment(payment)
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
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return Response({"detail": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError:
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

        event_type = event['type']
        obj        = event['data']['object']

        logger.info("[Stripe Webhook] %s", event_type)

        if event_type == 'checkout.session.completed':
            self._stripe_fulfill(_stripe_attr(obj, 'id'))

        elif event_type == 'payment_intent.succeeded':
            pi_id = _stripe_attr(obj, 'id')
            try:
                sessions = stripe.checkout.Session.list(payment_intent=pi_id, limit=1)
                if sessions.data:
                    self._stripe_fulfill(sessions.data[0].id)
            except Exception as exc:
                logger.warning("[Stripe] payment_intent.succeeded lookup error: %s", exc)

        elif event_type == 'charge.refunded':
            charge_id = _stripe_attr(obj, 'id')
            pi_id     = _stripe_attr(obj, 'payment_intent')
            if pi_id:
                self._stripe_refund_by_pi(pi_id)
            logger.info("[Stripe] Charge %s refunded via webhook.", charge_id)

        elif event_type == 'charge.dispute.created':
            self._stripe_dispute(obj)

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

    def _stripe_fulfill(self, session_id: str) -> None:
        if not session_id:
            return
        try:
            payment = Payment.objects.get(transaction_id=session_id)
            if payment.status != Payment.StatusChoices.COMPLETED:
                _activate_enrollment(payment)
        except Payment.DoesNotExist:
            logger.warning("[Stripe] Session %s not found in DB during webhook.", session_id)

    def _stripe_refund_by_pi(self, payment_intent_id: str) -> None:
        try:
            sessions = stripe.checkout.Session.list(
                payment_intent=payment_intent_id, limit=1
            )
            if not sessions.data:
                return
            session_id = sessions.data[0].id
            payment = Payment.objects.get(transaction_id=session_id)
            _mark_refunded(payment)
        except Payment.DoesNotExist:
            logger.warning("[Stripe] Refund webhook: payment not found for PI %s.", payment_intent_id)
        except Exception as exc:
            logger.error("[Stripe] _stripe_refund_by_pi error: %s", exc)

    def _stripe_dispute(self, dispute_obj) -> None:
        pi_id = _stripe_attr(dispute_obj, 'payment_intent')
        if not pi_id:
            return
        try:
            sessions = stripe.checkout.Session.list(payment_intent=pi_id, limit=1)
            if not sessions.data:
                return
            session_id = sessions.data[0].id
            payment = Payment.objects.get(transaction_id=session_id)
            detail_json = json.dumps({
                "dispute_id": _stripe_attr(dispute_obj, 'id'),
                "reason":     _stripe_attr(dispute_obj, 'reason'),
                "status":     _stripe_attr(dispute_obj, 'status'),
                "amount":     _stripe_attr(dispute_obj, 'amount'),
            })
            _dispute_enrollment(payment, detail_json)
        except Payment.DoesNotExist:
            logger.warning("[Stripe] Dispute webhook: payment not found for PI %s.", pi_id)
        except Exception as exc:
            logger.error("[Stripe] _stripe_dispute error: %s", exc)

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

        event_type = event_data.get('event_type', '')
        resource   = event_data.get('resource', {})

        logger.info("[PayPal Webhook] %s", event_type)

        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            order_id = (
                resource.get('supplementary_data', {})
                         .get('related_ids', {})
                         .get('order_id')
            )
            if not order_id:
                logger.warning("[PayPal] CAPTURE.COMPLETED missing order_id in resource.")
                return Response({"status": "ok"})

            try:
                payment = Payment.objects.get(transaction_id=order_id)
                if payment.status != Payment.StatusChoices.COMPLETED:
                    _activate_enrollment(payment)
            except Payment.DoesNotExist:
                logger.warning("[PayPal] Order %s not found in DB during webhook.", order_id)

        elif event_type == 'PAYMENT.CAPTURE.REFUNDED':
            order_id = (
                resource.get('supplementary_data', {})
                         .get('related_ids', {})
                         .get('order_id')
            )
            if order_id:
                try:
                    payment = Payment.objects.get(transaction_id=order_id)
                    _mark_refunded(payment)
                except Payment.DoesNotExist:
                    pass

        elif event_type in (
            'CUSTOMER.DISPUTE.CREATED',
            'CUSTOMER.DISPUTE.UPDATED',
            'RISK.DISPUTE.CREATED',
        ):
            dispute_id = resource.get('dispute_id') or resource.get('id')
            for tx in resource.get('disputed_transactions', []):
                order_id = tx.get('order_id') or tx.get('buyer_transaction_id')
                if order_id:
                    try:
                        payment = Payment.objects.get(transaction_id=order_id)
                        detail_json = json.dumps({
                            "dispute_id": dispute_id,
                            "reason":     resource.get('reason'),
                            "status":     resource.get('status'),
                        })
                        _dispute_enrollment(payment, detail_json)
                    except Payment.DoesNotExist:
                        logger.warning(
                            "[PayPal] Dispute %s: order %s not found.", dispute_id, order_id
                        )

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
        if user.is_staff or user.role == 'ADMIN':
            return Payment.objects.all().order_by('-created_at')
        if user.role == 'MENTOR':
            return Payment.objects.filter(
                enrollment__course__mentor=user
            ).order_by('-created_at')
        return Payment.objects.filter(student=user).order_by('-created_at')

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

        if payment.transaction_id.startswith('mock_'):
            logger.info("[Refund] Bypassing third-party API refund for mock transaction %s", payment.transaction_id)
        elif payment.gateway == Payment.GatewayChoices.STRIPE:
            try:
                session = stripe.checkout.Session.retrieve(payment.transaction_id)
                pi_id   = session.payment_intent
                if not pi_id:
                    return Response(
                        {"detail": "No payment intent found for this Stripe session."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                stripe.Refund.create(payment_intent=pi_id)
            except stripe.error.StripeError as exc:
                logger.error("[Stripe] Refund failed for %s: %s", payment.transaction_id, exc)
                return Response(
                    {"detail": f"Stripe refund failed: {exc.user_message}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        elif payment.gateway == Payment.GatewayChoices.PAYPAL:
            try:
                capture_id = pp_get_capture_id(payment.transaction_id)
                if not capture_id:
                    return Response(
                        {"detail": "Could not locate PayPal capture ID for this order."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                pp_refund_capture(capture_id)
            except RuntimeError as exc:
                logger.error("[PayPal] Refund failed for %s: %s", payment.transaction_id, exc)
                return Response(
                    {"detail": f"PayPal refund failed: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        _mark_refunded(payment, refunded_by=user)

        return Response({
            "detail": "Payment refunded and student enrollment revoked.",
            "status": "REFUNDED",
        }, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard Stats View
# ══════════════════════════════════════════════════════════════════════════════

from rest_framework.views import APIView
from django.db.models import Sum, Avg
from courses.models import Review
from courses.serializers import CourseListSerializer

class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        import datetime

        if user.role == 'MENTOR':
            my_courses = Course.objects.filter(mentor=user)
            courses_count = my_courses.count()
            published_count = my_courses.filter(is_published=True).count()

            total_students = Enrollment.objects.filter(course__mentor=user, is_active=True).count()

            avg_rating_val = Review.objects.filter(course__mentor=user).aggregate(Avg('rating'))['rating__avg']
            avg_rating = round(avg_rating_val, 1) if avg_rating_val is not None else 0.0

            # Revenue Summary
            revenue_sum = Payment.objects.filter(
                enrollment__course__mentor=user, 
                status=Payment.StatusChoices.COMPLETED
            ).aggregate(total=Sum('amount'))['total'] or 0.00
            revenue = float(revenue_sum)

            # Course list performance
            course_performance = []
            for c in my_courses:
                c_enrolls = Enrollment.objects.filter(course=c).count()
                c_rev = Payment.objects.filter(enrollment__course=c, status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
                course_performance.append({
                    "id": c.id,
                    "title": c.title,
                    "students": c_enrolls,
                    "revenue": float(c_rev),
                    "rating": float(c.rating_average)
                })

            # Recent enrollments
            recent_enrollments_qs = Enrollment.objects.filter(course__mentor=user).order_by('-enrolled_at')[:5].select_related('student', 'course')
            recent_enrollments = []
            for re in recent_enrollments_qs:
                recent_enrollments.append({
                    "student_username": re.student.username,
                    "course_title": re.course.title,
                    "enrolled_at": re.enrolled_at
                })

            # Recent reviews
            from courses.serializers import ReviewSerializer
            recent_reviews = Review.objects.filter(course__mentor=user).order_by('-created_at')[:5]
            reviews_data = ReviewSerializer(recent_reviews, many=True).data

            # Pending questions
            from chat.models import ChatMessage
            pending_questions_qs = ChatMessage.objects.filter(
                room__course__mentor=user,
                parent=None
            ).exclude(
                replies__sender__role__in=['MENTOR', 'ADMIN']
            ).distinct().order_by('-created_at')[:5].select_related('sender', 'room__course')
            
            pending_questions = []
            for pq in pending_questions_qs:
                pending_questions.append({
                    "id": pq.id,
                    "course_title": pq.room.course.title,
                    "student_username": pq.sender.username,
                    "message_text": pq.message_text[:80],
                    "created_at": pq.created_at
                })

            return Response({
                "role": "MENTOR",
                "stats": {
                    "courses_count": courses_count,
                    "total_students": total_students,
                    "published_count": published_count,
                    "avg_rating": avg_rating,
                    "revenue": revenue
                },
                "course_performance": course_performance,
                "recent_enrollments": recent_enrollments,
                "recent_reviews": reviews_data,
                "pending_questions": pending_questions
            })

        elif user.role == 'ADMIN':
            total_courses = Course.objects.count()
            published_count = Course.objects.filter(is_published=True).count()
            pending_courses = Course.objects.filter(is_submitted_for_review=True, is_approved=False).count()
            total_students = User.objects.filter(role='STUDENT').count()
            total_mentors = User.objects.filter(role='MENTOR').count()

            # Revenue Overview
            revenue_sum = Payment.objects.filter(status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
            revenue = float(revenue_sum)
            
            # Recent registrations
            recent_registrations_qs = User.objects.order_by('-date_joined')[:5].values('id', 'username', 'email', 'role', 'date_joined')
            recent_registrations = list(recent_registrations_qs)

            # Pending mentor approvals
            pending_mentor_approvals_qs = User.objects.filter(role='MENTOR', profile__is_approved=False).select_related('profile')[:5]
            pending_mentor_approvals = []
            for pm in pending_mentor_approvals_qs:
                pending_mentor_approvals.append({
                    "id": pm.id,
                    "username": pm.username,
                    "email": pm.email,
                    "skills": pm.profile.skills,
                    "title": pm.profile.title
                })

            # Pending course approvals
            pending_course_approvals_qs = Course.objects.filter(is_submitted_for_review=True, is_approved=False)[:5]
            pending_course_approvals = []
            for pc in pending_course_approvals_qs:
                pending_course_approvals.append({
                    "id": pc.id,
                    "title": pc.title,
                    "mentor": pc.mentor.username,
                    "price": float(pc.price)
                })

            # Recent refunds
            recent_refunds_qs = Payment.objects.filter(status=Payment.StatusChoices.REFUNDED).order_by('-refunded_at')[:5]
            recent_refunds = []
            for pr in recent_refunds_qs:
                recent_refunds.append({
                    "id": pr.id,
                    "student_username": pr.student.username,
                    "course_title": pr.enrollment.course.title,
                    "amount": float(pr.amount),
                    "refunded_at": pr.refunded_at
                })

            # System activity
            system_activity_qs = Notification.objects.order_by('-created_at')[:8]
            system_activity = []
            for sa in system_activity_qs:
                system_activity.append({
                    "id": sa.id,
                    "title": sa.title,
                    "message": sa.message,
                    "created_at": sa.created_at
                })

            return Response({
                "role": "ADMIN",
                "stats": {
                    "total_courses": total_courses,
                    "published_count": published_count,
                    "pending_courses": pending_courses,
                    "total_students": total_students,
                    "total_mentors": total_mentors,
                    "revenue": revenue
                },
                "recent_registrations": recent_registrations,
                "pending_mentor_approvals": pending_mentor_approvals,
                "pending_course_approvals": pending_course_approvals,
                "recent_refunds": recent_refunds,
                "system_activity": system_activity
            })

        else:
            # STUDENT Dashboard
            active_enrollments = Enrollment.objects.filter(student=user, is_active=True).select_related('course')
            enrolled_count = active_enrollments.count()

            in_progress_count = active_enrollments.filter(progress_percent__gt=0, progress_percent__lt=100).count()
            completed_count = active_enrollments.filter(progress_percent=100).count()

            hours_learned_val = active_enrollments.filter(progress_percent=100).aggregate(total=Sum('course__duration_hours'))['total']
            hours_learned = hours_learned_val if hours_learned_val is not None else 0

            # 1. Continue Learning
            last_progress = LessonProgress.objects.filter(student=user).order_by('-last_accessed').select_related('lesson', 'course').first()
            continue_learning = None
            upcoming_lessons = []
            
            if last_progress:
                continue_learning = {
                    "course_id": last_progress.course_id or last_progress.lesson.module.course_id,
                    "course_title": last_progress.course.title if last_progress.course else last_progress.lesson.module.course.title,
                    "lesson_id": last_progress.lesson_id,
                    "lesson_title": last_progress.lesson.title,
                    "video_position_seconds": last_progress.video_position_seconds
                }
                
                # 2. Upcoming lessons in this course
                from courses.models import Lesson as CourseLesson
                course_lessons = list(
                    CourseLesson.objects.filter(
                        module__course_id=last_progress.course_id or last_progress.lesson.module.course_id
                    ).order_by('module__order', 'order')
                )
                current_idx = next((i for i, l in enumerate(course_lessons) if l.id == last_progress.lesson_id), -1)
                if current_idx != -1 and current_idx + 1 < len(course_lessons):
                    for idx in range(current_idx + 1, min(current_idx + 4, len(course_lessons))):
                        upcoming_lessons.append({
                            "id": course_lessons[idx].id,
                            "title": course_lessons[idx].title,
                            "content_type": course_lessons[idx].content_type
                        })

            # 3. Learning streak (consecutive days of lesson progress updates)
            progress_history = LessonProgress.objects.filter(student=user).values_list('last_accessed', flat=True)
            days = sorted(list(set([d.date() for d in progress_history])), reverse=True)
            streak = 0
            current_date = timezone.now().date()
            if days:
                if days[0] == current_date or days[0] == current_date - datetime.timedelta(days=1):
                    streak = 1
                    for i in range(1, len(days)):
                        if days[i-1] - days[i] == datetime.timedelta(days=1):
                            streak += 1
                        else:
                            break

            # 4. Certificates earned
            certificates_count = Certificate.objects.filter(student=user).count()

            # 5. Average progress
            avg_progress = active_enrollments.aggregate(avg=Avg('progress_percent'))['avg'] or 0.0
            avg_progress = round(float(avg_progress), 2)

            # 6. Recent notifications
            recent_notifications_qs = Notification.objects.filter(recipient=user).order_by('-created_at')[:5]
            recent_notifications = []
            for n in recent_notifications_qs:
                recent_notifications.append({
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "notification_type": n.notification_type,
                    "created_at": n.created_at,
                    "is_read": n.is_read
                })

            enrollment_data = EnrollmentSerializer(
                active_enrollments.order_by('-enrolled_at'),
                many=True,
                context={'request': request}
            ).data

            return Response({
                "role": "STUDENT",
                "stats": {
                    "enrolled_count": enrolled_count,
                    "in_progress_count": in_progress_count,
                    "completed_count": completed_count,
                    "hours_learned": hours_learned,
                    "streak": streak,
                    "certificates_count": certificates_count,
                    "avg_progress": avg_progress
                },
                "continue_learning": continue_learning,
                "upcoming_lessons": upcoming_lessons,
                "recent_notifications": recent_notifications,
                "enrollments": enrollment_data
            })