"""GST utility helpers: GSTIN parsing, tax computation, number-to-words.

Indian GST 101:
- GSTIN is 15 chars: [2 state][10 PAN][1 entity][1 'Z'][1 checksum]
- State code 09 = Uttar Pradesh (the company in this session).
- Intra-state sale → split tax 50/50 into CGST + SGST.
- Inter-state sale → full rate as IGST (no split).
- Place of supply (POS) is the buyer's state; for B2C unregistered customer
  outside the supplier's state, IGST applies.
"""
from __future__ import annotations
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from num2words import num2words

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

# Indian state code → state name (subset for UI labels). Used for friendly
# place-of-supply display and same-state checks.
STATE_NAMES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "25": "Daman & Diu", "26": "Dadra & NH & Daman", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh",
    "38": "Ladakh", "97": "Other Territory",
}


def is_valid_gstin(gstin: str) -> bool:
    if not gstin:
        return False
    return bool(GSTIN_RE.match(gstin.strip().upper()))


def state_code_from_gstin(gstin: str | None) -> str | None:
    if not gstin or len(gstin) < 2:
        return None
    return gstin[:2]


def pan_from_gstin(gstin: str | None) -> str | None:
    if not gstin or len(gstin) < 12:
        return None
    return gstin[2:12]


def state_name(code: str | None) -> str:
    if not code:
        return "—"
    return STATE_NAMES.get(code, "Unknown")


def _q(x: Decimal | float | int) -> Decimal:
    """Quantise a money value to 2 decimal places (banker's rounding-half-up)."""
    return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_line_tax(
    rate: float,
    taxable: Decimal,
    intra_state: bool,
) -> dict:
    """Given a per-line GST rate and taxable amount, return tax split."""
    rate_d = Decimal(str(rate))
    total_tax = _q(taxable * rate_d / Decimal(100))
    if intra_state:
        half = _q(total_tax / 2)
        return {
            "cgst_rate": float(rate_d / 2),
            "sgst_rate": float(rate_d / 2),
            "igst_rate": 0.0,
            "cgst_amount": float(half),
            "sgst_amount": float(total_tax - half),  # absorbs rounding
            "igst_amount": 0.0,
            "tax_total": float(total_tax),
        }
    return {
        "cgst_rate": 0.0,
        "sgst_rate": 0.0,
        "igst_rate": float(rate_d),
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "igst_amount": float(total_tax),
        "tax_total": float(total_tax),
    }


def compute_doc_totals(items: Iterable[dict], supplier_state: str, place_of_supply: str) -> dict:
    """Crunch a doc's item list and return the GST footer block.

    Each input item must already have:
      hsn_code, name, qty, unit, rate (per-unit price before tax),
      discount_pct (0-100), gst_rate (e.g. 5/12/18), taxable (auto-computed if missing).

    Returns annotated `items[]` (with line-level tax fields) plus aggregated
    `totals` block: subtotal, total_discount, taxable, cgst, sgst, igst, round_off,
    grand_total, amount_in_words.
    """
    intra = bool(supplier_state) and bool(place_of_supply) and supplier_state == place_of_supply
    annotated: list[dict] = []
    sum_taxable = Decimal("0")
    sum_disc = Decimal("0")
    sum_cgst = Decimal("0")
    sum_sgst = Decimal("0")
    sum_igst = Decimal("0")

    for raw in items:
        qty = Decimal(str(raw.get("qty", 0)))
        rate = Decimal(str(raw.get("rate", 0)))
        gross = _q(qty * rate)
        disc_pct = Decimal(str(raw.get("discount_pct", 0)))
        disc_amt = _q(gross * disc_pct / Decimal(100))
        taxable = _q(gross - disc_amt)
        tax_split = compute_line_tax(float(raw.get("gst_rate", 0)), taxable, intra)
        line_total = _q(taxable + Decimal(str(tax_split["tax_total"])))

        annotated.append({
            "hsn_code": raw.get("hsn_code", ""),
            "name": raw.get("name", ""),
            "description": raw.get("description", ""),
            "qty": float(qty),
            "unit": raw.get("unit", "NOS"),
            "rate": float(rate),
            "discount_pct": float(disc_pct),
            "discount_amount": float(disc_amt),
            "taxable": float(taxable),
            "gst_rate": float(raw.get("gst_rate", 0)),
            "line_total": float(line_total),
            **tax_split,
        })
        sum_taxable += taxable
        sum_disc += disc_amt
        sum_cgst += Decimal(str(tax_split["cgst_amount"]))
        sum_sgst += Decimal(str(tax_split["sgst_amount"]))
        sum_igst += Decimal(str(tax_split["igst_amount"]))

    pre_round = sum_taxable + sum_cgst + sum_sgst + sum_igst
    rounded = pre_round.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    round_off = _q(rounded - pre_round)
    grand = pre_round + round_off

    return {
        "items": annotated,
        "totals": {
            "subtotal": float(_q(sum_taxable + sum_disc)),
            "total_discount": float(_q(sum_disc)),
            "taxable": float(_q(sum_taxable)),
            "cgst": float(_q(sum_cgst)),
            "sgst": float(_q(sum_sgst)),
            "igst": float(_q(sum_igst)),
            "tax_total": float(_q(sum_cgst + sum_sgst + sum_igst)),
            "round_off": float(round_off),
            "grand_total": float(_q(grand)),
            "amount_in_words": amount_in_words_inr(float(grand)),
            "intra_state": intra,
        },
    }


def amount_in_words_inr(amount: float) -> str:
    """Convert a number to Indian-English currency words."""
    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    words = num2words(rupees, lang="en_IN").title().replace(",", "")
    s = f"Rupees {words}"
    if paise:
        s += f" and {num2words(paise, lang='en_IN').title()} Paise"
    return s + " Only"


def fy_for(date: datetime | None = None) -> str:
    """India financial year string e.g. '2025-26' (April-March)."""
    d = date or datetime.now(timezone.utc)
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[-2:]}"
