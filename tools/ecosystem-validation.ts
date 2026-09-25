import {
  evaluateMvpAcceptance,
  mergeBatchSummaries,
  type BatchSummary,
  type MvpAcceptance
} from "./ecosystem-analysis.js";

export interface ValidationReport {
  summary: BatchSummary;
  acceptance: MvpAcceptance;
}

function parseShardDocument(document: string, index: number): BatchSummary {
  let value: unknown;
  try {
    value = JSON.parse(document);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in validation shard ${index}: ${detail}`);
  }

  if (!value || typeof value !== "object") {
    throw new Error(`Validation shard ${index} JSON must contain an object`);
  }

  const candidate = value as Partial<BatchSummary>;
  if (
    !Number.isInteger(candidate.days) ||
    !Array.isArray(candidate.seeds) ||
    !Number.isInteger(candidate.runCount) ||
    !Array.isArray(candidate.runOutcomes)
  ) {
    throw new Error(
      `Validation shard ${index} JSON is not a BatchSummary`
    );
  }

  return value as BatchSummary;
}

export function mergeValidationShardDocuments(
  documents: string[]
): ValidationReport {
  if (documents.length === 0) {
    throw new Error("At least one validation shard JSON document is required");
  }

  const summaries = documents.map(parseShardDocument);
  const summary = mergeBatchSummaries(summaries);

  return {
    summary,
    acceptance: evaluateMvpAcceptance(summary)
  };
}


export function renderValidationReport(
  documents: string[]
): string {
  return JSON.stringify(
    mergeValidationShardDocuments(documents),
    null,
    2
  ) + "\n";
}
