"""
payments/refund_service.py
~~~~~~~~~~~~~~~~~~~~~~~~~~
Orchestrates refunding a single Payment: calling out to the correct
payment gateway, then applying the shared state transition via
services.mark_refunded. views.py only handles permission checks and
translates RefundError into an HTTP response.
"""

import logging

import stripe
from rest_framework import status

from .models import Payment
from . import services
from . import stripe_client
from . import paypal_client

logger = logging.getLogger(__name__)


class RefundError(Exception):
    """
    Raised when a refund cannot be completed. Carries a user-facing
    `detail` message and the HTTP `status_code` the view should return.
    """

    def __init__(self, detail, status_code=status.HTTP_502_BAD_GATEWAY):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def process_refund(payment: Payment, refunded_by) -> None:
    """
    Refund `payment` at its gateway, then mark it REFUNDED and revoke
    the enrollment via services.py. Raises RefundError on any gateway
    failure.
    """
    if payment.gateway == Payment.GatewayChoices.STRIPE:
        try:
            session = stripe_client.retrieve_session(payment.transaction_id)
            pi_id = session.payment_intent
            if not pi_id:
                raise RefundError(
                    "No payment intent found for this Stripe session.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            stripe_client.create_refund(pi_id)
        except stripe.error.StripeError as exc:
            logger.error("[Stripe] Refund failed for %s: %s", payment.transaction_id, exc)
            raise RefundError(f"Stripe refund failed: {exc.user_message}") from exc

    elif payment.gateway == Payment.GatewayChoices.PAYPAL:
        try:
            capture_id = paypal_client.get_capture_id(payment.transaction_id)
            if not capture_id:
                raise RefundError(
                    "Could not locate PayPal capture ID for this order.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            paypal_client.refund_capture(capture_id)
        except RuntimeError as exc:
            logger.error("[PayPal] Refund failed for %s: %s", payment.transaction_id, exc)
            raise RefundError(f"PayPal refund failed: {exc}") from exc

    services.mark_refunded(payment, refunded_by=refunded_by)