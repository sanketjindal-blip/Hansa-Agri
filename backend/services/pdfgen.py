"""PDF templates for billing documents (Quotation, Tax Invoice, etc.).

Built on ReportLab so every doc is a single A4 page (multi-page if items
overflow). Returns a bytes buffer the FastAPI route streams as application/pdf.
Templates intentionally use plain primitives — no external assets — so PDFs
generate fast and identically across hosts.
"""
from __future__ import annotations
from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, KeepTogether,
)

ACCENT = colors.HexColor("#F2A900")
DARK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
LIGHT = colors.HexColor("#F3F4F6")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontSize=18, textColor=DARK, alignment=1, spaceAfter=4, leading=22),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=11, textColor=DARK, spaceAfter=4),
        "small": ParagraphStyle("small", parent=base["Normal"], fontSize=8, textColor=MUTED, leading=11),
        "body": ParagraphStyle("body", parent=base["Normal"], fontSize=9, textColor=DARK, leading=12),
        "label": ParagraphStyle("label", parent=base["Normal"], fontSize=7, textColor=MUTED, leading=9, spaceAfter=1),
        "muted": ParagraphStyle("muted", parent=base["Normal"], fontSize=8, textColor=MUTED, leading=11),
        "right": ParagraphStyle("right", parent=base["Normal"], fontSize=9, textColor=DARK, alignment=2),
    }


def _addr_block(party: dict) -> str:
    """Renders an HTML-ish snippet for ReportLab Paragraph for a party block."""
    out = [f"<b>{(party.get('name') or '—')}</b>"]
    addr_parts = [party.get("address_line1"), party.get("address_line2"),
                  party.get("city"), party.get("state"),
                  party.get("pincode") and f"PIN {party.get('pincode')}"]
    out.append("<br/>".join([p for p in addr_parts if p]))
    if party.get("gstin"):
        out.append(f"<b>GSTIN</b>: {party['gstin']}")
    if party.get("pan"):
        out.append(f"<b>PAN</b>: {party['pan']}")
    if party.get("phone"):
        out.append(f"<b>Phone</b>: {party['phone']}")
    if party.get("email"):
        out.append(f"<b>Email</b>: {party['email']}")
    return "<br/>".join([s for s in out if s])


def _items_table(items: list[dict], styles, intra_state: bool):
    if intra_state:
        head = ["#", "Item / HSN", "Qty", "Rate", "Disc%", "Taxable", "CGST", "SGST", "Total"]
        col_widths = [8 * mm, 60 * mm, 10 * mm, 16 * mm, 12 * mm, 18 * mm, 22 * mm, 22 * mm, 24 * mm]
    else:
        head = ["#", "Item / HSN", "Qty", "Rate", "Disc%", "Taxable", "IGST", "Total"]
        col_widths = [8 * mm, 70 * mm, 10 * mm, 16 * mm, 12 * mm, 22 * mm, 28 * mm, 28 * mm]
    rows = [head]
    for i, it in enumerate(items, 1):
        item_lbl = f"<b>{it.get('name','')}</b>"
        if it.get("description"):
            item_lbl += f"<br/><font size=7 color='#6B7280'>{it['description']}</font>"
        if it.get("hsn_code"):
            item_lbl += f"<br/><font size=7 color='#6B7280'>HSN: {it['hsn_code']}</font>"
        qty_str = f"{it['qty']} {it.get('unit', '')}"
        rate = f"₹ {it['rate']:,.2f}"
        disc = f"{it['discount_pct']:.1f}%" if it["discount_pct"] else "—"
        tax_amt = f"₹ {it['taxable']:,.2f}"
        line_total = f"₹ {it['line_total']:,.2f}"
        if intra_state:
            cgst = f"₹ {it['cgst_amount']:,.2f}<br/><font size=6 color='#6B7280'>@ {it['cgst_rate']}%</font>"
            sgst = f"₹ {it['sgst_amount']:,.2f}<br/><font size=6 color='#6B7280'>@ {it['sgst_rate']}%</font>"
            row = [str(i), Paragraph(item_lbl, styles["body"]), qty_str, rate, disc, tax_amt,
                   Paragraph(cgst, styles["body"]), Paragraph(sgst, styles["body"]), line_total]
        else:
            igst = f"₹ {it['igst_amount']:,.2f}<br/><font size=6 color='#6B7280'>@ {it['igst_rate']}%</font>"
            row = [str(i), Paragraph(item_lbl, styles["body"]), qty_str, rate, disc, tax_amt,
                   Paragraph(igst, styles["body"]), line_total]
        rows.append(row)
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
    ]))
    return t


def _totals_block(totals: dict, styles):
    rows = []
    rows.append(["Subtotal", f"₹ {totals['subtotal']:,.2f}"])
    if totals["total_discount"]:
        rows.append(["Discount", f"– ₹ {totals['total_discount']:,.2f}"])
    rows.append(["Taxable amount", f"₹ {totals['taxable']:,.2f}"])
    if totals["intra_state"]:
        rows.append(["CGST", f"₹ {totals['cgst']:,.2f}"])
        rows.append(["SGST", f"₹ {totals['sgst']:,.2f}"])
    else:
        rows.append(["IGST", f"₹ {totals['igst']:,.2f}"])
    if totals["round_off"]:
        rows.append(["Round-off", f"₹ {totals['round_off']:,.2f}"])
    rows.append(["", ""])
    rows.append(["GRAND TOTAL", f"₹ {totals['grand_total']:,.2f}"])
    t = Table(rows, colWidths=[40 * mm, 35 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.6, DARK),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, DARK),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), ACCENT),
    ]))
    return t


