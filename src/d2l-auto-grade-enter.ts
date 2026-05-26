import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import readline from "readline";

// Usage: tsx src/d2l-auto-grade-enter.ts <marks.csv>
//
// CSV format expected: fullName,finalMark
// Launches a real Chromium window — log in manually, navigate to the D2L grade
// list for the assignment, then press Enter to start automation.

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: tsx src/d2l-auto-grade-enter.ts <marks.csv>");
  process.exit(1);
}

const csvAbs = path.resolve(csvPath);
if (!fs.existsSync(csvAbs)) {
  console.error(`CSV not found: ${csvAbs}`);
  process.exit(1);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

function loadGrades(filePath: string): Map<string, number> {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const grades = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const comma = line.lastIndexOf(",");
    if (comma === -1) continue;
    const name = line.slice(0, comma).trim();
    const mark = parseFloat(line.slice(comma + 1).trim());
    if (name && Number.isFinite(mark)) grades.set(name, mark);
  }
  return grades;
}

// Build a regex that matches a student name allowing for optional comma/whitespace
// between words (e.g. "Last, First" vs "First Last")
function namePattern(fullName: string): RegExp {
  const words = fullName.trim().split(/\s+/);
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(",?\\s+");
  return new RegExp(pattern, "i");
}

async function enterGrades(
  page: import("playwright").Page,
  grades: Map<string, number>
): Promise<void> {
  const iframeLocator = page.frameLocator("iframe.d2l-dialog-frame");

  console.log("Waiting for grade table inside iframe...");
  await iframeLocator.locator("tbody tr d2l-input-number").first().waitFor({ timeout: 30_000 });

  const rows = iframeLocator.locator("tbody tr:has(d2l-input-number)");
  const rowCount = await rows.count();
  console.log(`Found ${rowCount} student rows.`);

  const unmatched: number[] = [];

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const rowText = (await row.innerText()).trim();

    let matched = false;
    for (const [name, mark] of grades) {
      if (namePattern(name).test(rowText)) {
        await setGrade(row, mark);
        console.log(`  ✓ ${name} → ${mark}`);
        grades.delete(name);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatched.push(i);
    }
  }

  for (const [name] of grades) {
    console.warn(`  [warn] no row found for: ${name}`);
  }

  for (const i of unmatched) {
    const row = rows.nth(i);
    const rowText = (await row.innerText()).trim().slice(0, 80);
    await setGrade(row, 0);
    console.log(`  0 assigned to unmatched row: ${rowText}...`);
  }
}

async function setGrade(
  row: import("playwright").Locator,
  value: number
): Promise<void> {
  const component = row.locator("d2l-input-number").first();
  await component.click();
  // The web component exposes an inner <input> — fill that directly
  const innerInput = component.locator("input");
  await innerInput.fill(String(value));
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://d2l.langara.bc.ca/d2l/home");

  while (true) {
    await prompt(
      "\nLog in and navigate to the grade list for the assignment, then press Enter to continue..."
    );
    console.log("Proceeding with automation...");

    const grades = loadGrades(csvAbs);
    console.log(`Loaded ${grades.size} students from ${csvAbs}`);

    try {
      await enterGrades(page, grades);
      console.log("\nGrade entry complete. Review the marks on the page before saving.");
    } catch (err) {
      console.error("Error during grade entry:", err);
    }

    const again = await prompt("\nEnter grades for another assignment? (y/N): ");
    if (!again.trim().toLowerCase().startsWith("y")) {
      console.log("Goodbye.");
      break;
    }
  }

  await browser.close();
}

main();
