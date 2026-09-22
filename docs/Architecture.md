# Architecture — AI Interview Preparation Assistant

## Build tool

Built using Google Antigravity (agentic AI IDE) — plan phase-by-phase via its Planning Mode against `Phases.md`, verify with its browser-testing artifacts, keep Autopilot off for auth/2FA and schema changes per `Rules.md`.

## App flow

### User flow
1. Sign up / log in (email+password or Google OAuth) → optional 2FA setup. Forgot password → request reset link by email → click link → set new password → log in.
2. Land on dashboard
3. **Resume path**: upload resume → choose job-targeted or general ATS scan → get score, skill gaps, and improvement suggestions
4. **Interview path**: configure interview (type → domain/focus if applicable → modality) → conversational interview session → feedback report → learning recommendations
5. **Coding path** (optional, technical tracks): open coding arena → solve problems → auto-judged results
6. JD-based question generation can feed into the interview path to tailor questions to a specific role

### Admin flow
1. Log in via separate `/admin/login` route (own session scope, mandatory 2FA)
2. Admin dashboard: overview stat cards (users, interviews, ATS scans, avg score)
3. Registered users table (existing): ID, user, email, domain, role, 2FA status, account status, last login
4. User management: role assignment, ban actions
5. Activity analytics: login activity log (user, timestamp, method, success/fail — no IP), interview activity by type/domain, ATS scan activity by mode and score distribution, per-user drill-down

## Folder / file structure

Suggested structure for a Next.js-based build:

```
/app
  /(auth)/login
  /(auth)/signup
  /(admin)/admin-login
  /(admin)/dashboard
  /dashboard
  /resume
  /interview
  /interview/[sessionId]
  /coding-arena
  /api
    /auth
    /resume
    /interview
    /coding
    /admin
/components
  /ui
  /interview
  /resume
  /admin
/lib
  /llm            # LLM provider client (provider-agnostic wrapper)
  /ats            # ATS scoring + suggestion logic
  /auth           # auth + 2FA helpers
  /code-execution # Judge0 / Piston client
  /youtube        # YouTube Data API client
/prisma
  schema.prisma
/services
  interview-engine.ts
  evaluator.ts
```

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS |
| Backend | Node.js/Express or Next.js API routes; Python FastAPI microservice for resume parsing |
| Database | PostgreSQL (via Prisma ORM) |
| Session/cache | PostgreSQL only for live interview state — deliberate simplification (single-session reads are fast enough at this scale, and it guarantees zero state loss on refresh/disconnect). Redis is not currently used; revisit only if concurrency or latency actually requires it. |
| Auth | NextAuth.js or Firebase Auth; Google OAuth; TOTP 2FA via `speakeasy`; password reset via emailed link |
| Email delivery | Resend (free tier) — password reset emails |
| LLM | Provider-agnostic client. Free tier to start: Google Gemini API or Groq. Paid upgrade path: Claude API |
| Interview response delivery | Streamed token-by-token (not sent all at once), with a typing indicator client-side while the AI responds |
| Voice mode (later phase) | Browser-native Web Speech API — free, built-in speech-to-text and text-to-speech, no external voice service |
| Coding arena execution | Free tier to start: Piston API or Judge0 free RapidAPI tier. Upgrade path: self-hosted Judge0 CE or paid plan |
| Coding editor | Monaco Editor |
| File storage | AWS S3 / Cloudinary (resumes) |
| Learning recs | YouTube Data API v3 |
| Hosting | Vercel (frontend) + Railway/Render (backend, Postgres) |

## Key database tables

```
users              → id, email, password_hash, google_id, role, 2fa_enabled, domain, created_at
password_reset_tokens → id, user_id, token_hash, expires_at, used (boolean)
admins             → id, email, password_hash, 2fa_enabled (mandatory)
login_logs         → user_id, timestamp, method, success/fail   (no IP)
interview_sessions → id, user_id, type, domain, focus_area, modality, started_at, completed_at, status
interview_reports  → id, session_id, scores, strengths, weaknesses, tips
resumes            → id, user_id, file_url, parsed_data
ats_scan_logs      → id, user_id, resume_id, mode (job_targeted/general), jd_id (nullable), score, suggestions, timestamp
```

## Core design principle

Keep the LLM client and the code-execution client behind a single provider-agnostic interface each. Both start on free tiers and need to swap to paid providers later — that swap should be a config/env change, not a rewrite of the interview engine or coding arena logic.

## Interview UI requirements

The interview screen is a single chat interface, not a form: one free-text input handles both candidate answers and candidate questions (no separate modes). Responses stream in as they're generated with a typing indicator shown while the AI is composing a reply. Every message sent to the LLM includes the full conversation history so far, which is what lets follow-ups reference earlier answers.
