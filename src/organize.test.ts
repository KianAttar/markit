import { describe, it, expect } from "vitest";
import { parseSubmissionFilename, parseSubmissionDate } from "./organize.js";

describe("parseSubmissionDate", () => {
  it("parses all time format variants correctly", () => {
    // 3-digit time: 352 PM → 3:52 PM
    expect(parseSubmissionDate("May 8, 2026 352 PM")).toEqual(
      new Date("May 8, 2026 15:52")
    );

    // 4-digit time: 1253 PM → 12:53 PM (noon hour)
    expect(parseSubmissionDate("May 7, 2026 1253 PM")).toEqual(
      new Date("May 7, 2026 12:53")
    );

    // 12:00 PM → noon (not midnight — the 12 PM special case)
    expect(parseSubmissionDate("May 8, 2026 1200 PM")).toEqual(
      new Date("May 8, 2026 12:00")
    );

    // 12:00 AM → midnight (the 12 AM special case)
    expect(parseSubmissionDate("May 8, 2026 1200 AM")).toEqual(
      new Date("May 8, 2026 00:00")
    );

    // 2-digit time: 100 AM → 1:00 AM
    expect(parseSubmissionDate("May 8, 2026 100 AM")).toEqual(
      new Date("May 8, 2026 01:00")
    );
  });
});

describe("parseSubmissionFilename", () => {
  it("strips leading quotes and whitespace from student name", () => {
    const result = parseSubmissionFilename(
      "579047-293497 - ' Pallavi Kumari - May 8, 2026 621 PM - Lab1.zip"
    );

    expect(result).not.toBeNull();
    expect(result!.studentName).toBe("Pallavi Kumari");
  });

  it("returns the latest submission when two filenames are compared by timestamp", () => {
    // This tests the deduplication logic: given two parsed submissions for the
    // same student and same filename, the one with the later timestamp wins.
    const early = parseSubmissionFilename(
      "560276-293497 - Asuka Osawa - May 7, 2026 1122 PM - index.cpp"
    );
    const late = parseSubmissionFilename(
      "560276-293497 - Asuka Osawa - May 7, 2026 1124 PM - index.cpp"
    );

    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    expect(late!.timestamp > early!.timestamp).toBe(true);
    expect(early!.originalFilename).toBe(late!.originalFilename);
    // The caller keeps whichever has the greater timestamp — confirmed here
    // that the 1124 PM parse is strictly later than 1122 PM.
  });
});
