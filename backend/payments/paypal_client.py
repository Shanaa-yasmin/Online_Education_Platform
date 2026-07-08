"""
payments/paypal_client.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Thin helper around the PayPal REST v2 API.
Uses PAYPAL_CLIENT_ID, PAYPAL_SECRET, and PAYPAL_MODE from Django settings.

All public functions raise RuntimeError on unexpected HTTP failures so that
callers can catch a single exception type.
"""

import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Base URLs ──────────────────────────────────────────────────────────────

def _base() -> str:
    mode = getattr(settings, 'PAYPAL_MODE', 'sandbox').lower()
    return "https://api-m.paypal.com" if mode == 'live' else "https://api-m.sandbox.paypal.com"


# ── Token (no caching — fine for low traffic; add Redis cache for scale) ──

def _get_token() -> str:
    url = f"{_base()}/v1/oauth2/token"
    resp = requests.post(
        url,
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_SECRET),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json", "Accept-Language": "en_US"},
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"PayPal auth failed [{resp.status_code}]: {resp.text}")
    return resp.json()["access_token"]


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_get_token()}",
    }


# ── Order lifecycle ────────────────────────────────────────────────────────

def create_order(course, enrollment) -> dict:
    """
    Create a PayPal order and return the full response dict.
    The caller should extract ``id`` (order_id) and the ``approve`` link.
    """
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": f"enrollment_{enrollment.id}",
                "description": course.title[:127],
                "amount": {
                    "currency_code": "USD",
                    "value": f"{course.price:.2f}",
                },
            }
        ],
        "application_context": {
            "brand_name": "LearnHub",
            "landing_page": "LOGIN",
            "user_action": "PAY_NOW",
            "return_url": (
                f"{settings.FRONTEND_URL}/courses/{course.id}"
                f"?payment_success=true&gateway=paypal"
            ),
            "cancel_url": (
                f"{settings.FRONTEND_URL}/courses/{course.id}?payment_cancel=true"
            ),
        },
    }
    resp = requests.post(
        f"{_base()}/v2/checkout/orders",
        json=payload,
        headers=_headers(),
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"PayPal create order failed [{resp.status_code}]: {resp.text}")
    return resp.json()


def get_approve_url(order_data: dict) -> str:
    for link in order_data.get("links", []):
        if link.get("rel") == "approve":
            return link["href"]
    raise RuntimeError("PayPal order response missing 'approve' link.")


def capture_order(order_id: str) -> dict:
    """Capture an approved PayPal order. Returns the capture response dict."""
    resp = requests.post(
        f"{_base()}/v2/checkout/orders/{order_id}/capture",
        json={},
        headers=_headers(),
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"PayPal capture failed [{resp.status_code}]: {resp.text}")
    return resp.json()


def get_order(order_id: str) -> dict:
    resp = requests.get(
        f"{_base()}/v2/checkout/orders/{order_id}",
        headers=_headers(),
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"PayPal get order failed [{resp.status_code}]: {resp.text}")
    return resp.json()


def get_capture_id(order_id: str) -> str | None:
    """Return the first capture ID from a COMPLETED order, or None."""
    try:
        order_data = get_order(order_id)
        for pu in order_data.get("purchase_units", []):
            for capture in pu.get("payments", {}).get("captures", []):
                cap_id = capture.get("id")
                if cap_id:
                    return cap_id
    except Exception as exc:
        logger.warning("get_capture_id(%s) error: %s", order_id, exc)
    return None


def refund_capture(capture_id: str) -> dict:
    """Issue a full refund for a captured PayPal payment."""
    resp = requests.post(
        f"{_base()}/v2/payments/captures/{capture_id}/refund",
        json={},
        headers=_headers(),
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"PayPal refund failed [{resp.status_code}]: {resp.text}")
    return resp.json()
