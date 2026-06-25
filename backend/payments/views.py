"""
payments/views.py
~~~~~~~~~~~~~~~~~
Handles enrollments, lesson progress, checkout (Stripe & PayPal), webhooks,
payment listing, and refunds.

Environment variables required (set in Django settings):
    STRIPE_SECRET_KEY
    STRIPE_PUBLISHABLE_KEY
    STRIPE_WEBHOOK_SECRET
    PAYPAL_CLIENT_ID
    PAYPAL_SECRET
    PAYPAL_MODE          (sandbox | live)
    FRONTEND_URL
"""

import json
import logging

import stripe
from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from courses.models import Course, Lesson

from .models import Certificate, Enrollment, LessonProgress, Payment
from .paypal_client import (
    capture_order as pp_capture_order,
    create_order as pp_create_order,
    get_approve_url as pp_get_approve_url,
    get_capture_id as pp_get_capture_id,
    refund_capture as pp_refund_capture,
)
from .serializers import (
    EnrollmentSerializer,
    LessonProgressSerializer,
    PaymentSerializer,
)

logger = logging.getLogger(__name__)

# ── Stripe initialisation ──────────────────────────────────────────────────
stripe.api_key = settings.STRIPE_SECRET_KEY


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

        # Paid courses must use the checkout flow
        if float(course.price) > 0:
            raise ValidationError(
                {"detail": "Payment is required for this paid course. Please complete checkout."}
            )

        serializer.save(student=user, course=course, is_active=True)

    @action(detail=False, methods=['get'])
    def check(self, request):
        """
        GET /api/payments/enrollments/check/?course_id=<id>
        Returns enrollment status, progress, completed lesson IDs, and certificate URL.
        """
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response(
                {"detail": "course_id parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            enrollment = Enrollment.objects.get(student=request.user, course_id=course_id)

            completed_lesson_ids = list(
                LessonProgress.objects.filter(
                    student=request.user,
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
# Lesson Progress ViewSet
# ══════════════════════════════════════════════════════════════════════════════

class LessonProgressViewSet(viewsets.GenericViewSet):
    """
    POST /api/payments/progress/lessons/<lesson_id>/complete/
    """

    queryset = LessonProgress.objects.all()
    serializer_class = LessonProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(
        detail=False,
        methods=['post'],
        url_path=r'lessons/(?P<lesson_id>[^/.]+)/complete',
    )
    def complete(self, request, lesson_id=None):
        student = request.user
        if student.role != 'STUDENT':
            raise PermissionDenied("Only students can mark lessons as complete.")

        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        course = lesson.module.course

        try:
            enrollment = Enrollment.objects.get(student=student, course=course, is_active=True)
        except Enrollment.DoesNotExist:
            raise PermissionDenied("You must be enrolled in this course to mark progress.")

        progress, created = LessonProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={"is_completed": True, "completed_at": timezone.now()},
        )
        if not created and not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()

        total_lessons = Lesson.objects.filter(module__course=course).count()
        if total_lessons > 0:
            completed_count = LessonProgress.objects.filter(
                student=student,
                lesson__module__course=course,
                is_completed=True,
            ).count()
            progress_percent = round((completed_count / total_lessons) * 100, 2)
        else:
            progress_percent = 0.00

        enrollment.progress_percent = progress_percent
        enrollment.save()

        # ── Certificate generation on 100 % ──────────────────────────────
        certificate_url = None
        if progress_percent >= 100.00:
            from .utils import generate_certificate_pdf
            try:
                cert = generate_certificate_pdf(enrollment)
                if cert and cert.pdf_file:
                    certificate_url = request.build_absolute_uri(cert.pdf_file.url)
            except Exception as exc:
                logger.error(
                    "[Certificate] Generation error for enrollment %s: %s",
                    enrollment.id, exc,
                )

        return Response({
            "detail": f"Lesson '{lesson.title}' marked as complete.",
            "is_completed": True,
            "progress_percent": progress_percent,
            "certificate_url": certificate_url,
        }, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# Checkout ViewSet
# ══════════════════════════════════════════════════════════════════════════════

class CheckoutViewSet(viewsets.ViewSet):
    """
    Handles real Stripe Checkout Sessions and real PayPal Sandbox/Live orders.

    Endpoints
    ---------
    POST  checkout/create-session/   → returns checkout_url + transaction_id
    POST  checkout/verify/           → verifies / captures payment; activates enrollment
    POST  checkout/stripe-webhook/   → Stripe webhook receiver (public)
    POST  checkout/paypal-webhook/   → PayPal webhook receiver (public)
    """

    permission_classes = [permissions.IsAuthenticated]

    # ── helpers ──────────────────────────────────────────────────────────

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

    def _activate_enrollment(self, payment: Payment) -> None:
        """Mark payment COMPLETED and activate the associated enrollment."""
        payment.status = Payment.StatusChoices.COMPLETED
        payment.save(update_fields=['status'])

        enrollment = payment.enrollment
        enrollment.is_active = True
        enrollment.save(update_fields=['is_active'])

        logger.info(
            "[Payment] Enrollment %s activated via %s (%s).",
            enrollment.id, payment.gateway, payment.transaction_id,
        )

    def _dispute_enrollment(self, payment: Payment, detail: str) -> None:
        """Mark payment DISPUTED, revoke enrollment, and log detail."""
        payment.status = Payment.StatusChoices.DISPUTED
        payment.disputed_at = timezone.now()
        payment.dispute_detail = detail[:5000]  # guard against huge blobs
        payment.save(update_fields=['status', 'disputed_at', 'dispute_detail'])

        enrollment = payment.enrollment
        enrollment.is_active = False
        enrollment.save(update_fields=['is_active'])

        logger.warning(
            "[Dispute] Enrollment %s revoked. Transaction %s. Detail: %s",
            enrollment.id, payment.transaction_id, detail[:200],
        )

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

        Payment.objects.update_or_create(
            enrollment=enrollment,
            defaults={
                'student':        user,
                'gateway':        gateway,
                'transaction_id': transaction_id,
                'amount':         course.price,
                'status':         Payment.StatusChoices.PENDING,
            },
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
                self._activate_enrollment(payment)
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
                self._activate_enrollment(payment)
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
                self._activate_enrollment(payment)
                return Response({"verified": True, "detail": "PayPal mock payment captured and verified."})

            try:
                cap_data = pp_capture_order(order_id)
                if cap_data.get('status') == 'COMPLETED':
                    self._activate_enrollment(payment)
                    return Response({"verified": True, "detail": "PayPal payment captured and verified."})

                return Response({
                    "verified": False,
                    "detail": f"PayPal capture status: {cap_data.get('status')}.",
                })

            except RuntimeError as exc:
                # Order might already have been captured (double-click / webhook race)
                if 'ORDER_ALREADY_CAPTURED' in str(exc):
                    if payment.status != Payment.StatusChoices.COMPLETED:
                        self._activate_enrollment(payment)
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
            self._stripe_fulfill(obj.get('id'))

        elif event_type == 'payment_intent.succeeded':
            # Fallback: find payment by payment_intent id
            pi_id = obj.get('id')
            try:
                # Session stores payment_intent; look it up
                sessions = stripe.checkout.Session.list(payment_intent=pi_id, limit=1)
                if sessions.data:
                    self._stripe_fulfill(sessions.data[0].id)
            except Exception as exc:
                logger.warning("[Stripe] payment_intent.succeeded lookup error: %s", exc)

        elif event_type == 'charge.refunded':
            charge_id = obj.get('id')
            pi_id     = obj.get('payment_intent')
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
                self._activate_enrollment(payment)
        except Payment.DoesNotExist:
            logger.warning("[Stripe] Session %s not found in DB during webhook.", session_id)

    def _stripe_refund_by_pi(self, payment_intent_id: str) -> None:
        """Mark payment as REFUNDED and revoke enrollment — triggered by webhook."""
        try:
            # Retrieve session for PI to get session id stored in DB
            sessions = stripe.checkout.Session.list(
                payment_intent=payment_intent_id, limit=1
            )
            if not sessions.data:
                return
            session_id = sessions.data[0].id
            payment = Payment.objects.get(transaction_id=session_id)
            if payment.status != Payment.StatusChoices.REFUNDED:
                payment.status = Payment.StatusChoices.REFUNDED
                payment.refunded_at = timezone.now()
                payment.save(update_fields=['status', 'refunded_at'])
                enrollment = payment.enrollment
                enrollment.is_active = False
                enrollment.save(update_fields=['is_active'])
                logger.info(
                    "[Stripe] Enrollment %s revoked via refund webhook (PI %s).",
                    enrollment.id, payment_intent_id,
                )
        except Payment.DoesNotExist:
            logger.warning("[Stripe] Refund webhook: payment not found for PI %s.", payment_intent_id)
        except Exception as exc:
            logger.error("[Stripe] _stripe_refund_by_pi error: %s", exc)

    def _stripe_dispute(self, dispute_obj: dict) -> None:
        pi_id = dispute_obj.get('payment_intent')
        if not pi_id:
            return
        try:
            sessions = stripe.checkout.Session.list(payment_intent=pi_id, limit=1)
            if not sessions.data:
                return
            session_id = sessions.data[0].id
            payment = Payment.objects.get(transaction_id=session_id)
            detail_json = json.dumps({
                "dispute_id": dispute_obj.get('id'),
                "reason":     dispute_obj.get('reason'),
                "status":     dispute_obj.get('status'),
                "amount":     dispute_obj.get('amount'),
            })
            self._dispute_enrollment(payment, detail_json)
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
            # resource.id is the capture ID; find the order via supplementary_data
            order_id = (
                resource.get('supplementary_data', {})
                         .get('related_ids', {})
                         .get('order_id')
            )
            if not order_id:
                # Fallback: search for payment whose transaction_id matches any order
                # tied to this capture — not reliably available; log and move on.
                logger.warning("[PayPal] CAPTURE.COMPLETED missing order_id in resource.")
                return Response({"status": "ok"})

            try:
                payment = Payment.objects.get(transaction_id=order_id)
                if payment.status != Payment.StatusChoices.COMPLETED:
                    self._activate_enrollment(payment)
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
                    if payment.status != Payment.StatusChoices.REFUNDED:
                        payment.status = Payment.StatusChoices.REFUNDED
                        payment.refunded_at = timezone.now()
                        payment.save(update_fields=['status', 'refunded_at'])
                        enrollment = payment.enrollment
                        enrollment.is_active = False
                        enrollment.save(update_fields=['is_active'])
                        logger.info(
                            "[PayPal] Enrollment %s revoked via refund webhook.", enrollment.id
                        )
                except Payment.DoesNotExist:
                    pass

        elif event_type in (
            'CUSTOMER.DISPUTE.CREATED',
            'CUSTOMER.DISPUTE.UPDATED',
            'RISK.DISPUTE.CREATED',
        ):
            dispute_id = resource.get('dispute_id') or resource.get('id')
            # disputed_transactions contains order / transaction refs
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
                        self._dispute_enrollment(payment, detail_json)
                    except Payment.DoesNotExist:
                        logger.warning(
                            "[PayPal] Dispute %s: order %s not found.", dispute_id, order_id
                        )

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# Payment ViewSet  (list + refund)
# ══════════════════════════════════════════════════════════════════════════════

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing payment history and initiating refunds.

    Refund endpoint:  POST /api/payments/payments/<pk>/refund/
    Permission: admin or mentor who owns the course.
    """

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
            # Bypass actual api calls for mock transactions
            logger.info("[Refund] Bypassing third-party API refund for mock transaction %s", payment.transaction_id)
        # ── Stripe refund ────────────────────────────────────────────────
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

        # ── PayPal refund ────────────────────────────────────────────────
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

        # ── DB update ────────────────────────────────────────────────────
        payment.status      = Payment.StatusChoices.REFUNDED
        payment.refunded_at = timezone.now()
        payment.save(update_fields=['status', 'refunded_at'])

        enrollment           = payment.enrollment
        enrollment.is_active = False
        enrollment.save(update_fields=['is_active'])

        logger.info(
            "[Refund] Payment %s refunded; enrollment %s revoked.",
            payment.transaction_id, enrollment.id,
        )

        return Response({
            "detail": "Payment refunded and student enrollment revoked.",
            "status": "REFUNDED",
        }, status=status.HTTP_200_OK)