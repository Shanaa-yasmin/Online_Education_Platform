"""
payments/stripe_client.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Thin helper around the Stripe SDK, mirroring paypal_client.py so that
views.py / services never talk to the `stripe` module directly.
"""

import logging

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


def stripe_attr(obj, key, default=None):
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


def create_checkout_session(course, user, enrollment):
    """Create a Stripe Checkout Session for a paid course purchase."""
    return stripe.checkout.Session.create(
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


def retrieve_session(session_id):
    return stripe.checkout.Session.retrieve(session_id)


def list_sessions_by_payment_intent(payment_intent_id, limit=1):
    return stripe.checkout.Session.list(payment_intent=payment_intent_id, limit=limit)


def construct_webhook_event(payload, sig_header):
    return stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)


def create_refund(payment_intent_id):
    return stripe.Refund.create(payment_intent=payment_intent_id)
