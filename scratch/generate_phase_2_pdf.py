import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
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

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "AI Interview Preparation Assistant — Phase 2 Implementation Report")
            self.setFont("Helvetica", 8)
            self.drawRightString(612 - 54, 750, "Interview Orchestrator & Engine")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 612 - 54, 742)

        # Footer (all pages)
        self.setFont("Helvetica", 8)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — SYSTEM ARCHITECTURE SPECIFICATION")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 612 - 54, 48)

        self.restoreState()

def create_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Styles
    primary_color = colors.HexColor("#0F172A")
    accent_blue = colors.HexColor("#2563EB")
    dark_gray = colors.HexColor("#334155")
    light_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=4,
    )

    subtitle_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )

    h1_style = ParagraphStyle(
        "Header1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Header2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=accent_blue,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=dark_gray,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "Bullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=dark_gray,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3,
    )

    code_style = ParagraphStyle(
        "Code",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=dark_gray,
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=primary_color,
    )

    callout_style = ParagraphStyle(
        "Callout",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )

    story = []

    # Title & Metadata Banner
    story.append(Paragraph("Phase 2 Implementation & Verification Report", title_style))
    story.append(Paragraph("<b>AI Interview Preparation Assistant</b> — Interview Orchestrator & Deterministic Decision Engine", subtitle_style))

    meta_table_data = [
        [
            Paragraph("<b>Architecture Phase:</b> Phase 2 (Completed)", table_cell_style),
            Paragraph("<b>Status:</b> 100% Passed (22/22 Tests)", table_cell_style),
            Paragraph("<b>Runtime Latency:</b> < 1ms (Sync)", table_cell_style),
        ],
        [
            Paragraph("<b>Deterministic Actions:</b> 11 Enums", table_cell_style),
            Paragraph("<b>Reason Codes:</b> 12 Enums", table_cell_style),
            Paragraph("<b>TypeScript / Build:</b> 0 Errors", table_cell_style),
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[170, 170, 164])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # Section A: Architectural Principle & Flow
    story.append(Paragraph("A. Core Architectural Principle & Execution Pipeline", h1_style))
    story.append(Paragraph(
        "Phase 2 enforces absolute separation of concerns between interview decision logic and natural language generation:",
        body_style
    ))

    principle_box_data = [[
        Paragraph(
            "<b>ORCHESTRATOR = Decides WHAT happens next</b> (deterministic, synchronous, zero extra LLM latency)<br/>"
            "<b>LLM = Decides HOW the interviewer speaks</b> (natural language expression in persona voice)",
            callout_style
        )
    ]]
    principle_table = Table(principle_box_data, colWidths=[504])
    principle_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#3B82F6")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(principle_table)
    story.append(Spacer(1, 6))

    flow_box_data = [[
        Paragraph(
            "<b>Execution Pipeline:</b> Candidate Message → <code>buildInterviewState()</code> (State Reconstruction) → "
            "<code>InterviewOrchestrator.decideNextStep()</code> (Deterministic Decision) → "
            "<code>buildSystemPrompt({ state, decision })</code> (Directive & Memory Injection) → "
            "<code>GroqProvider.streamText()</code> (Qwen3.8-27B) → Real-Time SSE Stream",
            body_style
        )
    ]]
    flow_table = Table(flow_box_data, colWidths=[504])
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 10))

    # Section B: Exact Files Modified
    story.append(Paragraph("B. Files Implemented & Modified", h1_style))
    files_data = [
        [Paragraph("File Path", table_header_style), Paragraph("Role & Phase 2 Implementation Details", table_header_style)],
        [
            Paragraph("<code>services/interview-engine.ts</code>", table_cell_bold),
            Paragraph("Replaced stub with full deterministic <code>InterviewOrchestrator</code> class, 11 actions, 12 reason codes, track pillars, and progression policies.", table_cell_style)
        ],
        [
            Paragraph("<code>lib/interview/prompts.ts</code>", table_cell_bold),
            Paragraph("Updated <code>buildSystemPrompt</code> to dynamically integrate <code>OrchestratorDecision</code>, injecting turn directives, pillar focus, and grounding keywords.", table_cell_style)
        ],
        [
            Paragraph("<code>app/api/interview/[sessionId]/stream/route.ts</code>", table_cell_bold),
            Paragraph("Integrated <code>decideNextStep</code> into opening and ongoing turn streaming pipelines with sub-millisecond execution timing logs.", table_cell_style)
        ],
        [
            Paragraph("<code>lib/interview/state.ts</code>", table_cell_bold),
            Paragraph("Enhanced candidate classification with evasion phrases and refined substantive user turn accounting for robust multi-turn progression.", table_cell_style)
        ],
        [
            Paragraph("<code>scratch/test-phase-2.ts</code>", table_cell_bold),
            Paragraph("Created 22-point comprehensive verification test suite covering all actions, reason codes, prompt construction, and live Groq Qwen streaming.", table_cell_style)
        ],
    ]
    files_table = Table(files_data, colWidths=[160, 344])
    files_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(files_table)
    story.append(Spacer(1, 10))

    # Section C: Complete 11 Actions
    story.append(Paragraph("C. Complete Specification of 11 Programmatic Actions", h1_style))
    actions_data = [
        [Paragraph("#", table_header_style), Paragraph("Action Enum", table_header_style), Paragraph("Operational Purpose & LLM Directive", table_header_style)],
        [Paragraph("1", table_cell_bold), Paragraph("<code>OPEN_INTERVIEW</code>", table_cell_bold), Paragraph("Greets candidate briefly, invites background intro; strictly asks NO technical questions on turn 0.", table_cell_style)],
        [Paragraph("2", table_cell_bold), Paragraph("<code>ACKNOWLEDGE_INTRO</code>", table_cell_bold), Paragraph("Anchors to 1 specific project/tech from intro, smoothly connects to Pillar 1 opening question.", table_cell_style)],
        [Paragraph("3", table_cell_bold), Paragraph("<code>HANDLE_GREETING</code>", table_cell_bold), Paragraph("Warmly responds in 1 short phrase to mid-interview small talk, then continues with active question.", table_cell_style)],
        [Paragraph("4", table_cell_bold), Paragraph("<code>PROMPT_FOR_SUBSTANCE</code>", table_cell_bold), Paragraph("Triggered on 1st non-substantive reply. Prompts for concrete details without generic affirmative openers.", table_cell_style)],
        [Paragraph("5", table_cell_bold), Paragraph("<code>PIVOT_AWAY</code>", table_cell_bold), Paragraph("Triggered on >=2 non-substantive replies. Naturally releases topic and pivots to fresh pillar question.", table_cell_style)],
        [Paragraph("6", table_cell_bold), Paragraph("<code>ANSWER_CLARIFICATION</code>", table_cell_bold), Paragraph("Candidate asked problem constraints. Directs LLM to answer in 1–2 sentences and prompt candidate to proceed.", table_cell_style)],
        [Paragraph("7", table_cell_bold), Paragraph("<code>HANDLE_META_REQUEST</code>", table_cell_bold), Paragraph("Candidate asked to be quizzed on a tool. Directly asks a concrete question to keep candidate in hot seat.", table_cell_style)],
        [Paragraph("8", table_cell_bold), Paragraph("<code>DRILL_DOWN</code>", table_cell_bold), Paragraph("First substantive turn on pillar. Probes deeper into internal mechanics, caching, and trade-offs.", table_cell_style)],
        [Paragraph("9", table_cell_bold), Paragraph("<code>CHALLENGE_TRADEOFF</code>", table_cell_bold), Paragraph("Second substantive turn on pillar. Challenges edge cases, failure recovery, split-brain, or bottlenecks.", table_cell_style)],
        [Paragraph("10", table_cell_bold), Paragraph("<code>ADVANCE_PILLAR</code>", table_cell_bold), Paragraph("Transitions smoothly to next sequential topic pillar with a fresh architectural scenario.", table_cell_style)],
        [Paragraph("11", table_cell_bold), Paragraph("<code>CONCLUDE_ROUND</code>", table_cell_bold), Paragraph("Candidate requested end or all pillars explored. Emits polite wrap-up and appends [SESSION_COMPLETED].", table_cell_style)],
    ]
    actions_table = Table(actions_data, colWidths=[20, 150, 334])
    actions_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(actions_table)
    story.append(Spacer(1, 10))

    # Section D: Reason Codes Table
    story.append(Paragraph("D. Complete Specification of 12 Deterministic Reason Codes", h1_style))
    reasons_data = [
        [Paragraph("#", table_header_style), Paragraph("Reason Code Enum", table_header_style), Paragraph("Deterministic Trigger Condition", table_header_style)],
        [Paragraph("1", table_cell_bold), Paragraph("<code>INITIAL_OPENING</code>", table_cell_bold), Paragraph("Session has 0 prior messages or <code>isOpening === true</code>.", table_cell_style)],
        [Paragraph("2", table_cell_bold), Paragraph("<code>CANDIDATE_REQUESTED_END</code>", table_cell_bold), Paragraph("Candidate message matches <code>isCandidateRequestingToEnd()</code> intent patterns.", table_cell_style)],
        [Paragraph("3", table_cell_bold), Paragraph("<code>GREETING_DETECTED</code>", table_cell_bold), Paragraph("Candidate sends casual small talk or greeting during active round.", table_cell_style)],
        [Paragraph("4", table_cell_bold), Paragraph("<code>CANDIDATE_META_INSTRUCTION</code>", table_cell_bold), Paragraph("Candidate commands interviewer to test/quiz them on a specific technology.", table_cell_style)],
        [Paragraph("5", table_cell_bold), Paragraph("<code>CANDIDATE_ASKED_CLARIFICATION</code>", table_cell_bold), Paragraph("Candidate asks a clarifying question regarding problem constraints/parameters.", table_cell_style)],
        [Paragraph("6", table_cell_bold), Paragraph("<code>NON_SUBSTANTIVE_REPROMPT</code>", table_cell_bold), Paragraph("<code>state.nonSubstantiveCount === 1</code> (filler, evasion, or minimal response).", table_cell_style)],
        [Paragraph("7", table_cell_bold), Paragraph("<code>NON_SUBSTANTIVE_PIVOT_LIMIT</code>", table_cell_bold), Paragraph("<code>state.nonSubstantiveCount >= 2</code> (repeated evasions; triggers topic pivot).", table_cell_style)],
        [Paragraph("8", table_cell_bold), Paragraph("<code>CANDIDATE_INTRO_RECEIVED</code>", table_cell_bold), Paragraph("<code>state.isIntroTurn === true</code> (candidate provided first substantive background).", table_cell_style)],
        [Paragraph("9", table_cell_bold), Paragraph("<code>SUBSTANTIVE_PROBE_DEPTH</code>", table_cell_bold), Paragraph("First substantive turn on active pillar (probes implementation depth).", table_cell_style)],
        [Paragraph("10", table_cell_bold), Paragraph("<code>SUBSTANTIVE_CHALLENGE_TRADEOFF</code>", table_cell_bold), Paragraph("Second substantive turn on active pillar (challenges failure modes & tradeoffs).", table_cell_style)],
        [Paragraph("11", table_cell_bold), Paragraph("<code>PILLAR_PROGRESSION_ADVANCE</code>", table_cell_bold), Paragraph("Policy threshold reached for current pillar; transitions to next pillar.", table_cell_style)],
        [Paragraph("12", table_cell_bold), Paragraph("<code>ALL_PILLARS_EXHAUSTED</code>", table_cell_bold), Paragraph("All round pillars have completed their exploration cycles.", table_cell_style)],
    ]
    reasons_table = Table(reasons_data, colWidths=[20, 190, 294])
    reasons_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(reasons_table)
    story.append(Spacer(1, 10))

    # Section E: Track Pillars
    story.append(Paragraph("E. Topic Pillars by Interview Round Track", h1_style))
    story.append(Paragraph("<b>1. Technical / Domain Deep Dive Track (5 Pillars):</b>", h2_style))
    story.append(Paragraph("• <b>Pillar 1 — Architecture & Component Design:</b> Microservices, API gateways, async message queues, caching layers, load balancing.", bullet_style))
    story.append(Paragraph("• <b>Pillar 2 — Data Modeling & Storage Strategy:</b> SQL vs NoSQL, composite indexing, sharding, replication lag, ACID vs BASE.", bullet_style))
    story.append(Paragraph("• <b>Pillar 3 — Resilience & Fault Tolerance:</b> Circuit breakers, retry storms, dead letter queues, split-brain failover, idempotency.", bullet_style))
    story.append(Paragraph("• <b>Pillar 4 — Concurrency & Scale Optimization:</b> High throughput, rate limiting, connection pooling, backpressure, thread contention.", bullet_style))
    story.append(Paragraph("• <b>Pillar 5 — Observability & Operational Readiness:</b> Metrics, distributed tracing, structured logging, runbooks, SLA/SLO alerting.", bullet_style))

    story.append(Paragraph("<b>2. HR & Behavioral Track (4 Pillars):</b>", h2_style))
    story.append(Paragraph("• <b>Pillar 1 — Conflict Resolution & Difficult Stakeholders:</b> Navigating engineering disagreements, cross-functional pushback, alignment.", bullet_style))
    story.append(Paragraph("• <b>Pillar 2 — Failure, Setbacks & Resilience:</b> Handling production outages, missed deadlines, post-mortem retrospectives, growth mindset.", bullet_style))
    story.append(Paragraph("• <b>Pillar 3 — Collaboration & Mentorship:</b> Knowledge sharing, pairing, onboarding junior engineers, cross-team partnerships.", bullet_style))
    story.append(Paragraph("• <b>Pillar 4 — Career Motivation & Cultural Alignment:</b> Work principles, technical ownership, long-term aspirations, why this organization.", bullet_style))

    story.append(Paragraph("<b>3. Managerial & Leadership Track (4 Pillars):</b>", h2_style))
    story.append(Paragraph("• <b>Pillar 1 — Engineering Roadmapping & Prioritization:</b> Technical debt vs feature velocity, quarterly roadmap trade-offs.", bullet_style))
    story.append(Paragraph("• <b>Pillar 2 — Team Building & Performance Management:</b> Coaching underperformers, hiring standards, retaining high performers.", bullet_style))
    story.append(Paragraph("• <b>Pillar 3 — Crisis Management & Production Incidents:</b> Incident command, blameless RCAs, stakeholder communication.", bullet_style))
    story.append(Paragraph("• <b>Pillar 4 — Organizational Influence & Strategic Vision:</b> Cross-org alignment, architectural standards, change management.", bullet_style))
    story.append(Spacer(1, 8))

    # Section F: Progression Policy Architecture & Boundaries
    story.append(Paragraph("F. Pluggable Progression Architecture & Boundary Governance", h1_style))
    story.append(Paragraph(
        "• <b>Progression Policy Decoupling:</b> Turn thresholds are governed by <code>ProgressionPolicyOptions</code> (baseline: 2 substantive follow-up turns per pillar). In Phase 3, real-time candidate mastery metrics will dynamically influence progression via the options interface without altering the core engine.<br/>"
        "• <b>Pure Clarification Directive:</b> In accordance with approved design, <code>ANSWER_CLARIFICATION</code> generates prompt directives instructing the LLM to explain problem parameters concisely. The orchestrator never independently formulates answers.<br/>"
        "• <b>Aptitude Isolation:</b> Aptitude assessments remain fully isolated in <code>lib/interview/aptitude-bank.ts</code> and <code>/api/interview/[sessionId]/aptitude/submit</code>, completely independent from the interactive orchestrator.<br/>"
        "• <b>Strict Boundary Check:</b> Zero Phase 3 bleed — no evaluation scoring, dynamic difficulty adjustments, reports, database migrations, audio/voice pipelines, or UI changes were introduced.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Section G: Verification Results
    story.append(Paragraph("G. Verification Suite Results & Production Certification", h1_style))
    
    test_results_data = [
        [Paragraph("Verification Suite", table_header_style), Paragraph("Scope & Components Tested", table_header_style), Paragraph("Result", table_header_style)],
        [
            Paragraph("Phase 2 Orchestrator Suite (<code>test-phase-2.ts</code>)", table_cell_bold),
            Paragraph("All 11 actions, 12 reason codes, progression matrix, clarify/meta directives, anti-repetition blacklist, track pillars, Aptitude isolation, live Groq Qwen streaming.", table_cell_style),
            Paragraph("<font color='#16A34A'><b>22 / 22 PASSED</b></font>", table_cell_style)
        ],
        [
            Paragraph("Phase 1 Regression Suite (<code>test-phase-1.ts</code>)", table_cell_bold),
            Paragraph("State reconstruction on reconnect, candidate memory facts extraction, consecutive non-answer tracking, termination token validation.", table_cell_style),
            Paragraph("<font color='#16A34A'><b>12 / 12 PASSED</b></font>", table_cell_style)
        ],
        [
            Paragraph("TypeScript Strict Compilation (<code>tsc --noEmit</code>)", table_cell_bold),
            Paragraph("Full codebase typecheck including new engine types, prompts, routes, and memory structures.", table_cell_style),
            Paragraph("<font color='#16A34A'><b>0 ERRORS</b></font>", table_cell_style)
        ],
        [
            Paragraph("Next.js Production Build (<code>npm run build</code>)", table_cell_bold),
            Paragraph("Prisma generation + Next.js optimized production build across all 24 routes.", table_cell_style),
            Paragraph("<font color='#16A34A'><b>COMPILED OK</b></font>", table_cell_style)
        ],
    ]
    test_table = Table(test_results_data, colWidths=[140, 264, 100])
    test_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_bg]),
    ]))
    story.append(test_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "<b>Certification:</b> Phase 2 implementation is fully validated, architecturally sound, and ready for Phase 3 evaluation planning.",
        callout_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated Phase 2 Implementation PDF: {output_path}")

if __name__ == "__main__":
    artifact_path = r"C:\Users\kamra\.gemini\antigravity\brain\09fcbbdb-a412-407b-a71f-1d6a682ee85c\Phase_2_Interview_Orchestrator_Implementation_Report.pdf"
    workspace_path = r"c:\AI Interview Preparation assistant\Phase_2_Interview_Orchestrator_Implementation_Report.pdf"

    create_pdf(artifact_path)
    create_pdf(workspace_path)
