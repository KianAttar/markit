import { describe, it, expect } from "vitest";
import { summarize } from "./markit-summarize.js";

describe("summarize", () => {
  it("returns empty result when no annotations are present", () => {
    const src = `int main() { return 0; }\n`;
    const { result, next } = summarize(src, 50);
    expect(result.blocks).toEqual([]);
    expect(result.total).toBe(0);
    expect(next).toContain("(no issues annotated)");
    expect(next).toContain("Final mark       : 50.0");
  });

  it("parses a single annotation and subtracts from the base", () => {
    const src = `/* [[ wrong base case | -3 ]] */\nint x;`;
    const { result } = summarize(src, 50);
    expect(result.blocks).toEqual(["[[ wrong base case | -3 ]]"]);
    expect(result.total).toBe(-3);
  });

  it("sums multiple annotations", () => {
    const src = `
      /* [[ issue A | -2 ]] */
      /* [[ issue B | -1.5 ]] */
      /* [[ issue C | -0.5 ]] */
    `;
    const { result } = summarize(src, 50);
    expect(result.blocks).toHaveLength(3);
    expect(result.total).toBe(-4);
  });

  it("supports fractional deductions", () => {
    const src = `/* [[ small thing | -0.25 ]] */`;
    const { result } = summarize(src, 10);
    expect(result.total).toBe(-0.25);
  });

  it("treats -0 as a note with no deduction", () => {
    const src = `/* [[ stylistic | -0 ]] */`;
    const { result } = summarize(src, 50);
    expect(result.blocks).toEqual(["[[ stylistic | -0 ]]"]);
    expect(result.total).toBe(0);
  });

  it("is idempotent — re-running replaces the previous summary block", () => {
    const src = `/* [[ issue | -2 ]] */\n`;
    const first = summarize(src, 50).next;
    const second = summarize(first, 50).next;
    expect(second).toBe(first);
  });

  it("does not parse annotations inside a previous summary block", () => {
    const src = `/* [[ real issue | -1 ]] */\n`;
    const once = summarize(src, 50).next;
    const twice = summarize(once, 50);
    expect(twice.result.blocks).toEqual(["[[ real issue | -1 ]]"]);
    expect(twice.result.total).toBe(-1);
  });
});
