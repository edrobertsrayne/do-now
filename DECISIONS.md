# Design decisions

Inspired by Craig Barton's "Ultimate Retrieval Tool" spaced-retrieval scheduler
(<https://readwise.io/reader/shared/01m5byszv2bq24ev0mxjk65p1w>). Decisions are
either **agreed** (stated by the project owner) or **default** (chosen to
unblock v1; change freely, but update this file).

## Scope

| # | Decision | Status |
|---|----------|--------|
| 1 | Audience: a physics teacher, shareable with colleagues. | agreed |
| 2 | Spec: AQA GCSE Physics (8463). | agreed |
| 3 | v1 content is factual recall only. No calculations, no diagrams. | agreed |
| 4 | Question style: short answer (book or whiteboard). Command words are mostly *State* / *Define*; other AQA command words are allowed. | agreed |
| 5 | Bank is authored as: LLM drafts, owner reviews, committed as JSON in `bank/`. No runtime generation. | agreed |
| 6 | Scheduling unit is a **skill**: one AQA spec point, or a sensible group of closely related ones. Each skill has several questions to rotate through. | agreed |
| 7 | Start small (about 10 skills x 3 questions) and grow the bank. Owner is the only reviewer. | agreed |

## Scheduler

| # | Decision | Status |
|---|----------|--------|
| 8 | Time is counted in **lessons**, not calendar days. | agreed |
| 9 | One generated Do Now = one lesson. The lesson counter advances only when a Do Now is generated. | agreed |
| 10 | A skill is due `x` lessons after it was last practised (or taught, for the first practice), where `x` doubles after the first steps: 1, 3, 6, 12, 24, ... | agreed |
| 11 | The interval list is capped at **24** and the last value repeats until the exam: `[1, 3, 6, 12, 24]`. The list is a config value (per class later). | default |
| 12 | No RAG feedback in v1. The schedule is a pure function of the practice count. | agreed |
| 13 | A Do Now has **5** questions by default; the teacher can choose 4-6 (config `size`). The owner's own Do Nows use 5, sometimes 6. | agreed |
| 14 | Selection: reserve one slot for a newly taught skill (never practised, from the latest teaching batch), then fill by most overdue first. | agreed |
| 15 | Tie-break for equal overdue: earlier taught first, then bank order. Deterministic, no randomness. | default |
| 16 | At most one question per skill per Do Now. | default |
| 17 | If fewer skills are due than the Do Now size, pad with not-yet-due skills (`fillToSize`, default on), least recently shown first. Padding is bonus retrieval only: it does **not** advance the skill's practice count or due date. (Found in simulation: counting padding as practice collapsed the spacing, taking skills to the 24-lesson cap within a few weeks.) | default |
| 18 | If no skill is taught yet, generating does nothing (no empty Do Now, lesson counter unchanged). If skills are taught but none is due and padding is off, the lesson still advances with an empty Do Now (otherwise the schedule would deadlock). | default |
| 19 | Question rotation within a skill: never-used-by-this-class first, then least recently used, then bank order. | agreed (unseen first) |
| 20 | A teacher can untick a skill on the checklist. This deletes its schedule state. Re-ticking starts it from scratch. | default |
| 21 | When a skill is taught, `taughtAt` is the current lesson counter. If ticked after generating Do Now N, it is first due at N+1. | default |

Known risks to watch in the simulation (`npm run simulate`):

- **Backlog.** Teaching many skills in a short span makes many items due together.
  "Most overdue first" keeps the order sane but items can starve. Check max overdue.
- **Rotation exhaustion.** With 3 questions per skill, repeats start at the 4th
  practice. Aim for 5+ per skill over time.

## Product

| # | Decision | Status |
|---|----------|--------|
| 22 | Web app on **SvelteKit**, built after the scheduler is proven by a CLI simulation. | agreed |
| 23 | No login. A class is identified by a random unguessable code; anyone holding it can edit that class. | agreed |
| 24 | Class code: 8 characters from an unambiguous alphabet (no 0/O/1/I/L). A single code, no separate read-only code. | default |
| 25 | Persistence: **SQLite** (via Node's built-in `node:sqlite`, no native dependency). A class's state is stored as one JSON document keyed by class code. | agreed (SQLite) / default (shape) |
| 26 | Taught tracking: a checklist of skills per class that the teacher ticks and unticks. No scheme-of-work import in v1. | agreed |
| 27 | Outputs: fullscreen projector view (questions only), printable one-page sheet, teacher-only answer key. | agreed |
| 28 | No student-facing side in v1 (no QR, no home practice). | agreed |
| 33 | Projector view design = hybrid of three prototypes (`prototypes/hybrid`): clean paper look and big type from `one-at-a-time`; Think -> Check two-phase flow and mood change from `step-reveal`; command-word badge plus highlighted command word from `four-grid`. | agreed |
| 34 | Think phase: all questions listed at once, timer visible, answers cannot be seen. Check phase: one question at a time, answer revealed on a separate keypress in a reserved panel (layout does not shift), then next question; a final summary lists every question with its answer. `O` shows an overview mid-check. | agreed (flow) / default (details) |
| 35 | Class-facing screen shows only topic, question number, command word and prompt. No skill name (it can hint at the answer) and no scheduling jargon. | default |
| 36 | Text auto-shrinks to fit its box (down to a legibility floor) rather than scrolling, so any prompt/answer length fits at 4-6 questions. Keyboard-driven: Space/arrows, `O`, timer keys, `F` fullscreen, `?` hides key hints. | default |

## Engineering

| # | Decision | Status |
|---|----------|--------|
| 29 | TypeScript, run directly by Node (type stripping), no build step for the core. `tsc --noEmit` for type checking. | default |
| 30 | Scheduler is a pure module: `(bank, classState, config) -> (classState, doNow)`. No I/O, no clock. The web layer persists state. | default |
| 31 | Bank files carry a per-question `status` (`draft` or `reviewed`). Nothing is treated as trustworthy until the owner marks it reviewed. The CLI can restrict to reviewed questions. | default |
| 32 | Spec references in the bank were written from memory and **must be checked against the AQA spec** while reviewing. | default |

## Out of scope for v1

RAG ratings, calculations, diagrams, per-student tracking, student accounts,
scheme-of-work import, other exam boards, runtime question generation, FSRS/SM-2.
