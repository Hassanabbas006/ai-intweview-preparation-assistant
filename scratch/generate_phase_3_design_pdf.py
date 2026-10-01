import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []
    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()
    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI Interview Preparation Assistant — Phase 3 Design Audit")
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 750, "Evaluation, Mastery & Adaptive Difficulty")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 612 - 54, 742)
        self.setFont("Helvetica", 8)
        self.drawString(54, 36, "CONFIDENTIAL — PHASE 3 ARCHITECTURE DESIGN SPECIFICATION")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 612 - 54, 48)
        self.restoreState()

desktop_path = r"C:\Users\kamra\OneDrive\Desktop\Phase_3_Evaluation_Mastery_Design_Audit_Report.pdf"
doc = SimpleDocTemplate(desktop_path, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
styles = getSampleStyleSheet()
primary = colors.HexColor("#0F172A")
accent = colors.HexColor("#2563EB")
dark_gray = colors.HexColor("#334155")
light_bg = colors.HexColor("#F8FAFC")
border = colors.HexColor("#E2E8F0")

title_s = ParagraphStyle("T", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=primary)
sub_s = ParagraphStyle("Sub", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#475569"), spaceAfter=10)
h1_s = ParagraphStyle("H1", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=primary, spaceBefore=8, spaceAfter=3, keepWithNext=True)
h2_s = ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=accent, spaceBefore=5, spaceAfter=2, keepWithNext=True)
b_s = ParagraphStyle("B", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=dark_gray, spaceAfter=3)
bullet_s = ParagraphStyle("Bul", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=dark_gray, leftIndent=8, spaceAfter=1.5)
th_s = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=9.5, textColor=colors.white)
tc_s = ParagraphStyle("TC", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=9, textColor=dark_gray)
tc_b = ParagraphStyle("TCB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=primary)

story = []
story.append(Paragraph("Phase 3 Design Audit Report", title_s))
story.append(Paragraph("<b>Real-Time Evaluation, Candidate Mastery &amp; Adaptive Difficulty Architecture</b> (Read-Only Design)", sub_s))

meta_data = [
    [Paragraph("<b>Phase Scope:</b> Phase 3 Design Audit", tc_s), Paragraph("<b>Status:</b> APPROVED FOR IMPLEMENTATION", tc_s), Paragraph("<b>Evaluator Latency Impact:</b> 0ms on TTFT", tc_s)],
    [Paragraph("<b>Design Core:</b> Background Evaluator", tc_s), Paragraph("<b>Adaptive Model:</b> 2-Turn Hysteresis", tc_s), Paragraph("<b>LLM Pipeline:</b> Async Groq/Gemini", tc_s)],
]
meta_t = Table(meta_data, colWidths=[170, 170, 164])
meta_t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
    ("BOX", (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
    ("INNERGRID", (0,0), (-1,-1), 0.5, border),
    ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
]))
story.append(meta_t)
story.append(Spacer(1, 6))

story.append(Paragraph("1. Current-State Evaluation Audit: What Exists vs. Missing", h1_s))
story.append(Paragraph("&bull; <b>What Exists:</b> <code>services/evaluator.ts</code> (16-line stub), <code>InterviewSession.score</code> &amp; <code>InterviewReport</code> Prisma models, <code>ProgressionPolicyOptions.evaluationScoreOverride</code> orchestrator hook.<br/>&bull; <b>What is Missing:</b> Structured turn evaluation schema, track-specific rubrics, mastery accumulator, adaptive difficulty state machine, background async evaluator worker, and error recovery.", b_s))
story.append(Spacer(1, 4))

story.append(Paragraph("2. Asynchronous Evaluator &amp; Latency Architecture", h1_s))
story.append(Paragraph("<b>Zero-Latency Principle:</b> The candidate turn stream initiates <b>immediately</b> (&lt;300ms TTFT) using the deterministic Phase 2 orchestrator. Simultaneously, a non-blocking background promise invokes the evaluator LLM with strict JSON schema. The parsed evaluation updates session mastery and feeds the <i>subsequent</i> turn.", b_s))
story.append(Spacer(1, 4))

story.append(Paragraph("3. Rubric Dimensions by Interview Track", h1_s))
rubric_data = [
    [Paragraph("Interview Track", th_s), Paragraph("Core Rubric Dimensions (0–100)", th_s), Paragraph("Mastery Thresholds", th_s)],
    [Paragraph("Technical", tc_b), Paragraph("1. Architectural Soundness &bull; 2. Data Modeling &bull; 3. Concurrency &bull; 4. Fault Tolerance &bull; 5. Communication", tc_s), Paragraph("High: &ge;85<br/>Adequate: 60-84<br/>Gap: &lt;60", tc_s)],
    [Paragraph("HR / Behavioral", tc_b), Paragraph("1. Conflict De-escalation &bull; 2. Ownership &bull; 3. Collaboration &bull; 4. Adaptability &bull; 5. STAR Structure", tc_s), Paragraph("High: &ge;85<br/>Adequate: 60-84<br/>Gap: &lt;60", tc_s)],
    [Paragraph("Managerial", tc_b), Paragraph("1. Strategic Roadmapping &bull; 2. People Coaching &bull; 3. Executive Alignment &bull; 4. Team Topology &bull; 5. Crisis Command", tc_s), Paragraph("High: &ge;85<br/>Adequate: 60-84<br/>Gap: &lt;60", tc_s)],
]
rubric_t = Table(rubric_data, colWidths=[80, 310, 114])
rubric_t.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), primary),
    ("GRID", (0,0), (-1,-1), 0.5, border),
    ("TOPPADDING", (0,0), (-1,-1), 2.5), ("BOTTOMPADDING", (0,0), (-1,-1), 2.5),
    ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, light_bg]),
]))
story.append(rubric_t)
story.append(Spacer(1, 6))

story.append(Paragraph("4. Multi-Answer Adaptive Difficulty Algorithm (Hysteresis Model)", h1_s))
story.append(Paragraph("&bull; <b>Anti-Oscillation Rule:</b> Difficulty shifts require evidence across <b>&ge;2 consecutive substantive turns</b>.<br/>&bull; <b>Increase:</b> 2 consecutive turns with score &ge;85 and masterySignal == 'MASTERY_HIGH'.<br/>&bull; <b>Decrease:</b> 2 consecutive turns with score &le;45 and masterySignal == 'CRITICAL_GAP'.<br/>&bull; <b>Maintain:</b> Scores 46–84 or mixed signals. Maximum &plusmn;1 difficulty level delta per topic pillar.", b_s))
story.append(Spacer(1, 4))

story.append(Paragraph("5. Failure Handling &amp; Deterministic Fast-Path", h1_s))
story.append(Paragraph("&bull; <b>Deterministic Bypass:</b> Greetings, non-substantive replies, clarifications, and meta instructions skip LLM evaluation entirely (0 latency, 0 cost).<br/>&bull; <b>Evaluator Outage / Schema Fallback:</b> Malformed JSON or 4000ms timeout defaults safely to previous turn's difficulty without blocking candidate chat.<br/>&bull; <b>Phase 4 Final Report Readiness:</b> Accumulated turn evaluations pre-populate the final report without re-parsing transcripts.", b_s))

doc.build(story, canvasmaker=NumberedCanvas)
print("PHASE 3 DESIGN AUDIT PDF SAVED TO DESKTOP!")
