# memory.md — AI Interview Preparation Assistant

Living progress log. Update this after every phase (or every session) so a new session — yours or an AI coding assistant's — can pick up cleanly without re-reading the whole codebase.

**How to use this file:**
- When a phase or feature is finished and tested, move it into `## Completed` with a one-line note (what was built, any deviations from Phases.md/Architecture.md worth remembering).
- Keep `## Currently working on` to whatever's actually in progress right now — clear it out when that work moves to Completed.
- Keep entries short. This is a status log, not a diary — the "why" lives in PRD.md/Architecture.md/Rules.md, this file just tracks "what's done" and "what's next."

---

## Completed

- Phase 0: Foundation (Repository initialized with Next.js 14 App Router, Prisma schema with 7 core models pushed to Supabase PostgreSQL, Tailwind CSS calm & trustworthy tokens mapped to design.md, accessible UI kit components, CI workflow, and strict zero-IP tracking guardrail).

## Currently working on

*(Ready for Phase 1: Auth (user + admin))*

## Notes / deviations from plan

- Routes under `(admin)` were structured as `/admin/login` and `/admin/dashboard` to avoid route collision with the user `/dashboard` while preserving isolated admin session scope per `Architecture.md`.
