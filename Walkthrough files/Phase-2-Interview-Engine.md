# Phase 2 — Mock Interview Engine Walkthrough

## Overview

Phase 2 introduces the core AI-powered Mock Interview Engine for the **AI Interview Preparation Assistant**. It features a provider-agnostic LLM layer, real-time Server-Sent Events (SSE) token-by-token streaming, contextual follow-up probing, durable PostgreSQL transcript persistence, and a timed, objectively-scored Aptitude assessment track.

---

## 1. Key Architecture & Features Built

### A. Provider-Agnostic LLM Layer (`/lib/llm`)
- **Factory & Interface**: `getLLMProvider()` abstracts all LLM interactions (`generateText`, `streamText`).
- **Google Gemini Provider**: Powered by official `@google/genai` SDK with automated multi-model fallback chain (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-flash-latest`) to withstand upstream demand spikes with zero disruption to candidates.
- **Offline / Mock Provider**: Seamless local development fallback when no API key is provided.

### B. Four Interview Tracks & System Prompts (`/lib/interview/prompts.ts`)
1. **Technical / Domain Deep Dive**:
   - Subdivided across 8 engineering disciplines: **Frontend, Backend, Fullstack, AI/ML, DevOps, Data Science, Mobile, Cybersecurity**.
   - Accepts custom focus areas (e.g. *PostgreSQL Indexing, React Performance, Microservices*).
   - Probes design decisions, performance bottlenecks, architecture trade-offs, and edge cases.
2. **HR & Behavioral Round**:
   - Focuses on situational judgment, collaboration, conflict management, and STAR method storytelling.
3. **Managerial & Leadership Round**:
   - Probes technical strategy, roadmap prioritization, cross-functional alignment, and people management under ambiguity.
4. **Aptitude Assessment Track** (`/lib/interview/aptitude-bank.ts`):
   - Timed 15-minute test with 8 curated questions covering Quantitative, Logical Reasoning, and Verbal Ability.
   - Real-time countdown timer, question navigator, and instant objective score percentage breakdown with explanation accordions.

### C. Live Interactive Chat UI (`/app/interview/[sessionId]`)
- **Real-Time Token Streaming**: Next.js Server-Sent Events (SSE) stream responses live as they are synthesized.
- **Typing Indicator**: Animated three-dot pulse while the AI interviewer formulates turns.
- **Unified Single Free-Text Input Bar**: Handles both candidate answers and candidate clarifying questions with auto-expand and Enter / Shift+Enter shortcuts.
- **Safe Exit Guard**: Confirmation modal preventing accidental session exits.

### D. PostgreSQL Schema & Session Persistence
- **`interview_messages` Table**: Stores all conversation turns (`sessionId`, `role`, `content`, `createdAt`) durably in PostgreSQL.
- **Mid-Session Recovery**: Refreshing or returning to an active interview room immediately restores the full conversation history without restarting.

---

## 2. API Routes Implemented

| Route | Method | Description |
|---|---|---|
| `/api/interview/start` | `POST` | Validates track configuration, creates PostgreSQL session, and generates the initial AI opening question. |
| `/api/interview/[sessionId]/stream` | `POST` | SSE endpoint that appends candidate answer, queries full transcript history, streams AI tokens, and persists the response turn. |
| `/api/interview/[sessionId]` | `GET` | Retrieves session metadata, difficulty, domain, and full transcript. |
| `/api/interview/[sessionId]/end` | `POST` | Marks the session status as `COMPLETED`. |
| `/api/interview/[sessionId]/aptitude/submit` | `POST` | Evaluates submitted multiple-choice answers and stores objective score percentage. |

---

## 3. Verification & Test Results

- **Automated Integration Test**: `test-interview-engine.ts` passed all assertions for HR generation, Technical streaming follow-up, Aptitude evaluation, and DB transcript persistence.
- **TypeScript Typecheck**: `npm run typecheck` $\rightarrow$ **0 errors**.
- **Production Build**: `npm run build` $\rightarrow$ **30/30 static and dynamic routes compiled successfully**.

---

## 4. Live Routes

- **Interview Hub**: [http://localhost:3000/interview](http://localhost:3000/interview)
- **Active Interview Room**: `http://localhost:3000/interview/[sessionId]`
- **Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
