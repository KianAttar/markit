import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import type { Logger } from "./logger.js";

export type FileMap = Map<string, { sourcePath: string; timestamp: Date }>;

interface InternalEntry {
  sourcePath: string;
  timestamp: Date;
  depth: number; // 0 = direct submission, 1 = top-level zip, 2 = nested zip, etc.
}

// OS/editor artifacts that should always be discarded
function isJunkFile(relPath: string): boolean {
  const parts = relPath.split("/");
  return (
    parts.includes("__MACOSX") ||
    parts.some((p) => p === ".DS_Store") ||
    parts.some((p) => p.startsWith("._")) ||
    parts.some((p) => p === "Thumbs.db") ||
    parts.some((p) => p === "desktop.ini")
  );
}

// Find the longest common directory prefix shared by all paths.
// Only strips complete directory segments — never the filename itself.
function findCommonPrefix(paths: string[]): string {
  if (paths.length === 0) return "";

  const splitPaths = paths.map((p) => p.split("/"));
  const maxStrippable = Math.min(...splitPaths.map((p) => p.length - 1));

  const common: string[] = [];
  for (let i = 0; i < maxStrippable; i++) {
    const seg = splitPaths[0][i];
    if (splitPaths.every((p) => p[i] === seg)) {
      common.push(seg);
    } else {
      break;
    }
  }

  return common.length > 0 ? common.join("/") + "/" : "";
}

function mergeEntry(
  map: Map<string, InternalEntry>,
  relPath: string,
  candidate: InternalEntry,
  log: Logger
): void {
  const existing = map.get(relPath);
  if (!existing) {
    map.set(relPath, candidate);
    return;
  }
  if (candidate.timestamp > existing.timestamp) {
    map.set(relPath, candidate);
    log.debug({ relPath, reason: "timestamp", winner: candidate.timestamp, loser: existing.timestamp }, "conflict resolved");
  } else if (
    candidate.timestamp.getTime() === existing.timestamp.getTime() &&
    candidate.depth < existing.depth
  ) {
    map.set(relPath, candidate);
    log.debug({ relPath, reason: "depth", winnerDepth: candidate.depth, loserDepth: existing.depth }, "conflict resolved");
  }
}

function extractRecursive(
  zipPath: string,
  timestamp: Date,
  depth: number,
  internalMap: Map<string, InternalEntry>,
  tempDirs: string[],
  pathPrefix: string,
  log: Logger
): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "markit-"));
  tempDirs.push(tempDir);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true);

  log.debug({ zipPath, depth, timestamp }, "expanding zip");

  const validEntries = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => ({ entry: e, name: e.entryName.replace(/\\/g, "/") }))
    .filter(({ name }) => {
      if (isJunkFile(name)) {
        log.debug({ file: name, zipPath }, "junk file discarded");
        return false;
      }
      return true;
    });

  // Compute prefix from regular files only — a nested zip at root would
  // otherwise break the common prefix calculation.
  const regularNames = validEntries
    .filter(({ name }) => !name.toLowerCase().endsWith(".zip"))
    .map(({ name }) => name);
  const commonPrefix = findCommonPrefix(regularNames);

  if (commonPrefix) {
    log.debug({ commonPrefix, zipPath }, "stripping common root prefix");
  }

  const strip = (name: string) =>
    name.startsWith(commonPrefix) ? name.slice(commonPrefix.length) : name;

  const regularEntries = validEntries.filter(
    ({ name }) => !name.toLowerCase().endsWith(".zip")
  );
  const nestedZipEntries = validEntries.filter(({ name }) =>
    name.toLowerCase().endsWith(".zip")
  );

  for (const { entry, name } of regularEntries) {
    const strippedName = strip(name);
    const fullRelPath = pathPrefix ? `${pathPrefix}/${strippedName}` : strippedName;
    const extractedPath = path.join(tempDir, entry.entryName);

    mergeEntry(internalMap, fullRelPath, { sourcePath: extractedPath, timestamp, depth }, log);
  }

  for (const { entry, name } of nestedZipEntries) {
    const strippedName = strip(name);
    const fullRelPath = pathPrefix ? `${pathPrefix}/${strippedName}` : strippedName;
    const extractedPath = path.join(tempDir, entry.entryName);

    const nestedPrefix = path.dirname(fullRelPath).replace(/\\/g, "/");
    extractRecursive(
      extractedPath,
      timestamp,
      depth + 1,
      internalMap,
      tempDirs,
      nestedPrefix === "." ? "" : nestedPrefix,
      log
    );
  }
}

export function resolveZips(
  fileMap: FileMap,
  logger: Logger
): {
  processedZipPaths: string[];
  cleanup: () => void;
} {
  const log = logger.child({ component: "unzip" });
  const tempDirs: string[] = [];
  const internalMap = new Map<string, InternalEntry>();
  const processedZipPaths: string[] = [];

  const zipEntries: Array<[string, { sourcePath: string; timestamp: Date }]> = [];

  for (const [relPath, entry] of fileMap) {
    if (relPath.toLowerCase().endsWith(".zip")) {
      zipEntries.push([relPath, entry]);
    } else {
      internalMap.set(relPath, { ...entry, depth: 0 });
    }
  }

  zipEntries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

  for (const [, entry] of zipEntries) {
    processedZipPaths.push(entry.sourcePath);
    extractRecursive(entry.sourcePath, entry.timestamp, 1, internalMap, tempDirs, "", log);
  }

  fileMap.clear();
  for (const [relPath, entry] of internalMap) {
    fileMap.set(relPath, { sourcePath: entry.sourcePath, timestamp: entry.timestamp });
  }

  return {
    processedZipPaths,
    cleanup: () => {
      for (const dir of tempDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
