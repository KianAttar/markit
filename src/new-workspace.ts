import fs from "fs/promises";
import path from "path";

const WORKSPACE_SUBDIRS = ["subs", "tmp", "solution", "artifacts"];
const WORKSPACE_EMPTY_FILES = ["doc.md", "progress.md"];

export async function runNewWorkspace(archiveName: string): Promise<void> {
  const root = process.cwd();
  const workspaceDir = path.join(root, "workspace");
  const archiveDir = path.join(root, "archive", archiveName);

  // Verify workspace exists
  try {
    await fs.access(workspaceDir);
  } catch {
    console.error(`Error: workspace/ not found at ${workspaceDir}`);
    process.exit(1);
  }

  // Refuse to overwrite an existing archive entry
  try {
    await fs.access(archiveDir);
    console.error(`Error: archive/${archiveName} already exists`);
    process.exit(1);
  } catch {
    // good — destination is free
  }

  // Ensure archive/ directory exists
  await fs.mkdir(path.join(root, "archive"), { recursive: true });

  // Move workspace → archive/<name>
  await fs.rename(workspaceDir, archiveDir);
  console.log(`Archived workspace → archive/${archiveName}`);

  // Recreate empty workspace
  await fs.mkdir(workspaceDir);
  for (const dir of WORKSPACE_SUBDIRS) {
    await fs.mkdir(path.join(workspaceDir, dir));
  }
  for (const file of WORKSPACE_EMPTY_FILES) {
    await fs.writeFile(path.join(workspaceDir, file), "");
  }
  console.log("Created fresh workspace/");
}
