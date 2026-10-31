import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  ANNOTATABLE_RE,
  walkAnnotatableFiles,
  listStudentDirs,
  REPORT_FILENAME,
} from "./annotatable-files.js";

describe("ANNOTATABLE_RE", () => {
  // Regression: the walker originally matched only cpp|txt|html|css|js, so a
  // header-only assignment (Lab 10's Stack.h) summed to zero deductions for
  // every student — the annotations were never read. The same broken copy
  // lived in package-mark.ts, which is why marks.csv stayed wrong after the
  // first fix; both now share this one definition.
  it("matches C/C++ headers", () => {
    for (const f of ["Stack.h", "stack.h", "Stack.hpp", "Stack.hxx"]) {
      expect(ANNOTATABLE_RE.test(f)).toBe(true);
    }
  });

  it("still matches sources and plain text", () => {
    for (const f of ["testStack.cpp", "missing.txt", "index.html"]) {
      expect(ANNOTATABLE_RE.test(f)).toBe(true);
    }
  });

  it("ignores binaries and archives", () => {
    for (const f of ["Stack.exe", "lab10.zip", "a.out"]) {
      expect(ANNOTATABLE_RE.test(f)).toBe(false);
    }
  });
});

describe("walkAnnotatableFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "markit-walk-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("finds a header-only submission", () => {
    writeFileSync(join(root, "Stack.h"), "// header");
    expect(walkAnnotatableFiles(root).map((f) => relative(root, f))).toEqual([
      "Stack.h",
    ]);
  });

  it("skips the generated report so deductions are not double-counted", () => {
    writeFileSync(join(root, "Stack.h"), "/* [[ issue | -2 ]] */");
    writeFileSync(join(root, REPORT_FILENAME), "- `[[ issue | -2 ]]`");
    expect(walkAnnotatableFiles(root).map((f) => relative(root, f))).toEqual([
      "Stack.h",
    ]);
  });

  it("skips dotfiles and dot-directories", () => {
    writeFileSync(join(root, "Stack.h"), "// header");
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude", "notes.txt"), "/* [[ x | -1 ]] */");
    expect(walkAnnotatableFiles(root).map((f) => relative(root, f))).toEqual([
      "Stack.h",
    ]);
  });
});

describe("listStudentDirs", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "markit-students-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns sorted student folders and skips tooling dot-directories", () => {
    for (const d of ["Bob Smith", "Alice Johnson", ".claude", ".git"]) {
      mkdirSync(join(root, d));
    }
    writeFileSync(join(root, "index.html"), "<p>not a student</p>");
    expect(listStudentDirs(root)).toEqual(["Alice Johnson", "Bob Smith"]);
  });
});
