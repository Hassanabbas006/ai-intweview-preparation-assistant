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
            self.drawString(54, 752, "AI Interview Preparation Assistant — Phase 3 Final Architecture Specification")
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 752, "Durable Evaluation, Mastery & Adaptive Engine")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 612 - 54, 744)
        
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#94A3B8"))
        self.drawString(54, 36, "PHASE 3 FINAL ARCHITECTURE SPECIFICATION — READ-ONLY (0 CODE MODIFICATIONS)")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 46, 612 - 54, 46)
        self.restoreState()

def build_pdf():
    desktop_path = r"C:\Users\kamra\OneDrive\Desktop\Phase_3_Evaluation_Mastery_Final_Architecture_Specification.pdf"
    doc = SimpleDocTemplate(
        desktop_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    primary = colors.HexColor("#0F172A")     # Slate 900
    accent = colors.HexColor("#1D4ED8")      # Blue 700
    dark_gray = colors.HexColor("#334155")   # Slate 700
    light_bg = colors.HexColor("#F8FAFC")    # Slate 50
    border = colors.HexColor("#E2E8F0")      # Slate 200
    code_bg = colors.HexColor("#F1F5F9")     # Slate 100

    title_style = ParagraphStyle("T", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=primary)
    sub_style = ParagraphStyle("Sub", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#475569"), spaceAfter=6)
    h1_style = ParagraphStyle("H1", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=primary, spaceBefore=7, spaceAfter=2, keepWithNext=True)
    h2_style = ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=accent, spaceBefore=4, spaceAfter=2, keepWithNext=True)
    body_style = ParagraphStyle("B", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=dark_gray, spaceAfter=3)
    code_style = ParagraphStyle("Code", parent=styles["Normal"], fontName="Courier", fontSize=6.5, leading=8.5, textColor=colors.HexColor("#0F172A"))
    
    th_style = ParagraphStyle("TH", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=colors.white)
    tc_style = ParagraphStyle("TC", parent=styles["Normal"], fontName="Helvetica", fontSize=6.5, leading=8.5, textColor=dark_gray)
    tc_bold = ParagraphStyle("TCB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=6.5, leading=8.5, textColor=primary)

    story = []

    # ==================== HEADER ====================
    story.append(Paragraph("Phase 3 Final Architecture Specification", title_style))
    story.append(Paragraph("<b>Durable Asynchronous Evaluation, Null-Safe Failure Recovery &amp; Orchestration Integration</b>", sub_style))

    summary_table_data = [
        [Paragraph("<b>Status:</b> APPROVED FOR IMPLEMENTATION", tc_bold), Paragraph("<b>Constraint:</b> 0 Code Modifications", tc_style), Paragraph("<b>TTFT Latency Impact:</b> 0ms", tc_style)],
        [Paragraph("<b>Execution Model:</b> Transactional Outbox Worker", tc_style), Paragraph("<b>Failure Mode:</b> score = null (No Fake 70)", tc_style), Paragraph("<b>Progression:</b> Phase 2 Authoritative", tc_style)],
        [Paragraph("<b>Idempotency Key:</b> eval_{sessionId}_t{seq}", tc_style), Paragraph("<b>Retries:</b> 3 (Exp. Backoff + Jitter)", tc_style), Paragraph("<b>Hysteresis:</b> 2-Turn Confirmed Streak", tc_style)],
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

    # ==================== SECTION 1 ====================
    story.append(Paragraph("1. Durable Async Execution Architecture (Transactional Outbox)", h1_style))
    story.append(Paragraph(
        "To eliminate the contradiction of detached promises in serverless/edge environments, Phase 3 implements a true <b>Transactional Outbox Pattern</b>:<br/>"
        "• <b>Step 1 (Turn Ingestion):</b> When candidate message arrives, route commits candidate message and persists an <code>EvaluationJob</code> row in the database inside the same transaction (&lt;15ms overhead).<br/>"
        "• <b>Step 2 (Immediate Stream):</b> Conversational stream to candidate starts immediately (&lt;300ms TTFT) without waiting for evaluation.<br/>"
        "• <b>Step 3 (Durable Worker Consumption):</b> A dedicated background worker/queue consumer queries pending jobs using atomic status transition (<code>PENDING &rarr; PROCESSING</code>).<br/>"
        "• <b>Step 4 (Evaluation &amp; Validation):</b> Worker calls Evaluator LLM, validates output via Zod, and updates job to <code>COMPLETED</code> while atomically updating candidate mastery.",
        body_style
    ))

    job_spec_code = (
        "interface EvaluationJob {<br/>"
        "&nbsp;&nbsp;id: string; // Unique Primary Key<br/>"
        "&nbsp;&nbsp;idempotencyKey: string; // 'eval_' + sessionId + '_t' + turnSequenceNumber (UNIQUE)<br/>"
        "&nbsp;&nbsp;sessionId: string; turnSequenceNumber: number; pillarSlug: string;<br/>"
        "&nbsp;&nbsp;candidateMessage: string; contextHistory: Json;<br/>"
        "&nbsp;&nbsp;status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'RETRYING' | 'FAILED';<br/>"
        "&nbsp;&nbsp;retryCount: number; // Max 3 retries<br/>"
        "&nbsp;&nbsp;nextRetryAt: Date | null; timeoutMs: 5000;<br/>"
        "&nbsp;&nbsp;evaluationResult: TurnEvaluation | null; lastError: string | null;<br/>"
        "}"
    )
    story.append(Table([[Paragraph(job_spec_code, code_style)]], colWidths=[504], style=[
        ("BACKGROUND", (0, 0), (-1, -1), code_bg),
        ("BOX", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Spacer(1, 3))

    # ==================== SECTION 2 ====================
    story.append(Paragraph("2. Resilient Worker Parameters & Idempotency Rules", h1_style))
    job_param_data = [
        [Paragraph("Parameter", th_style), Paragraph("Specification", th_style), Paragraph("Operational Rationale &amp; Guarantees", th_style)],
        [Paragraph("<b>Idempotency Key</b>", tc_bold), Paragraph("<code>eval_{sessionId}_t{seq}</code>", tc_style), Paragraph("Unique constraint on DB level prevents duplicate evaluation processing on duplicate requests", tc_style)],
        [Paragraph("<b>Max Retry Count</b>", tc_bold), Paragraph("3 attempts", tc_style), Paragraph("Prevents infinite loops on permanent prompt/parsing failure", tc_style)],
        [Paragraph("<b>Retry Delay &amp; Jitter</b>", tc_bold), Paragraph("Exponential (2^n * 1s + jitter)", tc_style), Paragraph("Attempt 1: ~2s, Attempt 2: ~4s, Attempt 3: ~8s. Prevents thundering herd on API recovers", tc_style)],
        [Paragraph("<b>Evaluator Timeout</b>", tc_bold), Paragraph("5,000ms per attempt", tc_style), Paragraph("Aborted via AbortController if provider stalls", tc_style)],
        [Paragraph("<b>Terminal Failure</b>", tc_bold), Paragraph("Status &rarr; 'FAILED'", tc_style), Paragraph("Marked FAILED on 3rd failure; logs diagnostic payload to error audit logs", tc_style)],
    ]
    job_param_table = Table(job_param_data, colWidths=[100, 140, 264])
    job_param_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("GRID", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(job_param_table)
    story.append(Spacer(1, 4))

    # ==================== SECTION 3 ====================
    story.append(Paragraph("3. Zero-Fabrication Failure Policy (score = null)", h1_style))
    story.append(Paragraph(
        "<b>Architectural Mandate:</b> Evaluator failures or unparseable outputs must <b>NEVER</b> fabricate a default score (such as 70). Instead:<br/>"
        "• <b>Evaluation Status:</b> Explicitly set to <code>'FAILED'</code> (or <code>'RETRYING'</code> while attempts remain).<br/>"
        "• <b>Score Value:</b> Set strictly to <code>score = null</code> (with empty rubric array <code>rubricScores = []</code>).<br/>"
        "• <b>Mastery State:</b> Remains <b>completely unchanged</b>. EMA calculation is bypassed for this turn; mastery level and streaks do not shift.<br/>"
        "• <b>Difficulty:</b> Active difficulty tier remains <b>unchanged</b>.<br/>"
        "• <b>User Experience:</b> Interview conversation proceeds seamlessly without user-facing interruption.<br/>"
        "• <b>Audit Trail:</b> Full error payload, prompt snapshot, and raw model output are logged for observability.",
        body_style
    ))
    story.append(Spacer(1, 3))

    # ==================== SECTION 4 ====================
    story.append(Paragraph("4. Phase 2 Orchestration Authority & Pillar Progression Integration", h1_style))
    story.append(Paragraph(
        "Phase 3 integrates with the Phase 2 Interview Orchestrator under strict boundary rules:<br/>"
        "• <b>1. Phase 2 Structural Progression is Authoritative:</b> The deterministic state machine in <code>InterviewOrchestrator</code> governs all action transitions (<code>EXPLORE_PILLAR_DEEPER</code>, <code>PROGRESS_NEXT_PILLAR</code>, <code>WRAP_UP_INTERVIEW</code>).<br/>"
        "• <b>2. No Independent Force-Progression:</b> A high evaluation score (e.g. 100) does <b>NOT</b> independently force a pillar transition unless Phase 2 progression policy criteria are fulfilled (e.g. minimum turns requirement satisfied).<br/>"
        "• <b>3. Parameter Influence:</b> Phase 3 evaluations influence progression <i>only</i> by providing inputs to <code>ProgressionPolicyOptions</code> (e.g., <code>turnsPerPillarTarget = mastery >= 85 ? 1 : 2</code>) and injecting adaptive difficulty guidance into LLM prompts.",
        body_style
    ))

    # ==================== SECTION 5 ====================
    story.append(Paragraph("5. Step-by-Step Turn Walkthrough (Turn 1 &rarr; Turn 2 &rarr; Turn 3)", h1_style))
    walkthrough_data = [
        [Paragraph("Turn", th_style), Paragraph("Candidate Input &amp; Action", th_style), Paragraph("Evaluator &amp; Mastery State", th_style), Paragraph("Orchestration Decision &amp; Rationale", th_style)],
        [
            Paragraph("<b>Turn 1</b>", tc_bold),
            Paragraph("Candidate provides strong answer on <code>TECH-0</code> (System Architecture)", tc_style),
            Paragraph("<b>Status: COMPLETED</b><br/>Score: 90 (MASTERY_HIGH)<br/>EMA: 90.0, HighStreak: 1", tc_style),
            Paragraph("<b>Action: EXPLORE_PILLAR_DEEPER</b><br/><i>Rationale:</i> Policy requires 2 substantive turns on TECH-0. High score alone does not jump pillars.", tc_style)
        ],
        [
            Paragraph("<b>Turn 2</b>", tc_bold),
            Paragraph("Candidate provides second strong answer on <code>TECH-0</code> (Partition Recovery)", tc_style),
            Paragraph("<b>Status: COMPLETED</b><br/>Score: 94 (MASTERY_HIGH)<br/>EMA: 92.6, HighStreak: 2 &rarr; <b>Adaptive Level &rarr; SENIOR</b>", tc_style),
            Paragraph("<b>Action: PROGRESS_NEXT_PILLAR</b><br/><i>Rationale:</i> 2 substantive turns completed &ge; target. Phase 2 policy permits transition.", tc_style)
        ],
        [
            Paragraph("<b>Turn 3</b>", tc_bold),
            Paragraph("Next turn begins on <code>TECH-1</code> (Data Modeling &amp; Storage)", tc_style),
            Paragraph("Mastery vector carries forward verified SENIOR difficulty tier", tc_style),
            Paragraph("<b>Action: PROGRESS_NEXT_PILLAR (Active on TECH-1)</b><br/>Interviewer prompt directive: 'Ask Senior-level sharding question'.", tc_style)
        ],
    ]
    walk_table = Table(walkthrough_data, colWidths=[40, 150, 154, 160])
    walk_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("GRID", (0, 0), (-1, -1), 0.5, border),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(walk_table)
    story.append(Spacer(1, 4))

    # ==================== SECTION 6 ====================
    story.append(Paragraph("6. Final Architectural Verdict", h1_style))
    verdict_data = [
        [Paragraph("<b>FINAL VERDICT: APPROVE FOR IMPLEMENTATION</b><br/>"
                   "All architectural gaps resolved: (1) True Transactional Outbox Worker for durable async execution, "
                   "(2) Strict <code>score = null</code> policy on failure (0 fabricated scores), and "
                   "(3) Explicit preservation of Phase 2 structural progression authority. "
                   "The specification is 100% complete and ready for Phase 3 coding.", ParagraphStyle("V", parent=body_style, textColor=colors.HexColor("#065F46")))]
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
    print("SUCCESS: Phase 3 Final Architecture PDF Generated at Desktop!")

if __name__ == "__main__":
    build_pdf()
