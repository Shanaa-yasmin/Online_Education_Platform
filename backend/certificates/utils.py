import os
import uuid
import math
import datetime
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .models import Certificate

# ── Colour palette ──────────────────────────────────────────────────────────
GOLD       = HexColor("#C9A84C")
GOLD_LIGHT = HexColor("#EDD98A")
PARCHMENT  = HexColor("#FFFDF5")
PARCHMENT2 = HexColor("#FDF8E8")
INK_DARK   = HexColor("#2C1A00")
INK_MID    = HexColor("#7A6030")
INK_LIGHT  = HexColor("#B8892A")

# ── Font registration (runs once per process) ────────────────────────────────
_FONTS_REGISTERED = False

def _register_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    fd = str(settings.CERT_FONTS_DIR)
    pdfmetrics.registerFont(TTFont("Playfair",     os.path.join(fd, "PlayfairDisplay-VariableFont_wght.ttf")))
    pdfmetrics.registerFont(TTFont("Lora",         os.path.join(fd, "Lora-VariableFont_wght.ttf")))
    pdfmetrics.registerFont(TTFont("LoraItalic",   os.path.join(fd, "Lora-Italic-VariableFont_wght.ttf")))
    pdfmetrics.registerFont(TTFont("LibSerifBold", os.path.join(fd, "LiberationSerif-Bold.ttf")))
    _FONTS_REGISTERED = True


# ── Drawing helpers ──────────────────────────────────────────────────────────

def _border(c, W, H):
    for margin, lw in [(10, 1.4), (17, 0.4), (22, 0.4)]:
        c.setStrokeColor(GOLD)
        c.setLineWidth(lw)
        c.rect(margin, margin, W - 2 * margin, H - 2 * margin)


def _corner(c, cx, cy, angle):
    c.saveState()
    c.translate(cx, cy)
    c.rotate(angle)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.0)
    c.lines([(0, 0, 0, 42), (0, 0, 42, 0)])
    c.setLineWidth(0.4)
    c.lines([(8, 8, 8, 33), (8, 8, 33, 8)])
    c.saveState()
    c.translate(8, 8)
    c.rotate(45)
    c.setFillColor(GOLD)
    c.rect(-3.5, -3.5, 7, 7, fill=1, stroke=0)
    c.restoreState()
    c.restoreState()


def _rule(c, cx, cy, half_width):
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.5)
    c.line(cx - half_width, cy, cx - 12, cy)
    c.line(cx + 12, cy, cx + half_width, cy)
    c.saveState()
    c.translate(cx, cy)
    c.rotate(45)
    c.setFillColor(GOLD)
    c.rect(-4.5, -4.5, 9, 9, fill=1, stroke=0)
    c.restoreState()


def _thin_rule(c, cx, cy, half_width):
    c.setStrokeColor(GOLD_LIGHT)
    c.setLineWidth(0.4)
    c.line(cx - half_width, cy, cx + half_width, cy)


def _seal(c, cx, cy, r=36):
    c.setFillColor(HexColor("#F9F0D8"))
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    pts = []
    for i in range(24):
        ang    = math.radians(i * 15 - 90)
        radius = r if i % 2 == 0 else r * 0.54
        pts.append((cx + radius * math.cos(ang), cy + radius * math.sin(ang)))
    path = c.beginPath()
    path.moveTo(*pts[0])
    for pt in pts[1:]:
        path.lineTo(*pt)
    path.close()
    c.drawPath(path, fill=1, stroke=1)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.45)
    c.circle(cx, cy, r * 0.47, fill=0, stroke=1)
    c.setFillColor(INK_LIGHT)
    c.setFont("Lora", 6)
    c.drawCentredString(cx, cy + 7, "CERTIFIED")
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.3)
    c.setLineCap(1)
    c.lines([
        (cx - 8, cy - 3, cx - 3, cy - 9),
        (cx - 3, cy - 9, cx + 9, cy + 3),
    ])


# ── Main function ────────────────────────────────────────────────────────────

