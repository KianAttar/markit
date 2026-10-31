/**
 * markit-summarize-all — batch summarize all students in an organized-submissions folder.
 *
 * For each student subfolder, aggregates `[[ ... | -N ]]` deductions across every
 * annotatable source file (see ANNOTATABLE_RE — headers included, since some
 * assignments are header-only), rewrites each file with an updated inline summary
 * block, and writes a `report.md` with a per-file breakdown and final mark.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { summarize, type SummaryResult } from "./markit-summarize.js";
import {
  walkAnnotatableFiles,
  listStudentDirs,
  REPORT_FILENAME,
} from "./annotatable-files.js";

interface FileReport {
  file: string;
  result: SummaryResult;
  next: string;
}

function summarizeStudent(
  studentDir: string,
  base: number
): { files: FileReport[]; total: number; final: number } {
  const sources = walkAnnotatableFiles(studentDir).sort();

  const files: FileReport[] = sources.map((fullPath) => {
    const source = readFileSync(fullPath, "utf8");
    const { next, result } = summarize(source, base);
    return { file: relative(studentDir, fullPath), result, next };
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

export function runSummarizeAll(submissionsDir: string, base: number): void {
  const students = listStudentDirs(submissionsDir);

  if (students.length === 0) {
    console.error(`no student folders found in: ${submissionsDir}`);
    process.exit(1);
  }

  const results: Array<{ name: string; final: number }> = [];

  for (const student of students) {
    const studentDir = join(submissionsDir, student);
    const { files, total, final } = summarizeStudent(studentDir, base);

    for (const { file, next } of files) {
      writeFileSync(join(studentDir, file), next);
    }

    const report = renderReport(student, files, base, total, final);
    writeFileSync(join(studentDir, REPORT_FILENAME), report);

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
