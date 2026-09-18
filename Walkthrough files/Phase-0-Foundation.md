# Phase 0: Foundation — Walkthrough

**Completed:** September 17, 2026

---

## What Was Built

Phase 0 established the complete project foundation for the AI Interview Preparation Assistant as defined in `docs/Phases.md`.

---

## Key Achievements

### 1. Project Scaffolding & Configuration
- Initialized Git repository with `.gitignore` excluding `.env`, `node_modules/`, `.next/`, `dist/`, IDE/OS files.
- Created `.env.example` with all required environment variable keys (empty values) from `docs/Rules.md`.
- Configured `package.json` with Next.js 14, React 18, TypeScript, Tailwind CSS, Prisma, and all required dependencies.
- Set up `tsconfig.json` with strict mode and `@/*` path alias.
- Configured `next.config.mjs` and `postcss.config.mjs`.

### 2. Database Schema (Prisma + PostgreSQL)
- Defined full Prisma schema at `prisma/schema.prisma` with 7 core models:
  - **`User`**: Candidate accounts with optional Google OAuth, TOTP 2FA, and domain/track.
  - **`Admin`**: Fully isolated admin accounts with mandatory 2FA flag.
  - **`LoginLog`**: Authentication audit log — **strictly no IP address columns anywhere**.
  - **`InterviewSession`**: Mock interview sessions (type, domain, focus area, modality, status).
  - **`InterviewReport`**: Structured evaluation report (scores, strengths, weaknesses, tips as JSON).
  - **`Resume`**: Uploaded candidate resumes with parsed data.
  - **`AtsScanLog`**: ATS scoring history for job-targeted and general modes.
- Validated schema (`npx prisma validate` → success).
- Generated Prisma client (`npx prisma generate` → success).
- Pushed schema to Supabase PostgreSQL (`npx prisma db push` → all tables created).

### 3. Design System & Tailwind CSS
- Defined CSS variables in `app/globals.css` for light and dark palettes matching `docs/design.md`:
  - **Light**: Primary `#3D6FB4`, Background `#F7F9FB`, Surface `#FFFFFF`, Success `#4CAF7D`, Warning `#E0A458`, Error `#E2635F`.
  - **Dark**: Primary `#6FA8E0`, Background `#0F1A24`, Surface `#1B2735`.
- Extended `tailwind.config.ts` with custom color tokens, border radii (8px / 12px), font families (Manrope for headings, Inter for body, JetBrains Mono for code), and shadows.

### 4. Reusable UI Kit Components
- `components/ui/button.tsx` — Variants: primary, secondary, destructive, outline, ghost. Sizes: sm, md, lg.
- `components/ui/card.tsx` — CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
- `components/ui/input.tsx` — Accessible text input with focus ring and calm border.
- `components/ui/badge.tsx` — Status tags: success, warning, error, secondary, neutral.
- `components/ui/modal.tsx` — Accessible modal dialog.
- `components/theme-provider.tsx` — next-themes client wrapper.
- `components/theme-toggle.tsx` — Light/Dark mode toggle button.

### 5. Architecture Scaffolding
- Created all route group folders per `docs/Architecture.md`:
  - `app/(auth)/login`, `app/(auth)/signup`
  - `app/(admin)/admin/login`, `app/(admin)/admin/dashboard`
  - `app/dashboard`, `app/interview`, `app/interview/[sessionId]`, `app/resume`, `app/coding-arena`
  - `app/api/` (auth, admin, health)
- Created provider-agnostic stubs: `lib/llm/index.ts`, `lib/code-execution/index.ts`, `lib/ats/index.ts`, `lib/auth/index.ts`, `lib/youtube/index.ts`.
- Created `lib/api-response.ts` enforcing uniform `{ error, message, data? }` response shape.
- Created `lib/prisma.ts` singleton PrismaClient.
- Created `lib/utils.ts` with `cn()` classname utility.

### 6. CI/CD Pipeline
- Created `.github/workflows/ci.yml` running on every push: checkout, Node setup, `npm install`, `prisma validate`, `prisma generate`, `tsc --noEmit`, `next build`.

---

## Verification Results

| Check | Result |
|---|---|
| `npx prisma validate` | ✅ Schema valid |
| `npx prisma generate` | ✅ Client generated |
| `npx prisma db push` | ✅ All tables created in Supabase |
| `npm run typecheck` | ✅ Zero TypeScript errors |
| `npm run build` | ✅ All pages compiled successfully |
| `npm run dev` | ✅ Dev server running at http://localhost:3000 |

---

## Deviations from Plan

- Admin routes were structured as `app/(admin)/admin/login` and `app/(admin)/admin/dashboard` (using a nested `/admin/` subfolder inside the route group) to avoid a route collision with `app/dashboard` that Next.js 14 App Router would flag as parallel pages conflict.
