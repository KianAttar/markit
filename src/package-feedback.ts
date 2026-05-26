import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

// Usage: tsx src/package-feedback.ts <submissions-dir> <organized-submissions-dir> <artifacts-dir>
//
// Reads original submission filenames (format: "{id} - {name} - {date} - {filename}")
// to recover each student's submission id, then zips their annotated folder as
// "{id} - {name}.zip" and bundles them all into feedbacks.zip inside artifacts-dir.

const [subsDir, orgDir, artifactsDir] = process.argv.slice(2);

if (!subsDir || !orgDir || !artifactsDir) {
  console.error(
    "usage: tsx src/package-feedback.ts <submissions-dir> <organized-submissions-dir> <artifacts-dir>"
  );
  process.exit(1);
}

fs.mkdirSync(artifactsDir, { recursive: true });

function parseSubmissionFilename(filename: string): { id: string; name: string } | null {
  const parts = filename.split(" - ");
  if (parts.length < 2) return null;
  const id = parts[0];
  let name = parts[1];
  // Some LMS systems prepend "' " to student names
  name = name.replace(/^' /, "");
  return { id, name };
}

function addDirToZip(zip: AdmZip, dirPath: string, zipPrefix: string) {
  for (const entry of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, entry);
    const entryInZip = path.join(zipPrefix, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      addDirToZip(zip, fullPath, entryInZip);
    } else {
      zip.addLocalFile(fullPath, path.dirname(entryInZip));
    }
  }
}

const entries = fs.readdirSync(subsDir);
const studentZips: { name: string; buffer: Buffer }[] = [];
let skipped = 0;

for (const filename of entries) {
  const fullPath = path.join(subsDir, filename);
  if (!fs.statSync(fullPath).isFile()) continue;
  if (filename.endsWith(".html")) continue;

  const parsed = parseSubmissionFilename(filename);
  if (!parsed) {
    console.warn(`  [warn] could not parse: ${filename}`);
    skipped++;
    continue;
  }

  const { id, name } = parsed;
  const studentDir = path.join(orgDir, name);

  if (!fs.existsSync(studentDir) || !fs.statSync(studentDir).isDirectory()) {
    console.warn(`  [warn] no annotated folder for '${name}' — skipping`);
    skipped++;
    continue;
  }

  const zipName = `${id} - ${name}.zip`;
  console.log(`  → ${zipName}`);

  const zip = new AdmZip();
  addDirToZip(zip, studentDir, name);
  studentZips.push({ name: zipName, buffer: zip.toBuffer() });
}

console.log(`\nBundling ${studentZips.length} zips into feedbacks.zip...`);
const feedbacksZip = new AdmZip();
for (const { name, buffer } of studentZips) {
  feedbacksZip.addFile(name, buffer);
}

const outputPath = path.join(artifactsDir, "feedbacks.zip");
feedbacksZip.writeZip(outputPath);

console.log(
  `Done → ${outputPath}  (${studentZips.length} students${skipped > 0 ? `, ${skipped} skipped` : ""})`
);
