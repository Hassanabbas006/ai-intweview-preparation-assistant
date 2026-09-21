# Phase 1: Auth (User + Admin) — Walkthrough

**Completed:** September 18, 2026

---

## What Was Built

Phase 1 establishes the complete authentication architecture for both candidates and administrators as defined in `docs/Phases.md` and `docs/Rules.md`.

---

## Key Achievements & Guardrails Enforced

### 1. Strict Zero-IP Address Logging
- All authentication events recorded in PostgreSQL's `login_logs` table strictly record: `userId`/`adminId`, `method` (`CREDENTIALS`, `GOOGLE`, `ADMIN_CREDENTIALS`, `REGISTRATION`), `timestamp`, and `success` (`true`/`false`).
- **No IP addresses, request headers, or geolocation data are logged anywhere** across the codebase or middleware.

### 2. Isolated Admin Authentication Scope
- The administrator auth flow is completely separated from the candidate auth system:
  - Separate database model: `Admin` (table: `admins`).
  - Dedicated route: `app/(admin)/admin/login/page.tsx`.
  - Dedicated session cookie: `admin_session` (8-hour expiration, HTTP-only, SameSite=Lax).
  - **Mandatory 2FA**: Step 1 validates email and bcrypt password; Step 2 strictly requires a 6-digit TOTP code from Google Authenticator before the session cookie is minted.
  - Candidate sessions cannot access `/admin/*` and admin sessions cannot access candidate pages.

### 3. Candidate Authentication & Optional 2FA
- NextAuth.js v4 with `CredentialsProvider` and `GoogleProvider` (Google OAuth).
- Registration at `/signup` with career domain selection (Frontend, Backend, Fullstack, AI/ML, DevOps, Data Science, Mobile).
- Login at `/login` with inline 2FA challenge fallback if the account has two-factor authentication enabled.
- Security management page at `/dashboard/settings/security` to view QR code, enter manual setup key, and activate/deactivate 2FA.

### 4. Candidate Password Reset Flow (Resend Email)
- **Token Security**: Generates 32-byte cryptographic random token, stores single-use SHA-256 hash in `password_reset_tokens` table with **20-minute expiration**.
- **Email Delivery**: Integrated Resend SDK (`EMAIL_FROM=onboarding@resend.dev`, `RESEND_API_KEY`) with local dev console fallback.
- **Enumeration Protection**: Uniform success messages preventing email scanning.
- **Zero-IP Logging**: No IP addresses or headers recorded.
- **Dedicated Pages**: `/forgot-password` (request) and `/reset-password` (token confirmation + password update).
- **Login Integration**: Added "Forgot password?" link on `/login` and success confirmation banner.

### 5. Admin Seeding with Secure Env Requirement
- `prisma/seed.ts` requires `ADMIN_SEED_PASSWORD` in `.env` with **no fallback value in code** — exits with a fatal error if the variable is missing or empty.
- Admin seeded successfully in Supabase:
  - **Email**: `abbassyedhassan786@gmail.com` (updated directly in Supabase table editor)
  - **Role**: `SUPERADMIN`
  - **2FA**: Enabled (Google Authenticator compatible base32 key generated and output during seed)

---

## Packages Installed

| Package | Purpose |
|---|---|
| `next-auth` | Candidate session management and OAuth |
| `bcryptjs` + `@types/bcryptjs` | Password hashing (12 salt rounds) |
| `speakeasy` + `@types/speakeasy` | RFC 6238 TOTP 2FA generation and verification |
| `qrcode` + `@types/qrcode` | QR code data URL generation for authenticator apps |
| `jose` | Lightweight JWT signing for isolated admin sessions |
| `resend` | Transactional email delivery for password resets |
| `tsx` | TypeScript runner for seed script |

---

## File Manifest

