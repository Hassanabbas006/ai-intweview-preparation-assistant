# Phases — AI Interview Preparation Assistant

Estimated timeline: ~18–24 weeks for one developer working part-to-full-time (faster with AI-assisted coding, though testing/iteration time — especially Phase 2 — doesn't compress the same way code-writing does).

Built phase by phase in Google Antigravity: Planning Mode to draft each phase's plan before it executes, Manager/Editor views to run and inspect the work, browser-testing artifacts to verify, `memory.md` updated after each phase.

## Phase 0: Foundation
Repo setup, CI/CD, environment config. Database schema: users, admins, interview_sessions, ats_scan_logs, login_logs, reports, resumes. UI kit basics (Tailwind theme, component library).

## Phase 1: Auth (user + admin)
Email/password + Google OAuth signup/login. TOTP 2FA (Google Authenticator compatible). Forgot-password / reset-password flow via a time-limited emailed reset link (Resend, free tier). Separate admin login system on its own route with its own session scope and mandatory 2FA. No IP logging anywhere.

*Added after initial build: password reset was missing from the first pass — folded into Phase 1 rather than deferred, since account recovery is core auth functionality, not a later-phase nice-to-have.*

## Phase 2: Mock interview engine — top priority
Config screen: pick interview type (HR / Aptitude / Managerial / Domain), then domain + focus area if Domain is chosen. Chat-style interview screen: responses stream in token-by-token with a typing indicator, one free-text input handles both answers and candidate questions (no separate modes), full conversation history sent with every turn so follow-ups stay contextual. Aptitude round uses a separate timed, objectively-scored format instead of open chat. Text mode first; voice mode is a later toggle. LLM: build free on Google Gemini API or Groq; keep the session/prompt architecture provider-agnostic.

This phase gets the most iteration time — test across all four interview types before considering it done. "Done" includes the interaction feeling responsive (streaming, typing indicator), not just the conversation logic being correct.

*Added: questions must vary across a candidate's repeated sessions — prompts should avoid repeating the same opening questions session to session. For Aptitude specifically: each attempt presents 15 questions (not the original 8), drawn randomly from a much larger question pool (45–60+ questions across quantitative/logical/verbal categories) rather than a small static bank, so repeat attempts don't show identical questions.*

## Phase 2.5: Voice-to-voice mode
*Moved up from "later" — built right after text mode is solid, not deferred to post-launch.*

Add a mic toggle to the Phase 2 interview screen. Speech-to-text (browser-native Web Speech API, free) converts the candidate's voice to text and feeds it into the same conversation flow already built in Phase 2; text-to-speech (same API) speaks the AI's reply back. No change to the underlying interview logic — this is purely an input/output wrapper around the existing engine. Only start this once Phase 2's text mode is genuinely confirmed working well (all four tracks, contextual follow-ups, candidate questions handled) — voice adds timing/latency complexity of its own, and debugging that on top of an unproven conversation engine makes both harder to get right.

*Added: also capture two free Speech Delivery signals per answer — response time (gap between question shown and candidate starting to speak) and hesitation markers (filler words like "um"/"uh", repeated words, long pauses) from the transcript and speech timing. This is text/timing-based, not true voice-tone confidence analysis — real prosody-based confidence detection would need a paid speech-analysis service and is explicitly out of scope for now. Raw signals captured here feed into Phase 3's report.*

## Phase 3: Feedback & reporting
Evaluator LLM call runs on the full transcript, with a rubric specific to each interview type. Structured report: scores, strengths, weaknesses, improvement tips. Stored per user to track progress over time. Uses the same free LLM provider as Phase 2. For voice-mode sessions (Phase 2.5), also surfaces the Speech Delivery signals (response time, filler-word/hesitation count) captured during the interview, alongside the content-correctness scoring.

## Phase 4: Resume upload, ATS scoring & suggestions
Upload + parse resumes (PDF/DOCX). Fork after upload: job-targeted mode (paste JD, get match score + tailored gaps) or general mode (no JD, general ATS health score). Shared parsing/formatting pipeline; JD-matching only runs in targeted mode. Output includes concrete improvement suggestions (keywords, formatting fixes, stronger phrasing) in both modes.

## Phase 5: JD-based question generation
Paste/upload a JD; generate a tailored question set feeding into the Phase 2 engine so domain interviews adapt to the exact role.

## Phase 6: Learning recommender
Map identified skill gaps to YouTube Data API queries, curate and rank results, show alongside the feedback report.

## Phase 7: Coding arena
Monaco editor + language selector. Code execution: build free using the public Piston API or Judge0's free RapidAPI tier; move to self-hosted Judge0 CE or a paid plan once real users need reliability. Problem bank, test case runner, pass/fail + runtime feedback.

## Phase 8: Admin dashboard analytics
Builds on the existing admin panel (registered users table, domain distribution chart, role/ban management). Adds: overview stat cards, login activity log (no IP), interview activity chart by type/domain, ATS scan activity chart by mode and score distribution, per-user drill-down. Depends on data generated by Phases 2–4, so built after them.

## Phase 9: Polish & launch
Responsive design and accessibility pass, rate limiting/cost control on LLM calls, error monitoring, beta testing, deploy. Also the point to reassess free-tier limits against real traffic and budget for paid tiers if needed.
