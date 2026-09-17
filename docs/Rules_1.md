# Rules — AI Interview Preparation Assistant

Guardrails for anyone (human or AI coding assistant) working on this codebase. Update this file as decisions get made — it should always reflect the current, agreed rules, not a historical log.

## Use

- **Build tool**: Google Antigravity — plan each phase via Planning Mode before executing, verify with browser-testing artifacts
- **Frontend**: Next.js (React) + Tailwind CSS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Session/cache**: Redis
- **Auth**: NextAuth.js (or Firebase Auth) + `speakeasy` for TOTP 2FA
- **LLM (free tier)**: Google Gemini API or Groq, behind a provider-agnostic wrapper in `/lib/llm`
- **Code execution (free tier)**: Piston API or Judge0 free RapidAPI tier, behind a provider-agnostic wrapper in `/lib/code-execution`
- **Code editor**: Monaco Editor
- **File storage**: AWS S3 or Cloudinary
- **Learning recs**: YouTube Data API v3
- **Voice mode (later phase)**: browser-native Web Speech API for speech-to-text and text-to-speech — free, no external voice service
- **Interview responses**: stream token-by-token with a client-side typing indicator; never send a full response as one blocking dump

## Avoid

- **No IP address logging or tracking**, anywhere in the system — this was explicitly ruled out
- No hardcoded secrets or API keys in source — environment variables only, never committed
- No reusing the regular user session/login flow for admin — admin auth must stay a fully separate system
- No resume formats accepted silently if they'll break ATS parsing (tables, images, multi-column layouts, headers/footers) — flag them to the user instead of failing silently
- No mixing the LLM provider's SDK-specific formatting directly into interview/business logic — always go through the provider-agnostic wrapper
- No skipping input validation on interview transcripts, resume uploads, or code submissions before they reach the LLM or execution sandbox

## Error handling

- All API routes return a consistent shape: `{ error: boolean, message: string, data?: ... }`
- Never expose raw LLM provider errors, stack traces, or database errors to the frontend — log them server-side, return a clean user-facing message
- Free-tier API rate limits (LLM and code execution) should fail gracefully with a clear "try again shortly" message, not a raw 429
- Interview sessions must handle a dropped/failed LLM call without losing the conversation state already in Redis/Postgres — retry or resume, don't restart the interview

## API keys & environment variables

All keys below go in a `.env` file (never committed — add it to `.gitignore` immediately in Phase 0). Create a `.env.example` alongside it with the same variable names but empty values, so the structure is documented without exposing real keys.

| Variable | What it's for | Where to get it |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Railway / Supabase free tier dashboard |
| `REDIS_URL` | Redis connection string | Upstash free tier dashboard |
| `NEXTAUTH_SECRET` | Session encryption | Generate locally (e.g. `openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" OAuth | Google Cloud Console → OAuth credentials |
| `GEMINI_API_KEY` | LLM (interview engine, evaluator) | Google AI Studio (aistudio.google.com) |
| `GROQ_API_KEY` | LLM alternative | console.groq.com |
| `JUDGE0_API_KEY` | Code execution (if using RapidAPI's Judge0, not Piston) | rapidapi.com → Judge0 CE listing |
| `YOUTUBE_API_KEY` | Learning recommender | Google Cloud Console → YouTube Data API v3 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or Cloudinary equivalent) | Resume file storage | AWS IAM console or Cloudinary dashboard |

**Rule for AI coding assistants**: never invent, guess, or hardcode a placeholder value for any of these — leave the `.env` entry empty and tell the user which key needs to be filled in and why. Every key is read via `process.env.KEY_NAME`, never pasted as a literal string in code.

## Boundaries for AI coding assistants

- Do not modify the auth or 2FA flow without explicit confirmation first
- Do not change the database schema without flagging the change and its impact before applying it
- Do not swap the LLM or code-execution provider without confirmation — these are deliberate choices (free tier now, paid upgrade path later)
- Do not commit `.env` files or any secrets
- Stick to the agreed folder structure in `Architecture.md` — don't introduce a new structural pattern mid-build
- When working on one phase (per `Phases.md`), stay scoped to it — don't opportunistically start building later-phase features
