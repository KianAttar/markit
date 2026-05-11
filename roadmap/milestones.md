# Markit — Milestones

## Milestone 1 — Per-Student AI Report
*The core value loop. Everything else builds on this.*

Given a test result file + student code + assignment doc, the AI produces a short structured report per student:
- Each issue with a line number reference
- Whether it was caught by an existing test
- Whether it is automatable (could a new test catch this?)

The report must be scannable in under 30 seconds. Format and detail level are the critical design decisions here.

**Deliverables:**
- `src/report.ts` — calls Vercel AI SDK, returns a typed report object
- Zod schema defining the report structure
- Report written alongside the result file after grading

---

## Milestone 2 — Test Suite Evolution
*The suite gets smarter as grading progresses.*

When the AI identifies a new automatable issue in a student's report:
- AI writes a new test case
- Test runs against the sample solution to validate
- If it passes, the test is added to the suite and runs for all remaining students

**Deliverables:**
- AI can propose a new test case as part of its report output
- Validation step runs the sample solution against the new test
- Test is appended to the suite on success

---

## Milestone 3 — Assignment Setup
*Generating the initial test suite from scratch.*

Given an assignment doc and a sample solution, the AI:
- Identifies what requirements are automatable vs. not
- Generates the initial test suite
- Validates the full suite against the sample solution — all must pass before suite is locked

**Deliverables:**
- `src/setup.ts` — takes doc + sample solution, produces initial test suite
- Validation step confirms sample solution passes all generated tests

---

## Milestone 4 — Finalization
*Producing the final grade and feedback per student.*

- Instructor assigns marks per test case (defaults provided)
- Automated deductions computed from test results × marks per test
- Non-automated findings from AI report surfaced for instructor review
- Final feedback aggregated and written per student, clearly separating automated from non-automated findings

**Deliverables:**
- Marks config per assignment (file or prompt-based)
- Aggregation logic combining automated + non-automated findings
- Final feedback output per student

---

## Milestone 5 — Web App
*Wrap the CLI logic in a UI.*

By this point the core grading logic is solid, decoupled, and battle-tested. The web app is a layer on top, not a rewrite.

- Database: PostgreSQL + Prisma
- File storage: S3 or R2
- Auth: Clerk
- Background jobs: grading runs as async jobs, not in request/response
- UI for uploading submissions, reviewing reports, adjusting marks, exporting feedback

---

## Current State
Submission organizer, C++ test suite, grade.sh, and result files are all working. Starting at Milestone 1.
