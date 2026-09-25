import { deserializeRuntimeSnapshot, serializeRuntimeSnapshot, type RuntimeSnapshotV2 } from "./snapshot.js";

export type SnapshotEncoding = "json" | "gzip-json";
export interface EncodedSnapshot { encoding: SnapshotEncoding; bytes: Uint8Array }

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new Blob([bytes]).stream();
  const readable = source.pipeThrough(stream);
  return new Uint8Array(await new Response(readable).arrayBuffer());
}

export async function encodeSnapshot(snapshot: RuntimeSnapshotV2, compress = true): Promise<EncodedSnapshot> {
  const raw = new TextEncoder().encode(serializeRuntimeSnapshot(snapshot));
  if (!compress || typeof CompressionStream === "undefined") return { encoding: "json", bytes: raw };
  const bytes = await transform(raw, new CompressionStream("gzip"));
  return bytes.byteLength < raw.byteLength ? { encoding: "gzip-json", bytes } : { encoding: "json", bytes: raw };
}

export async function decodeSnapshot(encoded: EncodedSnapshot): Promise<RuntimeSnapshotV2> {
  let bytes = encoded.bytes;
  if (encoded.encoding === "gzip-json") {
    if (typeof DecompressionStream === "undefined") throw new Error("gzip snapshot decoding is not supported by this runtime");
    bytes = await transform(bytes, new DecompressionStream("gzip"));
  } else if (encoded.encoding !== "json") {
    throw new Error(`Unsupported snapshot encoding: ${String(encoded.encoding)}`);
  }
  return deserializeRuntimeSnapshot(new TextDecoder().decode(bytes));
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export interface SnapshotEncodingMetrics {
  rawJsonBytes: number;
  compressedBytes: number;
  serializationMs: number;
  compressionMs: number;
  deserializationMs: number;
}

export async function measureSnapshotEncoding(snapshot: RuntimeSnapshotV2): Promise<SnapshotEncodingMetrics> {
  const serializeStart = now();
  const json = serializeRuntimeSnapshot(snapshot);
  const serializationMs = now() - serializeStart;
  const raw = new TextEncoder().encode(json);

  const compressionStart = now();
  const encoded = await encodeSnapshot(snapshot, true);
  const compressionMs = now() - compressionStart;

  const deserializeStart = now();
  await decodeSnapshot(encoded);
  const deserializationMs = now() - deserializeStart;

  return {
    rawJsonBytes: raw.byteLength,
    compressedBytes: encoded.bytes.byteLength,
    serializationMs,
    compressionMs,
    deserializationMs
  };
}
