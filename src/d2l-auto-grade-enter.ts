import { chromium, type Page, type Locator, type Frame } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

// Direct translation of grade_enterer.py — same selectors, same flow.
//
// Usage: tsx src/cli.ts d2l-enter <marks.csv>
// CSV columns expected: fullName,finalMark   (the marks.csv produced by `markit package-mark`)

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

interface Record { fullName: string; finalMark: string; }

function loadCsv(filePath: string): Record[] {
  const text = fs.readFileSync(filePath, "utf8").trim();
  const [, ...lines] = text.split(/\r?\n/);
  const records: Record[] = [];
  for (const line of lines) {
    const comma = line.lastIndexOf(",");
    if (comma === -1) continue;
    const fullName = line.slice(0, comma).trim();
    const finalMark = line.slice(comma + 1).trim();
    if (fullName) records.push({ fullName, finalMark });
  }
  return records;
}

// Python: `r",?\s+".join(re.escape(word) for word in student_name.split(" "))`
function buildNamePattern(fullName: string): RegExp {
  const words = fullName.split(" ").filter(Boolean);
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join(",?\\s+"), "i");
}

// Python: driver.execute_script("arguments[0].click();", grade_component)
//         grade_component.send_keys(str(grade_value))
async function setGradeForRow(row: Locator, gradeValue: string): Promise<void> {
  try {
    const gradeComponent = row.locator("xpath=.//d2l-input-number").first();
    // JS-click — bypasses Playwright actionability checks, matches execute_script
    await gradeComponent.evaluate((el: Element) => (el as HTMLElement).click());
    // send_keys on the web component itself (not the inner <input>)
    await gradeComponent.pressSequentially(String(gradeValue));
    const rowText = (await row.innerText()).trim().slice(0, 100);
    console.log(`Entered grade ${gradeValue} for row: ${rowText}...`);
  } catch (err) {
    console.log("Error setting grade for a row:", err);
  }
}

export async function runD2lAutoGradeEnter(csvPath: string): Promise<void> {
  const csvAbs = path.resolve(csvPath);
  if (!fs.existsSync(csvAbs)) {
    console.error(`CSV not found: ${csvAbs}`);
    process.exit(1);
  }

  const userDataDir = path.join(os.homedir(), ".markit-d2l-profile");
  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page: Page = context.pages()[0] ?? await context.newPage();
  await page.goto("https://d2l.langara.bc.ca/d2l/home");

  while (true) {
    // Python: driver.get("https://d2l.langara.bc.ca/d2l/home")
    await page.goto("https://d2l.langara.bc.ca/d2l/home");
    await prompt(
      "If not already logged in, log in once (your session is saved). Then navigate to the grade list for the specific assignment and press Enter here to continue..."
    );
    console.log("proceeding with automation...");

    // Python: pd.read_csv(path)  — using csvAbs passed in
    const df = loadCsv(csvAbs);

    // Python: WebDriverWait(driver, 10).until(presence_of_element_located(...))
    //         driver.switch_to.frame(iframe)
    const iframeElement = await page.waitForSelector(
      "xpath=//iframe[contains(@class, 'd2l-dialog-frame')]",
      { timeout: 10_000 }
    );
    const frame: Frame | null = await iframeElement.contentFrame();
    if (!frame) {
      console.error("Could not switch into d2l-dialog-frame iframe");
      continue;
    }

    // Python: driver.find_elements(By.XPATH, "//tbody/tr[.//d2l-input-number]")
    const allRows = await frame.locator("xpath=//tbody/tr[.//d2l-input-number]").all();
    console.log("Total student rows found:", allRows.length);

    // Python: remaining_rows = list(all_rows)
    const remainingRows = [...allRows];

    // Python: for index, record in df.iterrows():
    for (const record of df) {
      const studentName = record.fullName.trim();
      const gradeValue = record.finalMark;

      const pattern = buildNamePattern(studentName);

      let matchingRowIndex = -1;
      for (let i = 0; i < remainingRows.length; i++) {
        const rowText = (await remainingRows[i].innerText()).trim();
        if (pattern.test(rowText)) {
          matchingRowIndex = i;
          break;
        }
      }

      if (matchingRowIndex >= 0) {
        await setGradeForRow(remainingRows[matchingRowIndex], gradeValue);
        remainingRows.splice(matchingRowIndex, 1);
      } else {
        console.log(`Could not find a row for student: ${studentName}`);
      }
    }

    // Python: for any rows left, assign 0
    for (const row of remainingRows) {
      await setGradeForRow(row, "0");
      const rowText = (await row.innerText()).trim().slice(0, 100);
      console.log("Assigned 0 to a leftover row:", rowText);
    }

    console.log("Grade entry complete. Please review the marks on the page.");
    const command = await prompt("Do you have more grade to enter? (Y/N)");
    if (command.toLowerCase().trim().charAt(0) !== "y") {
      console.log("goodbye...");
      break;
    }

    // Python: driver.switch_to.default_content()
    // In Playwright we just re-acquire the frame next iteration via page.waitForSelector
  }

  await context.close();
}
