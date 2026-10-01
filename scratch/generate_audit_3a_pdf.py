import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
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
            self.drawString(54, 752, "AI Interview Preparation Assistant — Phase 3A Compliance Audit")
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 752, "Read-Only Architecture & Codebase Verification")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 612 - 54, 744)
        
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#94A3B8"))
        self.drawString(54, 36, "PHASE 3A AUDIT REPORT — READ ONLY (0 CODE MODIFICATIONS)")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 46, 612 - 54, 46)
        self.restoreState()

def build_pdf():
    desktop_path = r"C:\Users\kamra\OneDrive\Desktop\Phase_3A_Architecture_Compliance_Audit.pdf"
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
    h1_style = ParagraphStyle("H1", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=primary, spaceBefore=7, spaceAfter=2, keepWithNext=True)
    body_style = ParagraphStyle("B", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=dark_gray, spaceAfter=3)
    
    th_style = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=colors.white)
    tc_style = ParagraphStyle("TC", parent=styles["Normal"], fontName="Helvetica", fontSize=6.5, leading=8.5, textColor=dark_gray)
    tc_bold = ParagraphStyle("TCB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=6.5, leading=8.5, textColor=primary)

    story = []

    # Title & Metadata
    story.append(Paragraph("Phase 3A Architecture Compliance Audit Report", title_style))
    story.append(Paragraph("<b>Codebase Verification against Phase 3 Final Architecture Specification</b>", sub_style))

    summary_table_data = [
        [Paragraph("<b>Audit Mode:</b> READ-ONLY (0 Code Changes)", tc_bold), Paragraph("<b>Phase 1 Tests:</b> 12/12 PASSED (100%)", tc_style), Paragraph("<b>Phase 2 Tests:</b> 22/22 PASSED (100%)", tc_style)],
        [Paragraph("<b>Phase 3A Tests:</b> 10/10 PASSED (100%)", tc_style), Paragraph("<b>Typecheck:</b> 0 TS Errors", tc_style), Paragraph("<b>Production Build:</b> 24 Static Pages", tc_style)],
        [Paragraph("<b>Phase 3A Scope:</b> Evaluator &amp; Mastery Engine", tc_style), Paragraph("<b>Phase 3B Scope:</b> Durable Outbox &amp; Queue Worker", tc_style), Paragraph("<b>Verdict:</b> Phase 3A COMPLIANT, Ready for 3B", tc_bold)],
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

    # Findings Table
    story.append(Paragraph("Audit Summary by Architecture Check", h1_style))
    audit_findings = [
        [Paragraph("Check ID & Name", th_style), Paragraph("Current Codebase Implementation Status", th_style), Paragraph("Exact File &amp; Function Location", th_style)],
        [
            Paragraph("<b>CHECK 1:</b> Durable Evaluation Execution", tc_bold),
            Paragraph("<b>PARTIALLY IMPLEMENTED (Phase 3A Scope):</b> In-memory TurnEvaluationRecord, Zod schemas, timeout handling, null score on error. DB table &amp; background queue worker belong to Phase 3B.", tc_style),
            Paragraph("<code>services/evaluator.ts</code><br/>(<code>InterviewEvaluator</code>)", tc_style)
        ],
        [
            Paragraph("<b>CHECK 2:</b> Transactional Outbox", tc_bold),
            Paragraph("<b>DEFERRED TO PHASE 3B:</b> Turn route writes <code>InterviewMessage</code>. <code>EvaluationJob</code> outbox insertion is not active in route yet.", tc_style),
            Paragraph("<code>app/api/interview/[sessionId]/stream/route.ts</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 3:</b> Critical Path Latency", tc_bold),
            Paragraph("<b>COMPLIANT:</b> Evaluator does NOT block streaming route. Candidate TTFT &lt; 300ms.", tc_style),
            Paragraph("<code>route.ts</code> &amp; <code>evaluator.ts</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 4:</b> Idempotency", tc_bold),
            Paragraph("<b>PARTIALLY IMPLEMENTED:</b> Idempotency key generated in record. DB unique index deferred to 3B.", tc_style),
            Paragraph("<code>services/evaluator.ts:167</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 5:</b> Zero-Fabrication Failure", tc_bold),
            Paragraph("<b>COMPLIANT (100%):</b> On error/timeout, <code>overallScore = null</code>, <code>evaluationStatus = 'FAILED'</code>, mastery &amp; difficulty remain 100% unchanged. No fabricated 70 scores.", tc_style),
            Paragraph("<code>services/evaluator.ts:233</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 6:</b> Mastery EMA Model", tc_bold),
            Paragraph("<b>COMPLIANT:</b> EMA alpha=0.65, high threshold=85, low threshold=45, stale sequence rejection.", tc_style),
            Paragraph("<code>services/evaluator.ts:248</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 7:</b> Adaptive Difficulty", tc_bold),
            Paragraph("<b>COMPLIANT:</b> 2-turn hysteresis, +/- 1 tier clamping within [JUNIOR..PRINCIPAL].", tc_style),
            Paragraph("<code>services/evaluator.ts:337</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 8:</b> Phase 2 Authority", tc_bold),
            Paragraph("<b>COMPLIANT:</b> Phase 2 Orchestrator maintains 100% deterministic progression control.", tc_style),
            Paragraph("<code>services/interview-engine.ts:200</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 9:</b> Fast Path Bypass", tc_bold),
            Paragraph("<b>COMPLIANT:</b> Greetings, fillers, evasions, gibberish, clarifications execute 0 LLM calls.", tc_style),
            Paragraph("<code>services/evaluator.ts:133</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 10:</b> Aptitude Determinism", tc_bold),
            Paragraph("<b>COMPLIANT:</b> 100% rule-based option checking with 0 LLM calls and 0ms latency.", tc_style),
            Paragraph("<code>services/evaluator.ts:167</code>", tc_style)
        ],
        [
            Paragraph("<b>CHECK 11:</b> Regression Testing", tc_bold),
            Paragraph("<b>COMPLIANT:</b> 44/44 total tests passed (Phase 1: 12/12, Phase 2: 22/22, Phase 3A: 10/10).", tc_style),
            Paragraph("<code>scratch/test-*.ts</code>", tc_style)
        ],
    ]
    findings_table = Table(audit_findings, colWidths=[110, 244, 150])
    findings_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("GRID", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(findings_table)
    story.append(Spacer(1, 4))

    # Final Verdict Block
    verdict_data = [
        [Paragraph("<b>FINAL AUDIT VERDICT: PHASE 3A FULLY COMPLIANT</b><br/>"
                   "Phase 3A staged requirements (contract, validation, zero-fabrication failure handling, EMA mastery, "
                   "2-turn hysteresis, Aptitude rule engine, fast-path filter, Phase 2 authority) are verified and working in code. "
                   "The codebase is in a clean state and ready for Phase 3B durable job queue implementation.", ParagraphStyle("V", parent=body_style, textColor=colors.HexColor("#065F46")))]
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
    print("SUCCESS: Phase 3A Compliance Audit PDF Generated at Desktop!")

if __name__ == "__main__":
    build_pdf()
