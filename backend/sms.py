"""Twilio SMS helper for HANSA app."""
import os
import logging

logger = logging.getLogger("hansa.sms")

try:
    from twilio.rest import Client as _TwilioClient
except Exception:
    _TwilioClient = None


def _get_client():
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token or not _TwilioClient:
        return None
    try:
        return _TwilioClient(sid, token)
    except Exception as e:
        logger.warning("Twilio init failed: %s", e)
        return None


def _ensure_e164(number: str) -> str:
    n = (number or "").strip()
    if not n:
        return ""
    if n.startswith("+"):
        return n
    digits = "".join(c for c in n if c.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if digits.startswith("91") and len(digits) >= 12:
        return "+" + digits
    return "+" + digits


def send_sms(to: str, body: str) -> dict:
    """Send SMS; returns {ok, sid|error}. Never raises."""
    to_e164 = _ensure_e164(to)
    frm = os.environ.get("TWILIO_FROM_NUMBER", "")
    client = _get_client()
    if not client or not frm or not to_e164:
        logger.info("SMS skipped (config missing) to=%s", to_e164)
        return {"ok": False, "error": "not_configured"}
    try:
        msg = client.messages.create(body=body[:1500], from_=frm, to=to_e164)
        return {"ok": True, "sid": msg.sid}
    except Exception as e:
        logger.warning("SMS send failed to %s: %s", to_e164, e)
        return {"ok": False, "error": str(e)}
