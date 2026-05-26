import fs from "fs";
import path from "path";
import { summarize } from "./markit-summarize.js";

// Usage: tsx src/package-mark.ts <organized-submissions-dir> <base-mark> <artifacts-dir>
//
// Writes a marks.csv to artifacts-dir with header "fullName,finalMark" and one row
// per student folder, computed from inline `[[ ... | -N ]]` annotations.

const [orgDir, baseArg, artifactsDir] = process.argv.slice(2);

if (!orgDir || !baseArg || !artifactsDir) {
  console.error(
    "usage: tsx src/package-mark.ts <organized-submissions-dir> <base-mark> <artifacts-dir>"
  );
  process.exit(1);
}

const base = Number(baseArg);
if (!Number.isFinite(base)) {
  console.error(`base-mark must be a number, got: ${baseArg}`);
  process.exit(1);
}

fs.mkdirSync(artifactsDir, { recursive: true });

const students = fs
  .readdirSync(orgDir)
  .filter((e) => fs.statSync(path.join(orgDir, e)).isDirectory())
  .sort();

const rows: string[] = ["fullName,finalMark"];

for (const name of students) {
  const studentDir = path.join(orgDir, name);
  const files = fs
    .readdirSync(studentDir)
    .filter((f) => f.endsWith(".cpp") || f.endsWith(".txt"));

  const total = files.reduce((sum, f) => {
    const source = fs.readFileSync(path.join(studentDir, f), "utf8");
    return sum + summarize(source, base).result.total;
  }, 0);

  const final = base + total;
  rows.push(`${name},${final.toFixed(1)}`);
}

const outputPath = path.join(artifactsDir, "marks.csv");
fs.writeFileSync(outputPath, rows.join("\n") + "\n");
console.log(`Done → ${outputPath}  (${students.length} students)`);
