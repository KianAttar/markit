/**
 * Shared discovery of the files and student folders that carry `[[ ... | -N ]]`
 * annotations.
 *
 * This lives in one place on purpose: `summarize` and `package-mark` each used to
 * keep a private copy of the walker, and they drifted — the copies missed `.h`,
 * so a header-only assignment scored every student at full marks.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Extensions we scan for annotations. Headers included — some labs are header-only. */
export const ANNOTATABLE_RE =
  /\.(c|cc|cxx|cpp|h|hh|hxx|hpp|txt|md|py|html|css|js)$/i;

/**
 * Our own generated report — it quotes every annotation verbatim, so walking it
 * would double-count each deduction on the next run.
 */
export const REPORT_FILENAME = "report.md";

/** Every annotatable file under `dir`, recursively. Skips dotfiles and our report. */
export function walkAnnotatableFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === REPORT_FILENAME) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAnnotatableFiles(full));
    else if (ANNOTATABLE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Student folders inside an organized-submissions directory, sorted. Dotfiles are
 * skipped so tooling directories (`.claude`, `.git`) are never marked as students.
 */
export function listStudentDirs(submissionsDir: string): string[] {
  return readdirSync(submissionsDir)
    .filter(
      (entry) =>
        !entry.startsWith(".") &&
        statSync(join(submissionsDir, entry)).isDirectory()
    )
    .sort();
}
