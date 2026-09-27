import { readFileSync } from "node:fs";
import {
  mergeBatchShardDocuments,
  renderValidationReport
} from "./ecosystem-validation.js";

const args = process.argv.slice(2);
const summaryOnly = args[0] === "--summary-only";
const paths = summaryOnly ? args.slice(1) : args;

try {
  if (paths.length === 0) {
    throw new Error("Provide one or more validation shard JSON files");
  }

  const documents = paths.map((path) => readFileSync(path, "utf8"));
  if (summaryOnly) {
    process.stdout.write(
      JSON.stringify(mergeBatchShardDocuments(documents), null, 2) + "\n"
    );
  } else {
    const rendered = renderValidationReport(documents);
    process.stdout.write(rendered);

    const report = JSON.parse(rendered) as {
      acceptance?: { pass?: boolean };
    };
    if (report.acceptance?.pass !== true) {
      process.exitCode = 2;
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`simarium validation merge failed: ${message}\n`);
  process.exitCode = 1;
}
