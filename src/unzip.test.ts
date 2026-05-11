import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { resolveZips, type FileMap } from "./unzip.js";
import { createLogger } from "./logger.js";

const logger = createLogger();

// ─── helpers ────────────────────────────────────────────────────────────────

function makeZip(entries: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.from(content));
  }
  return zip.toBuffer();
}

function setupTempDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "markit-test-"));
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function writeZip(dir: string, name: string, entries: Record<string, string>): string {
  const zipPath = path.join(dir, name);
  fs.writeFileSync(zipPath, makeZip(entries));
  return zipPath;
}

function writeZipContainingZip(
  dir: string,
  outerName: string,
  outerFiles: Record<string, string>,
  innerZipName: string,
  innerFiles: Record<string, string>
): string {
  const innerBuf = makeZip(innerFiles);
  const outer = new AdmZip();
  for (const [name, content] of Object.entries(outerFiles)) {
    outer.addFile(name, Buffer.from(content));
  }
  outer.addFile(innerZipName, innerBuf);
  const zipPath = path.join(dir, outerName);
  fs.writeFileSync(zipPath, outer.toBuffer());
  return zipPath;
}

function readResult(fileMap: FileMap): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [relPath, { sourcePath }] of fileMap) {
    result[relPath] = fs.readFileSync(sourcePath, "utf8");
  }
  return result;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("resolveZips", () => {
  let tmp: { dir: string; cleanup: () => void };

  beforeEach(() => {
    tmp = setupTempDir();
  });

  afterEach(() => {
    tmp.cleanup();
  });

  it("strips a single root folder from zip contents", () => {
    const zipPath = writeZip(tmp.dir, "sub.zip", {
      "lab1/a.cpp": "int a;",
      "lab1/b.cpp": "int b;",
    });

    const fileMap: FileMap = new Map([
      ["sub.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result).sort()).toEqual(["a.cpp", "b.cpp"]);
    expect(result["a.cpp"]).toBe("int a;");
    expect(result["b.cpp"]).toBe("int b;");
  });

  it("strips multiple levels of common root folders", () => {
    const zipPath = writeZip(tmp.dir, "sub.zip", {
      "lab4/final/a.cpp": "int a;",
      "lab4/final/b.cpp": "int b;",
    });

    const fileMap: FileMap = new Map([
      ["sub.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result).sort()).toEqual(["a.cpp", "b.cpp"]);
  });

  it("does not strip when files span different top-level paths", () => {
    const zipPath = writeZip(tmp.dir, "sub.zip", {
      "src/main.cpp": "int main;",
      "README.txt": "readme",
    });

    const fileMap: FileMap = new Map([
      ["sub.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result).sort()).toEqual(["README.txt", "src/main.cpp"]);
  });

  it("silently discards junk files from zip contents", () => {
    const zip = new AdmZip();
    zip.addFile("__MACOSX/._main.cpp", Buffer.from("junk"));
    zip.addFile(".DS_Store", Buffer.from("junk"));
    zip.addFile("._main.cpp", Buffer.from("junk"));
    zip.addFile("main.cpp", Buffer.from("int main;"));
    const zipPath = path.join(tmp.dir, "sub.zip");
    fs.writeFileSync(zipPath, zip.toBuffer());

    const fileMap: FileMap = new Map([
      ["sub.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result)).toEqual(["main.cpp"]);
    expect(result["main.cpp"]).toBe("int main;");
  });

  it("later zip wins when two zips contain the same filename", () => {
    const oldZip = writeZip(tmp.dir, "old.zip", { "lab1/main.cpp": "old content" });
    const newZip = writeZip(tmp.dir, "new.zip", { "lab1/main.cpp": "new content" });

    const T1 = new Date("2026-05-08T09:00:00");
    const T2 = new Date("2026-05-08T11:00:00");

    const fileMap: FileMap = new Map([
      ["old.zip", { sourcePath: oldZip, timestamp: T1 }],
      ["new.zip", { sourcePath: newZip, timestamp: T2 }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result)).toEqual(["main.cpp"]);
    expect(result["main.cpp"]).toBe("new content");
  });

  it("parent zip beats nested zip for same filename at same timestamp", () => {
    // outer.zip directly contains main.cpp AND inner.zip which also has main.cpp
    const zipPath = writeZipContainingZip(
      tmp.dir,
      "outer.zip",
      { "main.cpp": "outer content" },
      "inner.zip",
      { "main.cpp": "inner content" }
    );

    const fileMap: FileMap = new Map([
      ["outer.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(result["main.cpp"]).toBe("outer content");
  });

  it("nested zip inherits parent timestamp for conflict resolution", () => {
    // outer.zip (T1) contains inner.zip which contains file.cpp
    // a direct submission of file.cpp at T2 > T1 should win
    const outerZip = writeZipContainingZip(
      tmp.dir,
      "outer.zip",
      {},
      "inner.zip",
      { "file.cpp": "from nested zip" }
    );

    const directFile = path.join(tmp.dir, "file.cpp");
    fs.writeFileSync(directFile, "from direct submission");

    const T1 = new Date("2026-05-08T09:00:00");
    const T2 = new Date("2026-05-08T11:00:00");

    const fileMap: FileMap = new Map([
      ["outer.zip", { sourcePath: outerZip, timestamp: T1 }],
      ["file.cpp", { sourcePath: directFile, timestamp: T2 }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(result["file.cpp"]).toBe("from direct submission");
  });

  it("nested zip at root does not break prefix stripping for sibling files", () => {
    // Reproduces the Samir Victor bug:
    // zip has Lab1/a.cpp, Lab1/b.cpp AND extra.zip at root
    // prefix must still be stripped to a.cpp, b.cpp
    const zipPath = writeZipContainingZip(
      tmp.dir,
      "submission.zip",
      {
        "Lab1/a.cpp": "int a;",
        "Lab1/b.cpp": "int b;",
      },
      "extra.zip",
      { "a.cpp": "from extra" }
    );

    const fileMap: FileMap = new Map([
      ["submission.zip", { sourcePath: zipPath, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    // Lab1/ prefix must be stripped; extra.zip's a.cpp loses on depth tie
    expect(result["a.cpp"]).toBe("int a;");
    expect(result["b.cpp"]).toBe("int b;");
    expect("Lab1/a.cpp" in result).toBe(false);
  });

  it("two zips with entirely different filenames both appear in result", () => {
    const zipA = writeZip(tmp.dir, "a.zip", { "task1.cpp": "task1" });
    const zipB = writeZip(tmp.dir, "b.zip", { "task2.cpp": "task2" });

    const fileMap: FileMap = new Map([
      ["a.zip", { sourcePath: zipA, timestamp: new Date("2026-05-08T09:00:00") }],
      ["b.zip", { sourcePath: zipB, timestamp: new Date("2026-05-08T10:00:00") }],
    ]);

    const { cleanup } = resolveZips(fileMap, logger);
    const result = readResult(fileMap);
    cleanup();

    expect(Object.keys(result).sort()).toEqual(["task1.cpp", "task2.cpp"]);
  });
});
