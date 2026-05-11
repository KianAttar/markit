import { organizeSubmissions } from "./organize.js";
import { createLogger } from "./logger.js";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: tsx src/index.ts <input-dir> [output-dir]");
  process.exit(1);
}

const logger = createLogger();
const [inputDir, outputDir] = args;
organizeSubmissions(inputDir, logger, outputDir);
