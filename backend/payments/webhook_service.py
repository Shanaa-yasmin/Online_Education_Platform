"""
payments/webhook_service.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~
Processes verified Stripe and PayPal webhook events: locating the
associated Payment row and applying the appropriate state transition
via services.py. views.py is responsible only for verifying the
signature / parsing the request body and handing the event off here.
"""

import json
import logging

from .models import Payment
from . import services
from . import stripe_client

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════
# Stripe
# ══════════════════════════════════════════════════════════════════════════

def handle_stripe_event(event) -> None:
    event_type = event['type']
    obj = event['data']['object']

    logger.info("[Stripe Webhook] %s", event_type)

    if event_type == 'checkout.session.completed':
        _stripe_fulfill(stripe_client.stripe_attr(obj, 'id'))

    elif event_type == 'payment_intent.succeeded':
        pi_id = stripe_client.stripe_attr(obj, 'id')
        try:
            sessions = stripe_client.list_sessions_by_payment_intent(pi_id, limit=1)
            if sessions.data:
                _stripe_fulfill(sessions.data[0].id)
        except Exception as exc:
            logger.warning("[Stripe] payment_intent.succeeded lookup error: %s", exc)

    elif event_type == 'charge.refunded':
        charge_id = stripe_client.stripe_attr(obj, 'id')
        pi_id = stripe_client.stripe_attr(obj, 'payment_intent')
        if pi_id:
            _stripe_refund_by_pi(pi_id)
        logger.info("[Stripe] Charge %s refunded via webhook.", charge_id)

    elif event_type == 'charge.dispute.created':
        _stripe_dispute(obj)


def _stripe_fulfill(session_id: str) -> None:
    if not session_id:
        return
    try:
        payment = Payment.objects.get(transaction_id=session_id)
        if payment.status != Payment.StatusChoices.COMPLETED:
            services.activate_enrollment(payment)
    except Payment.DoesNotExist:
        logger.warning("[Stripe] Session %s not found in DB during webhook.", session_id)


def _stripe_refund_by_pi(payment_intent_id: str) -> None:
    try:
        sessions = stripe_client.list_sessions_by_payment_intent(payment_intent_id, limit=1)
        if not sessions.data:
            return
        session_id = sessions.data[0].id
        payment = Payment.objects.get(transaction_id=session_id)
        services.mark_refunded(payment)
    except Payment.DoesNotExist:
        logger.warning("[Stripe] Refund webhook: payment not found for PI %s.", payment_intent_id)
    except Exception as exc:
        logger.error("[Stripe] _stripe_refund_by_pi error: %s", exc)


def _stripe_dispute(dispute_obj) -> None:
    pi_id = stripe_client.stripe_attr(dispute_obj, 'payment_intent')
    if not pi_id:
        return
    try:
        sessions = stripe_client.list_sessions_by_payment_intent(pi_id, limit=1)
        if not sessions.data:
            return
        session_id = sessions.data[0].id
        payment = Payment.objects.get(transaction_id=session_id)
        detail_json = json.dumps({
            "dispute_id": stripe_client.stripe_attr(dispute_obj, 'id'),
            "reason":     stripe_client.stripe_attr(dispute_obj, 'reason'),
            "status":     stripe_client.stripe_attr(dispute_obj, 'status'),
            "amount":     stripe_client.stripe_attr(dispute_obj, 'amount'),
        })
        services.dispute_enrollment(payment, detail_json)
    except Payment.DoesNotExist:
        logger.warning("[Stripe] Dispute webhook: payment not found for PI %s.", pi_id)
    except Exception as exc:
        logger.error("[Stripe] _stripe_dispute error: %s", exc)


# ══════════════════════════════════════════════════════════════════════════
# PayPal
# ══════════════════════════════════════════════════════════════════════════

def handle_paypal_event(event_data: dict) -> None:
    event_type = event_data.get('event_type', '')
    resource = event_data.get('resource', {})

    logger.info("[PayPal Webhook] %s", event_type)

    if event_type == 'PAYMENT.CAPTURE.COMPLETED':
        _paypal_capture_completed(resource)

    elif event_type == 'PAYMENT.CAPTURE.REFUNDED':
        _paypal_capture_refunded(resource)

    elif event_type in (
        'CUSTOMER.DISPUTE.CREATED',
        'CUSTOMER.DISPUTE.UPDATED',
        'RISK.DISPUTE.CREATED',
    ):
        _paypal_dispute(resource)


def _paypal_capture_completed(resource: dict) -> None:
    order_id = (
        resource.get('supplementary_data', {})
                 .get('related_ids', {})
                 .get('order_id')
    )
    if not order_id:
        logger.warning("[PayPal] CAPTURE.COMPLETED missing order_id in resource.")
        return

    try:
        payment = Payment.objects.get(transaction_id=order_id)
        if payment.status != Payment.StatusChoices.COMPLETED:
            services.activate_enrollment(payment)
    except Payment.DoesNotExist:
        logger.warning("[PayPal] Order %s not found in DB during webhook.", order_id)


def _paypal_capture_refunded(resource: dict) -> None:
    order_id = (
        resource.get('supplementary_data', {})
                 .get('related_ids', {})
                 .get('order_id')
    )
    if order_id:
        try:
            payment = Payment.objects.get(transaction_id=order_id)
            services.mark_refunded(payment)
        except Payment.DoesNotExist:
            pass


def _paypal_dispute(resource: dict) -> None:
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
                services.dispute_enrollment(payment, detail_json)
            except Payment.DoesNotExist:
                logger.warning(
                    "[PayPal] Dispute %s: order %s not found.", dispute_id, order_id
                )
