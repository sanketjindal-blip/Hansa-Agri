"""Misc helpers used across routes."""


def strip_id(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def normalize_phone(p: str) -> str:
    p = (p or "").strip().replace(" ", "").replace("-", "")
    if not p:
        return ""
    if p.startswith("+"):
        return p
    digits = "".join(c for c in p if c.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if digits.startswith("91") and len(digits) >= 12:
        return "+" + digits
    return "+" + digits
