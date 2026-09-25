import { readFileSync } from "node:fs";
import { renderValidationReport } from "./ecosystem-validation.js";

const paths = process.argv.slice(2);

try {
  if (paths.length === 0) {
    throw new Error("Provide one or more validation shard JSON files");
  }

  const documents = paths.map((path) => readFileSync(path, "utf8"));
  const rendered = renderValidationReport(documents);
  process.stdout.write(rendered);

  const report = JSON.parse(rendered) as {
    acceptance?: { pass?: boolean };
  };
  if (report.acceptance?.pass !== true) {
    process.exitCode = 2;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`simarium validation merge failed: ${message}\n`);
  process.exitCode = 1;
}
