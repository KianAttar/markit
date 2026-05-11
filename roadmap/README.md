# Markit — Product Blueprint

Markit is a grading assistant for instructors and TAs. It automates what can be automated, surfaces what cannot, and keeps humans in the loop only where judgment is genuinely required.

---

## Core Principle

The sample solution is the source of truth. Every automated test must pass against it. If a test fails against the sample solution, either the test or the sample solution is wrong — both must be resolved before grading begins.

---

## Workflow

### 1. Setup (per assignment)

- Instructor uploads the assignment doc and a sample solution (or asks the AI to draft one, then provides or corrects it)
- AI analyzes the doc and sample solution to determine what is testable
- AI generates an automated test suite covering all automatable requirements
- Tests run against the sample solution — all must pass before the suite is locked
- Marks per test case are assigned (defaults provided, instructor adjusts if needed)

### 2. Per-Student Grading

- Automated tests run against the student's submission → result file produced
- AI reads: result file + student code + assignment doc
- AI produces a short report per student:
  - Each issue listed with a line number reference
  - Whether it was caught by an existing test
  - Whether it is automatable (could a new test catch this?)
- If a new automatable issue is found:
  - AI writes the new test case
  - Test runs against the sample solution to validate
  - If it passes, the test is added to the suite and runs for all remaining students
- Any unexpected error (compile failure, missing functions, wrong signatures, anything that breaks before tests run) is flagged for human handling — the pipeline pauses and resumes once resolved

### 3. Finalization

- Instructor reviews per-student AI reports for non-automated findings and applies any manual deductions
- Automated deductions are computed from test results × marks per test
- Final feedback is aggregated: automated deductions + non-automated findings
- Feedback is delivered per student, clearly separating automated from non-automated findings

---

## Human Touchpoints

Humans are involved only where judgment cannot be replaced:

| Situation | Human action |
|-----------|-------------|
| Sample solution missing or incorrect | Provide or correct it |
| Unexpected pipeline error (compile fail, missing file, etc.) | Investigate and resolve |
| Non-automated findings in AI report | Decide on deductions |
| Marks per test case disagree with defaults | Adjust before finalization |

Everything else runs automatically.

---

## Milestones

To be defined.
