import { decodeSnapshot, encodeSnapshot, type EncodedSnapshot } from "./compression.js";
import { parseRuntimeSnapshot, type JsonValue, type RuntimeSnapshotV2 } from "./snapshot.js";

export interface SharePresetV1 {
  version: 1;
  seed: number;
  presetId: string;
  config: JsonValue;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    output += ALPHABET[(triple >>> 18) & 63]!;
    output += ALPHABET[(triple >>> 12) & 63]!;
    output += i + 1 < bytes.length ? ALPHABET[(triple >>> 6) & 63]! : "=";
    output += i + 2 < bytes.length ? ALPHABET[triple & 63]! : "=";
  }
  return output;
}

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s/g, "");
  if (clean.length % 4 !== 0) throw new Error("Invalid base64 payload");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chars = clean.slice(i, i + 4);
    const values = [...chars].map((char) => char === "=" ? 0 : ALPHABET.indexOf(char));
    if (values.some((value, index) => value < 0 && chars[index] !== "=")) throw new Error("Invalid base64 payload");
    const triple = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    bytes.push((triple >>> 16) & 255);
    if (chars[2] !== "=") bytes.push((triple >>> 8) & 255);
    if (chars[3] !== "=") bytes.push(triple & 255);
  }
  return new Uint8Array(bytes);
}

export function encodeSharePreset(preset: SharePresetV1): string {
  if (preset.version !== 1 || !Number.isInteger(preset.seed) || preset.presetId.length === 0) {
    throw new Error("Invalid share preset");
  }
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(preset)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeSharePreset(payload: string): SharePresetV1 {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4);
  const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(padded))) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid share preset");
  const record = parsed as Record<string, unknown>;
  if (record.version !== 1 || !Number.isInteger(record.seed) || typeof record.presetId !== "string" || record.presetId.length === 0) {
    throw new Error("Invalid share preset");
  }
  return parsed as SharePresetV1;
}

export type WorldShareId = string;
export interface WorldShareProvider {
  upload(snapshot: RuntimeSnapshotV2): Promise<WorldShareId>;
  download(id: WorldShareId): Promise<RuntimeSnapshotV2>;
}

export async function encodeLivingWorld(snapshot: RuntimeSnapshotV2): Promise<EncodedSnapshot> {
  return encodeSnapshot(parseRuntimeSnapshot(snapshot), true);
}

export class InMemoryWorldShareProvider implements WorldShareProvider {
  private readonly worlds = new Map<WorldShareId, EncodedSnapshot>();
  private nextId = 1;

  async upload(snapshot: RuntimeSnapshotV2): Promise<WorldShareId> {
    const id = `local-${this.nextId++}`;
    const encoded = await encodeLivingWorld(snapshot);
    this.worlds.set(id, { encoding: encoded.encoding, bytes: encoded.bytes.slice() });
    return id;
  }

  async download(id: WorldShareId): Promise<RuntimeSnapshotV2> {
    const encoded = this.worlds.get(id);
    if (!encoded) throw new Error(`Unknown shared world: ${id}`);
    return decodeSnapshot({ encoding: encoded.encoding, bytes: encoded.bytes.slice() });
  }
}
