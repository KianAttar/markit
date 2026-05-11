import fs from "fs";
import path from "path";
import { resolveZips, type FileMap } from "./unzip.js";
import type { Logger } from "./logger.js";

export function parseSubmissionFilename(filename: string): {
  studentName: string;
  timestamp: Date;
  originalFilename: string;
} | null {
  // Format: {id} - {Full Name} - {Month D, YYYY HHmm AM/PM} - {filename}
  const match = filename.match(
    /^.+? - (.+?) - ([A-Za-z]+ \d+, \d{4} \d+ [AP]M) - (.+)$/
  );
  if (!match) return null;

  const [, rawName, dateStr, originalFilename] = match;
  const studentName = rawName.trim().replace(/^'+/, "").trim();

  const timestamp = parseSubmissionDate(dateStr);
  if (!timestamp) return null;

  return { studentName, timestamp, originalFilename };
}

export function parseSubmissionDate(dateStr: string): Date | null {
  // e.g. "May 8, 2026 352 PM" or "May 7, 2026 1032 PM"
  const match = dateStr.match(/^(\w+ \d+, \d{4}) (\d+) ([AP]M)$/);
  if (!match) return null;

  const [, datePart, timeRaw, meridiem] = match;

  // timeRaw has no colon: "352" → 3:52, "1253" → 12:53
  let hours: number;
  let minutes: number;
  if (timeRaw.length <= 2) {
    hours = parseInt(timeRaw, 10);
    minutes = 0;
  } else {
    minutes = parseInt(timeRaw.slice(-2), 10);
    hours = parseInt(timeRaw.slice(0, -2), 10);
  }

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const fullStr = `${datePart} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const date = new Date(fullStr);
  return isNaN(date.getTime()) ? null : date;
}

function sanitizeDirName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export function organizeSubmissions(
  inputDir: string,
  logger: Logger,
  outputDir?: string
): void {
  const log = logger.child({ component: "organize" });
  const inPlace = !outputDir;
  const resolvedInput = path.resolve(inputDir);
  const resolvedOutput = outputDir ? path.resolve(outputDir) : resolvedInput;
  const startedAt = Date.now();

  if (!fs.existsSync(resolvedInput)) {
    log.error({ inputDir: resolvedInput }, "input directory does not exist");
    process.exit(1);
  }

  if (!fs.existsSync(resolvedOutput)) {
    fs.mkdirSync(resolvedOutput, { recursive: true });
    log.info({ outputDir: resolvedOutput }, "created output directory");
  }

  const entries = fs.readdirSync(resolvedInput, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);

  const studentMap = new Map<string, FileMap>();
  let skipped = 0;

  for (const file of files) {
    const parsed = parseSubmissionFilename(file);
    if (!parsed) {
      log.warn({ file }, "skipping file with unrecognized format");
      skipped++;
      continue;
    }

    const { studentName, timestamp, originalFilename } = parsed;

    if (!studentMap.has(studentName)) {
      studentMap.set(studentName, new Map());
    }
    const fileMap = studentMap.get(studentName)!;
    const existing = fileMap.get(originalFilename);

    if (!existing || timestamp > existing.timestamp) {
      fileMap.set(originalFilename, {
        sourcePath: path.join(resolvedInput, file),
        timestamp,
      });
    }
  }

  log.info({ students: studentMap.size, submissions: files.length - skipped }, "submissions parsed");

  const counts = { filesWritten: 0, zipsExpanded: 0 };

  for (const [studentName, fileMap] of studentMap) {
    const dirName = sanitizeDirName(studentName);
    const studentDir = path.join(resolvedOutput, dirName);

    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir, { recursive: true });
      log.info({ studentName, studentDir }, "created student folder");
    }

    const { processedZipPaths, cleanup } = resolveZips(fileMap, logger);
    counts.zipsExpanded += processedZipPaths.length;

    for (const [relPath, { sourcePath }] of fileMap) {
      const destPath = path.join(studentDir, relPath);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      if (inPlace && sourcePath.startsWith(resolvedInput)) {
        fs.renameSync(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }

      log.debug({ studentName, file: relPath }, "file written");
      counts.filesWritten++;
    }

    cleanup();

    if (inPlace) {
      for (const zipPath of processedZipPaths) {
        if (fs.existsSync(zipPath)) {
          fs.rmSync(zipPath);
        }
      }
    }
  }

  log.info({
    ...counts,
    students: studentMap.size,
    skipped,
    durationMs: Date.now() - startedAt,
  }, "done");
}
