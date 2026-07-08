"""
payments/services.py
~~~~~~~~~~~~~~~~~~~~
Core enrollment/payment business logic shared across checkout, webhook,
and refund flows. These live at module level (not on a ViewSet) because
CheckoutViewSet (webhooks, verify), PaymentViewSet (manual refund), and
webhook_service.py all need to trigger the exact same state changes +
notifications — defining them as a method on one ViewSet and calling it
from another class previously failed with AttributeError.
"""

import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .models import Enrollment, Payment
from . import notification_service

logger = logging.getLogger(__name__)


# ── Enrollment creation ─────────────────────────────────────────────────

def get_or_create_pending_enrollment(user, course):
    """
    Return (enrollment, error_response).

    If the student already has an *active* enrollment in this course,
    enrollment is None and error_response is a ready-to-return DRF
    Response describing the conflict. Otherwise an existing inactive
    enrollment is reused (e.g. after a refund) or a new one is created.
    """
    existing = Enrollment.objects.filter(student=user, course=course).first()
    if existing:
        if existing.is_active:
            return None, Response(
                {"detail": "You are already enrolled in this course."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return existing, None
    return Enrollment.objects.create(student=user, course=course, is_active=False), None


def create_free_enrollment(user, course) -> Enrollment:
    """Enroll a student directly in a free course and send notifications."""
    enrollment = Enrollment.objects.create(student=user, course=course, is_active=True)
    notification_service.notify_free_enrollment(user, course)
    return enrollment


# ── Payment state transitions ───────────────────────────────────────────

def activate_enrollment(payment: Payment) -> None:
    """Mark payment COMPLETED and activate the associated enrollment.
    Notifies the student, the course mentor, and all admins."""
    payment.status = Payment.StatusChoices.COMPLETED
    payment.save(update_fields=['status'])

    enrollment = payment.enrollment
    enrollment.is_active = True
    enrollment.save(update_fields=['is_active'])

    notification_service.notify_payment_success(payment)

    logger.info(
        "[Payment] Enrollment %s activated via %s (%s).",
        enrollment.id, payment.gateway, payment.transaction_id,
    )


def mark_refunded(payment: Payment, refunded_by=None) -> None:
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

    notification_service.notify_refund_processed(payment, refunded_by=refunded_by)

    logger.info(
        "[Refund] Payment %s refunded; enrollment %s revoked.",
        payment.transaction_id, enrollment.id,
    )


def dispute_enrollment(payment: Payment, detail: str) -> None:
    """Mark a payment DISPUTED and revoke the associated enrollment."""
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
