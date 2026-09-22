# memory.md — AI Interview Preparation Assistant

Living progress log. Update this after every phase (or every session) so a new session — yours or an AI coding assistant's — can pick up cleanly without re-reading the whole codebase.

**How to use this file:**
- When a phase or feature is finished and tested, move it into `## Completed` with a one-line note (what was built, any deviations from Phases.md/Architecture.md worth remembering).
- Keep `## Currently working on` to whatever's actually in progress right now — clear it out when that work moves to Completed.
- Keep entries short. This is a status log, not a diary — the "why" lives in PRD.md/Architecture.md/Rules.md, this file just tracks "what's done" and "what's next."

---

## Completed

- Phase 0: Foundation (Repository initialized with Next.js 14 App Router, Prisma schema with 7 core models pushed to Supabase PostgreSQL, Tailwind CSS calm & trustworthy tokens mapped to design.md, accessible UI kit components, CI workflow, and strict zero-IP tracking guardrail).
- Phase 1: Auth (user + admin) (Candidate email/password + Google OAuth sign-in via NextAuth.js, candidate optional TOTP 2FA with QR code generation in settings, fully isolated admin authentication system on `/admin/login` with mandatory TOTP 2FA and 8-hour HTTP-only session cookie, route guard middleware, seed script requiring ADMIN_SEED_PASSWORD with no fallback, and zero-IP logging audit throughout).
- Phase 2: Mock interview engine (Provider-agnostic LLM client with Gemini Flash Lite sub-second streaming, all 4 interview tracks: Technical Domain with 8 disciplines, HR Behavioral, Managerial Leadership, and timed 15-minute objective Aptitude assessment, live typing indicator, PostgreSQL conversation transcript persistence).

## Currently working on

- Phase 2 User Review & Testing (Testing across interview tracks on localhost).

## Notes / deviations from plan

- Routes under `(admin)` were structured as `/admin/login` and `/admin/dashboard` to avoid route collision with the user `/dashboard` while preserving isolated admin session scope per `Architecture.md`.
- Supabase connection configured using IPv4-compatible pooler host `aws-0-ap-northeast-2.pooler.supabase.com:5432` to resolve direct IPv6 routing restrictions on client networks.
- **Git Push Policy**: Do NOT push to GitHub automatically. Only push when explicitly instructed by the user after a phase is fully tested and approved.