def render_billing_doc(doc_kind: str, doc: dict, company: dict) -> bytes:
    """`doc_kind` ∈ {'quotation', 'invoice'}. Returns PDF bytes."""
    buf = BytesIO()
    width, height = A4
    margin = 14 * mm
    template = PageTemplate(
        id="main",
        frames=[Frame(margin, margin, width - 2 * margin, height - 2 * margin, showBoundary=0)],
    )
    pdf = BaseDocTemplate(buf, pagesize=A4, leftMargin=margin, rightMargin=margin,
                          topMargin=margin, bottomMargin=margin, title=doc.get("number", doc_kind))
    pdf.addPageTemplates([template])
    s = _styles()

    head_title = "QUOTATION" if doc_kind == "quotation" else "TAX INVOICE"
    company_block = _addr_block(company)
    bill_to = _addr_block({**(doc.get("buyer") or {}), "name": (doc.get("buyer") or {}).get("name")})
    ship_to_party = doc.get("ship_to") or doc.get("buyer") or {}
    ship_to = _addr_block(ship_to_party)

    meta_rows = [
        ["Document No.", doc.get("number", "—")],
        ["Date", _fmt_date(doc.get("date"))],
        ["Place of Supply", doc.get("place_of_supply") or "—"],
    ]
    if doc_kind == "quotation":
        meta_rows.append(["Valid Till", _fmt_date(doc.get("valid_till"))])
    if doc_kind == "invoice":
        if doc.get("po_number"):
            meta_rows.append(["P.O. Number", doc["po_number"]])
        if doc.get("transport_mode"):
            meta_rows.append(["Transport", doc.get("transport_mode")])
        if doc.get("vehicle_no"):
            meta_rows.append(["Vehicle No.", doc["vehicle_no"]])
        if doc.get("eway_bill_no"):
            meta_rows.append(["e-Way Bill", doc["eway_bill_no"]])
    meta_table = Table(meta_rows, colWidths=[28 * mm, 50 * mm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))

    party_rows = [
        [Paragraph("<b>From / Seller</b>", s["label"]),
         Paragraph("<b>Bill To</b>", s["label"]),
         Paragraph("<b>Ship To</b>", s["label"])],
        [Paragraph(company_block, s["body"]),
         Paragraph(bill_to, s["body"]),
         Paragraph(ship_to, s["body"])],
    ]
    party_table = Table(party_rows, colWidths=[60 * mm, 60 * mm, 60 * mm])
    party_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    party_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    items = doc.get("items") or []
    totals = doc.get("totals") or {}
    items_tbl = _items_table(items, s, bool(totals.get("intra_state")))

    notes_lines = []
    if totals.get("amount_in_words"):
        notes_lines.append(f"<b>Amount in words</b>: {totals['amount_in_words']}")
    if doc.get("notes"):
        notes_lines.append(f"<b>Notes</b>: {doc['notes']}")
    if doc.get("terms"):
        notes_lines.append(f"<b>Terms & Conditions</b>: {doc['terms']}")
    if doc_kind == "invoice" and company.get("bank_name"):
        notes_lines.append(
            f"<b>Bank</b>: {company.get('bank_name','')}, A/c {company.get('bank_account','')}, "
            f"IFSC {company.get('bank_ifsc','')} ({company.get('bank_branch','')})"
        )
    notes_para = Paragraph("<br/>".join(notes_lines), s["small"]) if notes_lines else None
    sig_block = Paragraph(
        f"<b>For {company.get('legal_name', '')}</b><br/><br/><br/>"
        "<font color='#6B7280'>Authorised Signatory</font>",
        s["small"],
    )
    foot_table = Table([[notes_para or "", sig_block]], colWidths=[110 * mm, 60 * mm])
    foot_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))

    # Header row: title on left, doc-meta block on right.
    title_para = Paragraph(head_title, s["title"])
    sub_para = Paragraph(f"<font color='#6B7280'>{company.get('legal_name','')}</font>", s["small"])
    title_cell = Table([[title_para], [sub_para]], colWidths=[110 * mm])
    title_cell.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    header_row = Table([[title_cell, meta_table]], colWidths=[110 * mm, 72 * mm])
    header_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    story = [
        header_row,
        Spacer(1, 8),
        party_table,
        Spacer(1, 6),
        items_tbl,
        Spacer(1, 4),
        Table([["", _totals_block(totals, s)]], colWidths=[105 * mm, 75 * mm]),
        Spacer(1, 4),
        foot_table,
    ]
    pdf.build(story)
    buf.seek(0)
    return buf.read()


def _fmt_date(s: str | None) -> str:
    if not s:
        return "—"
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d.strftime("%d %b %Y")
    except Exception:
        return s