def generate_certificate_pdf(enrollment):
    """
    Generate a Classic Gold landscape PDF certificate for a completed enrollment.

    Idempotent — returns the existing Certificate if one was already issued.
    Requires enrollment.progress_percent == 100.
    """
    if getattr(enrollment, "progress_percent", 0) < 100:
        raise ValueError("Enrollment progress is not complete; cannot generate certificate.")

    try:
        return enrollment.certificate
    except Certificate.DoesNotExist:
        pass

    _register_fonts()

    student      = enrollment.student
    course       = enrollment.course
    display_name = student.get_full_name().strip() or student.username
    date_str     = datetime.datetime.now().strftime("%B %d, %Y")
    cert_code    = str(uuid.uuid4()).replace("-", "").upper()[:20]

    certificates_dir = os.path.join(settings.MEDIA_ROOT, "certificates")
    os.makedirs(certificates_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    filename  = f"certificate_{enrollment.id}_{timestamp}.pdf"
    file_path = os.path.join(certificates_dir, filename)

    # Landscape Letter: 792 × 612 pt
    c = canvas.Canvas(file_path, pagesize=letter)
    w, h = letter
    c.setPageSize((h, w))
    W, H = h, w
    cx   = W / 2

    # 1. Parchment background
    c.setFillColor(PARCHMENT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(PARCHMENT2)
    c.rect(28, 28, W - 56, H - 56, fill=1, stroke=0)

    # Triple gold border
    _border(c, W, H)

    # Corner ornaments
    _corner(c, 22,      H - 22,  0)
    _corner(c, W - 22,  H - 22,  -90)
    _corner(c, 22,      22,       90)
    _corner(c, W - 22,  22,       180)

    # Academy eyebrow + thin rule
    c.setFillColor(INK_LIGHT)
    c.setFont("Lora", 8)
    c.drawCentredString(cx, H - 60, "LEARNHUB ACADEMY", charSpace=4)
    _thin_rule(c, cx, H - 70, 100)

    # Main title — Playfair Display
    c.setFillColor(INK_DARK)
    c.setFont("Playfair", 38)
    c.drawCentredString(cx, H - 108, "Certificate of Completion")

    # Gold rule under title
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.6)
    c.line(cx - 230, H - 120, cx + 230, H - 120)

    # Diamond separator
    _rule(c, cx, H - 155, 150)

    # "This is to certify that" — Lora Italic
    c.setFillColor(INK_MID)
    c.setFont("LoraItalic", 12)
    c.drawCentredString(cx, H - 188, "This is to certify that")

    # Student name — Playfair Display large
    c.setFillColor(INK_DARK)
    c.setFont("Playfair", 32)
    c.drawCentredString(cx, H - 230, display_name)
    name_w = c.stringWidth(display_name, "Playfair", 32)
    c.setStrokeColor(GOLD_LIGHT)
    c.setLineWidth(0.9)
    c.line(cx - name_w / 2, H - 237, cx + name_w / 2, H - 237)

    # "has successfully completed" — Lora Italic
    c.setFillColor(INK_MID)
    c.setFont("LoraItalic", 12)
    c.drawCentredString(cx, H - 265, "has successfully completed the course")

    # Course title — Liberation Serif Bold (wraps if > 580pt)
    c.setFillColor(INK_DARK)
    c.setFont("LibSerifBold", 16)
    if c.stringWidth(course.title, "LibSerifBold", 16) > 580:
        words = course.title.split()
        mid   = len(words) // 2
        c.drawCentredString(cx, H - 293, " ".join(words[:mid]))
        c.drawCentredString(cx, H - 313, " ".join(words[mid:]))
        course_bottom_y = H - 313
    else:
        c.drawCentredString(cx, H - 293, course.title)
        course_bottom_y = H - 293

    # Second diamond separator
    _rule(c, cx, course_bottom_y - 30, 120)

    # Footer — date · seal · certificate ID
    fy = 48

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.5)
    c.line(55, fy + 24, 185, fy + 24)
    c.setFillColor(INK_DARK)
    c.setFont("Lora", 9.5)
    c.drawCentredString(120, fy + 13, date_str)
    c.setFillColor(INK_LIGHT)
    c.setFont("Lora", 6.5)
    c.drawCentredString(120, fy + 2, "DATE ISSUED", charSpace=2)

    _seal(c, cx, fy + 16)

    c.setStrokeColor(GOLD)
    c.setLineWidth(0.5)
    c.line(W - 185, fy + 24, W - 55, fy + 24)
    c.setFillColor(INK_DARK)
    c.setFont("Lora", 9.5)
    c.drawCentredString(W - 120, fy + 13, cert_code)
    c.setFillColor(INK_LIGHT)
    c.setFont("Lora", 6.5)
    c.drawCentredString(W - 120, fy + 2, "CERTIFICATE ID", charSpace=2)

    c.showPage()
    c.save()

    cert = Certificate.objects.create(
        enrollment=enrollment,
        student=student,
        course=course,
        certificate_code=cert_code,
        pdf_file=os.path.join("certificates", filename),
    )
    return cert
