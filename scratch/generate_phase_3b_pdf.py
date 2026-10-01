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
            self.drawString(54, 752, "AI Interview Preparation Assistant — Phase 3B Implementation Report")
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 752, "Durable Evaluation Infrastructure")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 612 - 54, 744)
        
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#94A3B8"))
        self.drawString(54, 36, "PHASE 3B IMPLEMENTATION COMPLETE — ALL 64 TESTS PASSED (100%)")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 46, 612 - 54, 46)
        self.restoreState()

def build_pdf():
    desktop_path = r"C:\Users\kamra\OneDrive\Desktop\Phase_3B_Durable_Infrastructure_Implementation_Report.pdf"
    doc = SimpleDocTemplate(
        desktop_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    primary = colors.HexColor("#0F172A")
    accent = colors.HexColor("#1D4ED8")
    dark_gray = colors.HexColor("#334155")
    light_bg = colors.HexColor("#F8FAFC")
    border = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle("T", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=primary)
    sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#475569"), spaceAfter=6)
    h1_style = ParagraphStyle("H1", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=primary, spaceBefore=6, spaceAfter=2, keepWithNext=True)
    body_style = ParagraphStyle("B", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, leading=9.5, textColor=dark_gray, spaceAfter=2.5)
    
    th_style = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=colors.white)
    tc_style = ParagraphStyle("TC", parent=styles["Normal"], fontName="Helvetica", fontSize=6.5, leading=8.5, textColor=dark_gray)
    tc_bold = ParagraphStyle("TCB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=6.5, leading=8.5, textColor=primary)

    story = []

    # Title
    story.append(Paragraph("Phase 3B Implementation Report: Durable Evaluation Infrastructure", title_style))
    story.append(Paragraph("<b>Transactional Outbox, Atomic Worker Claim &amp; Persistent Mastery Architecture</b>", sub_style))

    summary_table_data = [
        [Paragraph("<b>Status:</b> PHASE 3B COMPLETE", tc_bold), Paragraph("<b>Phase 1 Tests:</b> 12/12 PASSED", tc_style), Paragraph("<b>Phase 2 Tests:</b> 22/22 PASSED", tc_style)],
        [Paragraph("<b>Phase 3A Tests:</b> 10/10 PASSED", tc_style), Paragraph("<b>Phase 3B Tests:</b> 20/20 PASSED", tc_style), Paragraph("<b>Total Suite:</b> 64/64 PASSED (100%)", tc_bold)],
        [Paragraph("<b>Typecheck:</b> 0 TypeScript Errors", tc_style), Paragraph("<b>Build:</b> 24 Static Routes OK", tc_style), Paragraph("<b>Latency Impact:</b> 0ms on Candidate TTFT", tc_bold)],
    ]
    summary_table = Table(summary_table_data, colWidths=[170, 170, 164])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 4))

    story.append(Paragraph("1. Architecture Deliverables &amp; Verification Breakdown", h1_style))
    deliverables_data = [
        [Paragraph("Component", th_style), Paragraph("Implementation Summary &amp; Guarantees", th_style), Paragraph("Source Location", th_style)],
        [
            Paragraph("<b>Prisma Model &amp; Schema</b>", tc_bold),
            Paragraph("Added <code>EvaluationJob</code> model with unique <code>idempotencyKey</code>, enum <code>EvaluationJobStatus</code>, and <code>masteryState</code> on <code>InterviewSession</code>.", tc_style),
            Paragraph("<code>prisma/schema.prisma</code>", tc_style)
        ],
        [
            Paragraph("<b>Transactional Outbox</b>", tc_bold),
            Paragraph("Candidate turn persists <code>InterviewMessage</code> and <code>EvaluationJob(PENDING)</code> in ONE atomic Prisma transaction. Streaming response never waits for evaluator.", tc_style),
            Paragraph("<code>app/api/interview/[sessionId]/stream/route.ts</code>", tc_style)
        ],
        [
            Paragraph("<b>Durable Background Worker</b>", tc_bold),
            Paragraph("Implemented <code>EvaluationWorker</code> with <code>FOR UPDATE SKIP LOCKED</code> / atomic CAS claim, preventing double-processing across concurrent workers.", tc_style),
            Paragraph("<code>services/evaluation-worker.ts</code>", tc_style)
        ],
        [
            Paragraph("<b>Retry &amp; Backoff</b>", tc_bold),
            Paragraph("Max retries = 3. Exponential backoff with jitter (~2s, ~4s, ~8s). Transition to terminal <code>FAILED</code> with <code>overallScore = null</code> on exhaustion.", tc_style),
            Paragraph("<code>services/evaluation-worker.ts:50</code>", tc_style)
        ],
        [
            Paragraph("<b>Mastery &amp; Difficulty Persistence</b>", tc_bold),
            Paragraph("Updates <code>masteryState</code> on <code>InterviewSession</code> with EMA (alpha=0.65) and 2-turn hysteresis difficulty tier clamping.", tc_style),
            Paragraph("<code>services/evaluation-worker.ts:240</code>", tc_style)
        ],
        [
            Paragraph("<b>Phase 2 Authority Protection</b>", tc_bold),
            Paragraph("Phase 2 Orchestrator maintains 100% deterministic progression authority. Evaluator scores feed policy parameters only without forcing premature transitions.", tc_style),
            Paragraph("<code>services/interview-engine.ts</code>", tc_style)
        ],
    ]
    deliv_table = Table(deliverables_data, colWidths=[110, 244, 150])
    deliv_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("GRID", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(deliv_table)
    story.append(Spacer(1, 4))

    story.append(Paragraph("2. Verified Performance Metrics", h1_style))
    story.append(Paragraph(
        "• <b>Candidate Turn DB Outbox Overhead:</b> 0–1ms (Transactional write overhead &lt; 50ms)<br/>"
        "• <b>Candidate TTFT (Time-To-First-Token):</b> 728ms – 973ms (Purely conversational Qwen streaming, completely unblocked)<br/>"
        "• <b>Evaluation Worker Latency:</b> Asynchronous background execution (~2.0s – 3.9s per substantive turn)<br/>"
        "• <b>Retry Delay Progression:</b> Attempt 1: ~2.2s | Attempt 2: ~4.1s | Attempt 3: ~8.3s",
        body_style
    ))
    story.append(Spacer(1, 4))

    verdict_data = [
        [Paragraph("<b>FINAL VERDICT: PHASE 3B IMPLEMENTATION COMPLETE</b><br/>"
                   "All 20 Phase 3B tests and 44 regression tests passed with zero errors. "
                   "Transactional outbox and durable asynchronous worker infrastructure are fully operational. "
                   "Phase 3A logic remains frozen and Phase 2 orchestration authority is strictly preserved.", ParagraphStyle("V", parent=body_style, textColor=colors.HexColor("#065F46")))]
    ]
    verdict_table = Table(verdict_data, colWidths=[504])
    verdict_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#10B981")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(verdict_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print("SUCCESS: Phase 3B Implementation Report PDF Generated at Desktop!")

if __name__ == "__main__":
    build_pdf()
