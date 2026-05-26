/**
 * markit-summarize — parse `[[ ... | -N ]]` deduction annotations and
 * append/update a `/* == MARKIT SUMMARY == *\/` block at the end of the file.
 *
 * The annotation syntax is grep-friendly and idempotent: re-running the
 * summarizer replaces the existing summary block rather than stacking new ones.
 */

export interface SummaryResult {
  /** All annotation blocks found, formatted as `[[ description | -N ]]`. */
  blocks: string[];
  /** Total deductions (always <= 0). */
  total: number;
}

const BLOCK_RE = /\[\[\s*([\s\S]*?)\s*\|\s*-?([\d.]+)\s*\]\]/g;
const SUMMARY_RE = /\n*\/\* == MARKIT SUMMARY ==[\s\S]*?\*\/\s*$/;

export function summarize(
  source: string,
  base: number
): { next: string; result: SummaryResult } {
  // Strip any existing summary block so we don't parse annotations from it
  const cleaned = source.replace(SUMMARY_RE, "");

  const blocks: string[] = [];
  let total = 0;

  for (const match of cleaned.matchAll(BLOCK_RE)) {
    const description = match[1].trim();
    const value = parseFloat(match[2]);
    if (!Number.isFinite(value)) continue;
    blocks.push(`[[ ${description} | -${value} ]]`);
    total -= value;
  }

  const final = base + total;
  const body =
    blocks.length === 0
      ? "  (no issues annotated)"
      : blocks.map((b) => `  ${b}`).join("\n");

  const summary = [
    "/* == MARKIT SUMMARY ==",
    body,
    "  ----",
    `  Base mark        : ${base.toFixed(1)}`,
    `  Total deductions : ${total.toFixed(1)}`,
    `  Final mark       : ${final.toFixed(1)}`,
    "*/",
  ].join("\n");

  const next = cleaned.replace(/\s*$/, "") + "\n\n" + summary + "\n";

  return { next, result: { blocks, total } };
}
