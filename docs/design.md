# design.md — AI Interview Preparation Assistant

Visual direction: **calm and trustworthy** — this app sits with people during a genuinely stressful moment (job interviews), so the UI should feel steady and reassuring, not flashy or corporate-cold. Blues and soft, muted tones throughout. Supports light and dark mode via a toggle.

## Color palette

### Light mode

| Role | Hex | Usage |
|---|---|---|
| Primary | `#3D6FB4` | Buttons, links, active states, AI chat bubble accents |
| Primary (dark, for text/headings) | `#1F3D63` | Headings, emphasis on light backgrounds |
| Secondary / soft accent | `#7FB3A6` | Tags, secondary buttons, progress indicators, calm highlights |
| Background | `#F7F9FB` | Page background — soft blue-gray, not stark white |
| Surface / card | `#FFFFFF` | Cards, panels, modals |
| Border | `#DCE3EA` | Hairlines, dividers, input borders |
| Text primary | `#1E293B` | Body text, headings |
| Text secondary | `#64748B` | Muted text, timestamps, helper copy |
| Success | `#4CAF7D` | Correct answers, passed test cases, positive feedback |
| Warning | `#E0A458` | Caution states, partial scores |
| Error | `#E2635F` | Failed test cases, validation errors — kept muted, not harsh red |

### Dark mode

| Role | Hex | Usage |
|---|---|---|
| Primary | `#6FA8E0` | Buttons, links, active states (brightened for contrast on dark bg) |
| Primary (light, for text/headings) | `#BFDAF5` | Headings, emphasis on dark backgrounds |
| Secondary / soft accent | `#8FC3B6` | Tags, secondary buttons, progress indicators |
| Background | `#0F1A24` | Page background — deep blue-black, not pure black |
| Surface / card | `#1B2735` | Cards, panels, modals |
| Border | `#2C3B4B` | Hairlines, dividers, input borders |
| Text primary | `#E5EAF0` | Body text, headings |
| Text secondary | `#94A3B8` | Muted text, timestamps, helper copy |
| Success | `#5FC490` | Correct answers, passed test cases |
| Warning | `#EDB877` | Caution states, partial scores |
| Error | `#E77E7A` | Failed test cases, validation errors |

**Note on feedback colors:** keep success/warning/error muted rather than saturated, especially in the interview feedback report — a harsh red on a low interview score reads as punitive; a softer coral keeps the tone constructive.

## Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Headings | Manrope | 600, 700 | Modern, geometric, friendly without being cold |
| Body / UI text | Inter | 400, 500 | Highly legible at small sizes, neutral, works well across dense UI (tables, forms, chat) |
| Code (coding arena) | JetBrains Mono | 400, 500 | Clear character distinction for code editor and output |

Both Manrope and Inter are free on Google Fonts.

**Type scale (suggested):**
- H1: 32px / 700
- H2: 24px / 600
- H3: 18px / 600
- Body: 16px / 400
- Small / helper text: 13px / 400

## Spacing & shape

- Spacing scale: 4, 8, 16, 24, 32, 48px
- Corner radius: 8px for inputs/buttons, 12px for cards — soft enough to feel calm, not so rounded it feels playful/childish
- Shadows: minimal, soft, low-opacity only (avoid heavy drop shadows — keep the "flat but warm" feel)

## Component notes

- **Interview chat bubbles**: AI messages in a soft primary-tinted background, user messages in a neutral surface tint — clear distinction without high contrast/jarring color shifts
- **Buttons**: primary actions in Primary blue; destructive actions (e.g. "End interview," "Ban user") in the muted Error tone, never bright red
- **Score displays / gauges**: use the Success → Warning → Error gradient sparingly and only where evaluative (ATS score, interview score) — not decoratively elsewhere
- **Admin dashboard**: same palette as the main app, no separate "admin theme" — keeps the whole product feeling cohesive

## Theming implementation note

Since both light and dark mode are required, define all colors as CSS variables (or Tailwind theme tokens) rather than hardcoding hex values in components, so the toggle is a single class/attribute switch rather than a per-component rewrite.
