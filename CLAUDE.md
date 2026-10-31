When constructing shell commands, never use backslash-escaped spaces in paths or arguments.
Always wrap paths containing spaces in quotes instead.

Bad: g++ -DSTUDENT_FILE=\"../../subs/M.\ Rahman/StringList.cpp\"
Good: g++ -DSTUDENT_FILE='"../../subs/M. Rahman/StringList.cpp"'

## Grading annotation rules

Annotations use the format: /* [[ description | -N ]] */
A parser reads every annotation and sums the deductions. Therefore:

1. NEVER add a score total like /* [[ 47/50 ]] */ — the parser calculates the total automatically. Adding this makes the parser treat it as another deduction.
2. NEVER annotate the same issue twice. If a deduction appears both in a header block at the top of the file AND inline at the code, that deduction is counted twice. Each issue gets exactly ONE annotation — place it inline at the relevant code.
3. Annotations are written for the student to read. Describe only the issue and its consequence — never mention grading process, that a fix was applied to unblock testing, or any other marker-side meta-commentary.
4. When an assignment requires a comment/note per method (e.g. time-complexity comments), accept it in either the header or the .cpp file — never deduct for which file it lives in. Only deduct when a method has no such comment in either file.
5. Never deduct marks for a test file having commented-out test code — leave it as a -0 observation at most, not a real deduction.
6. If something is not explicitly asked for by the assignment doc, don't deduct marks for it — a reasonable, unspecified implementation choice (e.g. a different return type/behavior the doc doesn't pin down) gets at most a -0 observation, not a real deduction.

## Judge the code, not the content

16. **Never deduct for content, labels, grammar, punctuation, spelling, or wording.**
    We grade the *code* — the HTML/CSS structure, the controls and their attributes,
    whether things are wired up and actually work — not the prose. Any visible text
    (page title, heading, intro paragraph, nav label, button text, legend, fieldset
    name, table caption, ticket tier/price/description, city list, placeholder, and
    so on) only needs to be *meaningful*, never an exact match to the screenshot.
    "Workshop" instead of "Workshop Home" is full marks. Different-but-equivalent
    text, typos, misspellings, and punctuation are at most a `-0` observation —
    never a point deduction. Deduct only for code/structure defects: missing or
    broken elements, wrong control types, labels not associated with controls,
    invalid HTML, missing files, and required styling/behaviour not met.

## Marking process — keep it simple

7. Favor reading the code over building elaborate per-student test rigs. Don't extract/rename a student's class into a scratch header, don't hand-write a per-student adapted copy of the test suite, and don't bisect through crashes to keep testing past them. Read the implementation, run the shared test file as-is if it compiles, and reason about correctness from the code for anything that doesn't fit the harness. If it doesn't compile or crashes immediately, note that plainly and move on — don't engineer around it to keep extracting more findings.
8. The shared test suite (workspace/tmp/tests/test_sll.cpp) should stay small: one or two calls per method covering the normal case, and only the most basic edge cases (empty list, out-of-range access). Don't add self-assignment checks, negative-index probes, O(n²) analysis, or other deep-cut edge cases.
9. Default to relaxed deductions. Only deduct meaningfully for defects that are clear, major, and confirmed (doesn't compile, crashes, or a required feature is plainly absent). Minor deviations, style issues, and debatable interpretations are -0 observations, not point deductions.
10. If a submission has no issues at all, don't add anything to the file — no summary comment, no PASS result blocks, nothing. Leave it untouched and just report it clean to the user.

## Consistency rules (cross-student)

11. A partially-implemented required member (e.g. a constructor missing one parameter) never costs more than the same member being fully absent. If in doubt, price the partial attempt the same as the missing one.
12. The same root-cause bug appearing at multiple independently-reachable call sites (e.g. two constructors with the identical pointer-management mistake) gets a deduction at each site, but every occurrence after the first is discounted — never priced at full value again, and never silently zeroed to -0. Independently reachable means a student could fix one occurrence without fixing the other.
13. Time-complexity comments (Part 3-style requirements) are graded on presence, not accuracy — deduct only when a method's comment is missing or blank in both files (see rule 4), not because the stated complexity is wrong. This must be applied to every submission equally, not spot-checked on one.
14. The identical structural defect (e.g. an ODR class-redefinition in the .cpp instead of implementing the header's declarations) must carry the same deduction value across every student who has it, even if it's entangled with other issues in one submission and isolated in another.
15. If an annotation's own wording concedes the assignment doesn't dictate the behavior either way, its deduction must be -0 — don't leave a nonzero point cost attached to a judgment call the note itself says is unresolved by the spec.
