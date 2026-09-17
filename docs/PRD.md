# PRD — AI Interview Preparation Assistant

## Problem

Interview prep today is fragmented — generic question banks, static PDFs, and one-way practice tools that don't adapt to the candidate or hold a real conversation. Job seekers get little sense of how they'd actually perform against a real interviewer, and no clear, actionable path from "here's your resume" to "here's what to fix and how to practice it."

## What we're building

A single web platform that takes a job seeker from resume to interview-ready:

1. Upload a resume, get an ATS score and skill-gap analysis (targeted to a specific job, or a general check)
2. Get concrete suggestions to improve the resume's ATS compatibility
3. Practice with a genuinely conversational AI mock interview across multiple interview types and domains
4. Get a detailed feedback report after each interview, with targeted YouTube recommendations to close skill gaps
5. Practice coding problems in a built-in, auto-judged coding arena

The **mock interview is the core, non-negotiable feature** — it must feel like a real back-and-forth conversation (like talking to ChatGPT/Gemini), not a scripted Q&A form. The candidate can ask the AI questions mid-interview and get answered in character, not just answer questions themselves.

## Target users

*(Suggested — confirm or edit before locking this in.)* A mix of:
- Students and freshers preparing for campus placements or first jobs
- Working professionals preparing for a role switch or domain change
- Candidates across both technical (software engineering, data science, cybersecurity, data analytics) and non-technical (finance, accounting) tracks, since the domain list spans both

## Core features

| Feature | Description |
|---|---|
| Auth | Email/password signup + login, "Continue with Google," TOTP-based 2FA (Google Authenticator compatible) |
| Resume upload & parsing | PDF/DOCX upload, structured extraction (skills, experience, education) |
| ATS scoring | Two modes: job-targeted (score against a specific JD) or general (no JD, general ATS health score) |
| Skill gap analysis | Identifies gaps between resume and target role (or general best practices) |
| Resume improvement suggestions | Missing keywords, formatting/parsability fixes, stronger phrasing rewrites, structural gaps — for both ATS modes |
| Interview question generator | Generates tailored questions from a pasted/uploaded job description |
| Mock interview simulator | Conversational, AI-led interview across 4 types: HR/Behavioral, Aptitude, Managerial, Domain-based (cybersecurity, data science, finance, accounting, data analytics, etc.). Candidate can ask the AI questions mid-interview. Chat-style UI with streaming replies (text appears word-by-word) and a typing indicator while the AI responds — a single free-text input handles both answers and candidate questions, no separate modes. Text mode first; voice-to-voice mode later using the browser's built-in speech-to-text and text-to-speech. |
| AI feedback & report | Post-interview evaluation with scores, strengths, weaknesses, and improvement tips — rubric varies by interview type |
| Learning recommender | YouTube video recommendations mapped to identified skill gaps |
| Coding arena | LeetCode-style code editor with an automated judge, for technical/DS tracks |
| Admin dashboard | Separate admin login (own session scope, mandatory 2FA), user management (role/ban), and activity analytics: logins, interviews taken, ATS scans run. No IP address logging. |

## Non-negotiable priorities

1. **Mock interview quality** — this cannot be a compromise. It must feel like a real, adaptive conversation, not a static question list. This includes the interaction itself feeling alive: streaming responses, a typing indicator, and free-text input for both answers and candidate questions.
2. **No IP address logging** anywhere in the system.
3. Admin login must be a genuinely separate system from regular user login, not just a role flag on the same flow.
