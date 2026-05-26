import fs from "fs";
import path from "path";
import { summarize } from "./markit-summarize.js";

function walkAnnotatableFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAnnotatableFiles(full));
    else if (/\.(cpp|txt|html|css|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Writes a marks.csv to artifactsDir with header "fullName,finalMark" and one row
// per student folder, computed from inline `[[ ... | -N ]]` annotations.

export function runPackageMark(orgDir: string, base: number, artifactsDir: string): void {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const students = fs
    .readdirSync(orgDir)
    .filter((e) => fs.statSync(path.join(orgDir, e)).isDirectory())
    .sort();

  const rows: string[] = ["fullName,finalMark"];

  for (const name of students) {
    const studentDir = path.join(orgDir, name);
    const files = walkAnnotatableFiles(studentDir);

    const total = files.reduce((sum, f) => {
      const source = fs.readFileSync(f, "utf8");
      return sum + summarize(source, base).result.total;
    }, 0);

    const final = base + total;
    rows.push(`${name},${final.toFixed(1)}`);
  }

  const outputPath = path.join(artifactsDir, "marks.csv");
  fs.writeFileSync(outputPath, rows.join("\n") + "\n");
  console.log(`Done → ${outputPath}  (${students.length} students)`);
}
