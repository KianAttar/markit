#!/usr/bin/env tsx
import { Command } from "commander";
import { createLogger } from "./logger.js";
import { organizeSubmissions } from "./organize.js";
import { runSummarizeAll } from "./markit-summarize-all.js";
import { runPackageFeedback } from "./package-feedback.js";
import { runPackageMark } from "./package-mark.js";
import { runD2lAutoGradeEnter } from "./d2l-auto-grade-enter.js";

const program = new Command();

program
  .name("markit")
  .description("CLI for organizing, annotating, packaging, and submitting student grades")
  .version("1.0.0");

program
  .command("organize")
  .description("Organize raw LMS submissions into per-student folders (expands zips, extracts text from PDF/DOCX/RTF)")
  .argument("<input-dir>", "directory containing raw submission files")
  .argument("[output-dir]", "where to write organized folders (defaults to in-place)")
  .action(async (inputDir: string, outputDir: string | undefined) => {
    const logger = createLogger();
    await organizeSubmissions(inputDir, logger, outputDir);
  });

program
  .command("summarize")
  .description("Aggregate inline `[[ ... | -N ]]` annotations across all student folders and write per-student report.md")
  .argument("<organized-dir>", "organized-submissions directory")
  .option("-b, --base <mark>", "base mark before deductions", "50")
  .action((organizedDir: string, opts: { base: string }) => {
    const base = Number(opts.base);
    if (!Number.isFinite(base)) {
      console.error(`--base must be a number, got: ${opts.base}`);
      process.exit(1);
    }
    runSummarizeAll(organizedDir, base);
  });

program
  .command("package-feedback")
  .description("Zip each annotated student folder as '{id} - {name}.zip' and bundle into feedbacks.zip")
  .argument("<submissions-dir>", "original LMS submissions directory (used to recover submission IDs)")
  .argument("<organized-dir>", "organized-submissions directory with annotated files")
  .option("-o, --out <dir>", "artifacts output directory", "artifacts")
  .action((subsDir: string, orgDir: string, opts: { out: string }) => {
    runPackageFeedback(subsDir, orgDir, opts.out);
  });

program
  .command("package-mark")
  .description("Generate marks.csv (fullName,finalMark) from annotated student folders")
  .argument("<organized-dir>", "organized-submissions directory")
  .option("-b, --base <mark>", "base mark before deductions", "50")
  .option("-o, --out <dir>", "artifacts output directory", "artifacts")
  .action((orgDir: string, opts: { base: string; out: string }) => {
    const base = Number(opts.base);
    if (!Number.isFinite(base)) {
      console.error(`--base must be a number, got: ${opts.base}`);
      process.exit(1);
    }
    runPackageMark(orgDir, base, opts.out);
  });

program
  .command("d2l-enter")
  .description("Automate grade entry into D2L Brightspace from a marks.csv (launches Chromium for manual login)")
  .argument("<csv>", "path to marks.csv with fullName,finalMark columns")
  .action(async (csv: string) => {
    await runD2lAutoGradeEnter(csv);
  });

program.parseAsync(process.argv);