| Area | File | Summary |
|---|---|---|
| **Types** | `types/next-auth.d.ts` | NextAuth module augmentation for custom session fields (id, role, domain, twoFactorEnabled). |
| **Session Provider** | `components/auth-provider.tsx` | NextAuth Client `SessionProvider` wrapper. Integrated into `app/layout.tsx`. |
| **Password Utilities** | `lib/auth/password.ts` | Bcrypt 12-round hashing and comparison functions. |
| **TOTP Utilities** | `lib/auth/totp.ts` | Speakeasy base32 secret generation, QR code data URLs, token validation (window: 1 for clock drift). |
| **Admin Sessions** | `lib/auth/admin-session.ts` | Isolated JWT session creation and verification for 8-hour admin cookies. |
| **NextAuth Config** | `lib/auth/nextauth-options.ts` | Credentials + Google OAuth, JWT/session callbacks, zero-IP LoginLog writes. |
| **Auth Exports** | `lib/auth/index.ts` | Re-exports all auth utilities and `AuthSessionUser` interface. |
| **Email Helper** | `lib/email/resend.ts` | Resend transactional email helper for password resets. |
| **Candidate Register** | `app/api/auth/register/route.ts` | POST — Zod validation, bcrypt hash, User upsert, LoginLog. |
| **2FA Pre-flight** | `app/api/auth/2fa/check/route.ts` | POST — Pre-flight credential check & 2FA requirement signal. |
| **2FA Setup** | `app/api/auth/2fa/setup/route.ts` | POST (protected) — Generates TOTP secret, stores pending secret, returns QR code data URL. |
| **2FA Verify** | `app/api/auth/2fa/verify/route.ts` | POST (protected) — Validates 6-digit code against stored secret, activates 2FA on account. |
| **2FA Disable** | `app/api/auth/2fa/disable/route.ts` | POST (protected) — Password re-verification required before disabling 2FA. |
| **Password Reset Req** | `app/api/auth/password-reset/request/route.ts` | POST — Generates 20-min SHA-256 hashed token & dispatches email. |
| **Password Reset Conf** | `app/api/auth/password-reset/confirm/route.ts` | POST — Validates token hash, updates bcrypt password, marks token used. |
| **NextAuth Handler** | `app/api/auth/[...nextauth]/route.ts` | App Router NextAuth GET/POST handler. |
| **Admin Login Step 1** | `app/api/admin/auth/login/route.ts` | POST — Validates admin credentials, issues 5-min 2FA challenge token. |
| **Admin Login Step 2** | `app/api/admin/auth/verify-2fa/route.ts` | POST — Validates TOTP code, sets 8-hour HTTP-only `admin_session` cookie. |
| **Admin Logout** | `app/api/admin/auth/logout/route.ts` | POST — Clears `admin_session` cookie. |
| **Admin Me** | `app/api/admin/auth/me/route.ts` | GET — Returns current admin session data. |
| **Route Guard** | `middleware.ts` | Edge middleware protecting `/dashboard`, `/interview`, `/resume`, `/coding-arena`, and isolating `/admin/*`. |
| **Candidate Login** | `app/(auth)/login/page.tsx` | Email/password, Google OAuth, inline conditional 2FA challenge, forgot password link. |
| **Forgot Password** | `app/(auth)/forgot-password/page.tsx` | Email submission form for password recovery. |
| **Reset Password** | `app/(auth)/reset-password/page.tsx` | New password selection page with token verification. |
| **Candidate Signup** | `app/(auth)/signup/page.tsx` | Registration form with target career domain dropdown. |
| **Candidate Dashboard** | `app/dashboard/page.tsx` | User profile, 2FA status badge, feature navigation cards, sign-out. |
| **2FA Settings** | `app/dashboard/settings/security/page.tsx` | QR code display, base32 key, 6-digit test verification, password-protected disable flow. |
| **Admin Login** | `app/(admin)/admin/login/page.tsx` | Two-step isolated admin login (credentials → mandatory TOTP). |
| **Admin Dashboard** | `app/(admin)/admin/dashboard/page.tsx` | Privileged dashboard with session scope info, zero-IP notice, sign-out. |
| **Admin Seed** | `prisma/seed.ts` | Seeds SUPERADMIN with mandatory 2FA; crashes if `ADMIN_SEED_PASSWORD` missing. |

---

## Verification Results

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Zero TypeScript errors |
| `npx prisma db push` | ✅ Connected via IPv4 pooler, `password_reset_tokens` table created |
| `npx prisma db seed` | ✅ SUPERADMIN seeded with TOTP secret |
| `npx tsx test-password-reset.ts` | ✅ Token hashing, 20-min expiration & replay prevention verified |
| `npm run build` | ✅ All 27/27 pages & API routes compiled successfully |
| `npm run dev` | ✅ Dev server running at http://localhost:3000 |

---

## Infrastructure Notes

- **Database Connectivity**: The direct Supabase host (`db.xpipqzefrxklwnvelvbi.supabase.co:5432`) resolves only to an IPv6 address, which is unreachable on this machine. Switched to the IPv4-compatible connection pooler: `aws-0-ap-northeast-2.pooler.supabase.com:5432`.
- **Session Durations**: User (NextAuth JWT) — 30 days. Admin (isolated HTTP-only cookie) — 8 hours.
- **Admin Email**: Updated from seed default `admin@interviewprep.ai` to `abbassyedhassan786@gmail.com` directly via Supabase table editor.
