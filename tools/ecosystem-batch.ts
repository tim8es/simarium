import { executeBatchCli } from "./ecosystem-cli.js";

try {
  process.stdout.write(executeBatchCli(process.argv.slice(2)));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`simarium ecosystem batch failed: ${message}\n`);
  process.exitCode = 1;
}
