import fs from "fs";
import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import { resolveZips, type FileMap } from "./unzip.js";
import type { Logger } from "./logger.js";

// pdf-parse v1 is CJS and has no ESM default export
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

// Minimal RTF → text extractor for simple documents (e.g. Apple TextEdit output)
function rtfToText(rtf: string): string {
  let text = rtf;

  // Strip metadata groups (font/color tables, stylesheet, info, pictures) with nested braces
  text = stripGroups(text, ["fonttbl", "colortbl", "stylesheet", "info", "pict", "filetbl", "listtable"]);

  // \'hh hex escapes
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // \uNNNN? unicode escapes
  text = text.replace(/\\u(-?\d+)\??/g, (_, num) => {
    let code = parseInt(num, 10);
    if (code < 0) code += 65536;
    return String.fromCharCode(code);
  });

  // Common control words → whitespace
  text = text.replace(/\\par\b/g, "\n");
  text = text.replace(/\\line\b/g, "\n");
  text = text.replace(/\\tab\b/g, "\t");

  // Strip remaining control words (with optional numeric param and trailing space)
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, "");

  // Strip control symbols (\\, \{, \}, \*, etc.)
  text = text.replace(/\\[^a-zA-Z]/g, "");

  // Strip braces
  text = text.replace(/[{}]/g, "");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function stripGroups(rtf: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(`\\{\\\\\\*?\\\\${name}\\b`);
    let result = "";
    let i = 0;
    while (i < rtf.length) {
      const match = rtf.slice(i).match(re);
      if (!match || match.index === undefined) {
        result += rtf.slice(i);
        break;
      }
      result += rtf.slice(i, i + match.index);
      // Find matching closing brace
      let depth = 1;
      let j = i + match.index + 1;
      while (j < rtf.length && depth > 0) {
        if (rtf[j] === "\\" && j + 1 < rtf.length) {
          j += 2;
          continue;
        }
        if (rtf[j] === "{") depth++;
        else if (rtf[j] === "}") depth--;
        j++;
      }
      i = j;
    }
    rtf = result;
  }
  return rtf;
}

async function convertToText(srcPath: string, destTxt: string, log: Logger): Promise<boolean> {
  const ext = path.extname(srcPath).toLowerCase();
  try {
    let text: string;
    if (ext === ".pdf") {
      const buf = fs.readFileSync(srcPath);
      const data = await pdfParse(buf);
      text = data.text;
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: srcPath });
      text = result.value;
    } else if (ext === ".rtf") {
      const buf = fs.readFileSync(srcPath, "utf8");
      text = rtfToText(buf);
    } else {
      return false;
    }
    fs.writeFileSync(destTxt, text, "utf8");
    return true;
  } catch (err) {
    log.warn({ srcPath, err }, "text extraction failed");
    return false;
  }
}

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

export async function organizeSubmissions(
  inputDir: string,
  logger: Logger,
  outputDir?: string
): Promise<void> {
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

      // For PDF/DOCX/RTF, also drop a sibling .txt with extracted text so the
      // annotation/summarize pipeline can read it.
      const ext = path.extname(destPath).toLowerCase();
      if (ext === ".pdf" || ext === ".docx" || ext === ".rtf") {
        const txtPath = destPath.replace(new RegExp(`${ext}$`), ".txt");
        await convertToText(destPath, txtPath, log);
      }
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
