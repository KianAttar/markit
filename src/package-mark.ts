import fs from "fs";
import path from "path";
import { summarize } from "./markit-summarize.js";
import { walkAnnotatableFiles, listStudentDirs } from "./annotatable-files.js";

// Writes a marks.csv to artifactsDir with header "fullName,finalMark" and one row
// per student folder, computed from inline `[[ ... | -N ]]` annotations.

export function runPackageMark(orgDir: string, base: number, artifactsDir: string): void {
  fs.mkdirSync(artifactsDir, { recursive: true });

  const students = listStudentDirs(orgDir);

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
