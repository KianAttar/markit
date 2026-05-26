/**
 * markit-summarize-all — batch summarize all students in an organized-submissions folder.
 *
 *   tsx src/markit-summarize-all.ts <organized-submissions-dir> <base-mark>
 *
 * For each student subfolder, aggregates `[[ ... | -N ]]` deductions across all
 * `.cpp` and `.txt` files, rewrites each file with an updated inline summary block,
 * and writes a `report.md` with a per-file breakdown and final mark.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { summarize, type SummaryResult } from "./markit-summarize.js";

interface FileReport {
  file: string;
  result: SummaryResult;
  next: string;
}

function summarizeStudent(
  studentDir: string,
  base: number
): { files: FileReport[]; total: number; final: number } {
  const entries = readdirSync(studentDir);
  const sources = entries
    .filter((f) => f.endsWith(".cpp") || f.endsWith(".txt"))
    .sort();

  const files: FileReport[] = sources.map((f) => {
    const path = join(studentDir, f);
    const source = readFileSync(path, "utf8");
    const { next, result } = summarize(source, base);
    return { file: f, result, next };
  });

  const total = files.reduce((sum, f) => sum + f.result.total, 0);
  const final = base + total;

  return { files, total, final };
}

function renderReport(
  studentName: string,
  files: FileReport[],
  base: number,
  total: number,
  final: number
): string {
  const lines: string[] = [];
  lines.push(`# Markit Report — ${studentName}`);
  lines.push("");

  for (const { file, result } of files) {
    lines.push(`## ${file}`);
    if (result.blocks.length === 0) {
      lines.push("_(no issues annotated)_");
    } else {
      for (const block of result.blocks) {
        lines.push(`- \`${block}\``);
      }
    }
    lines.push(`**File deductions:** ${result.total.toFixed(1)}`);
    lines.push("");
  }

  lines.push("---");
  lines.push(`**Base mark        :** ${base.toFixed(1)}`);
  lines.push(`**Total deductions :** ${total.toFixed(1)}`);
  lines.push(`**Final mark       :** ${final.toFixed(1)}`);
  lines.push("");

  return lines.join("\n");
}

function main(): void {
  const [, , submissionsDir, baseArg] = process.argv;

  if (!submissionsDir || !baseArg) {
    console.error(
      "usage: tsx src/markit-summarize-all.ts <organized-submissions-dir> <base-mark>"
    );
    process.exit(1);
  }

  const base = Number(baseArg);
  if (!Number.isFinite(base)) {
    console.error(`base-mark must be a number, got: ${baseArg}`);
    process.exit(1);
  }

  const students = readdirSync(submissionsDir).filter((entry) =>
    statSync(join(submissionsDir, entry)).isDirectory()
  );

  if (students.length === 0) {
    console.error(`no student folders found in: ${submissionsDir}`);
    process.exit(1);
  }

  const results: Array<{ name: string; final: number }> = [];

  for (const student of students.sort()) {
    const studentDir = join(submissionsDir, student);
    const { files, total, final } = summarizeStudent(studentDir, base);

    for (const { file, next } of files) {
      writeFileSync(join(studentDir, file), next);
    }

    const report = renderReport(student, files, base, total, final);
    writeFileSync(join(studentDir, "report.md"), report);

    console.log(
      `${student.padEnd(30)} deductions=${total.toFixed(1).padStart(6)}  final=${final.toFixed(1)}`
    );

    results.push({ name: student, final });
  }

  const avg = results.reduce((s, r) => s + r.final, 0) / results.length;
  console.log("");
  console.log(
    `${students.length} students processed  avg=${avg.toFixed(1)}  base=${base.toFixed(1)}`
  );
}

main();
