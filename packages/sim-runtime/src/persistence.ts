import { decodeSnapshot, encodeSnapshot, type SnapshotEncoding } from "./compression.js";
import { parseRuntimeSnapshot, type RuntimeSnapshotV2 } from "./snapshot.js";

export interface WorldSaveMetadata {
  id: string;
  schemaVersion: number;
  seed: number;
  simulationVersion: string;
  speciesDataVersion: string;
  createdAt: string;
  updatedAt: string;
  virtualTime: number;
  title?: string;
}

export interface SaveWorldOptions { id?: string; title?: string; compress?: boolean }
export interface WorldPersistenceProvider {
  save(snapshot: RuntimeSnapshotV2, options?: SaveWorldOptions): Promise<WorldSaveMetadata>;
  load(id: string): Promise<RuntimeSnapshotV2>;
  list(): Promise<WorldSaveMetadata[]>;
  delete(id: string): Promise<void>;
}

interface StoredWorldRecord {
  metadata: WorldSaveMetadata;
  encoding: SnapshotEncoding;
  payload: Uint8Array;
}

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function metadataFor(snapshot: RuntimeSnapshotV2, id: string, createdAt: string, title?: string): WorldSaveMetadata {
  const metadata: WorldSaveMetadata = {
    id,
    schemaVersion: snapshot.schemaVersion,
    seed: snapshot.seed,
    simulationVersion: snapshot.simulationVersion,
    speciesDataVersion: snapshot.speciesDataVersion,
    createdAt,
    updatedAt: new Date().toISOString(),
    virtualTime: snapshot.virtualTime
  };
  if (title !== undefined) metadata.title = title;
  return metadata;
}

export class InMemoryWorldPersistence implements WorldPersistenceProvider {
  private readonly records = new Map<string, StoredWorldRecord>();

  async save(snapshot: RuntimeSnapshotV2, options: SaveWorldOptions = {}): Promise<WorldSaveMetadata> {
    const valid = parseRuntimeSnapshot(snapshot);
    const id = options.id ?? generateId();
    const previous = this.records.get(id);
    const createdAt = previous?.metadata.createdAt ?? new Date().toISOString();
    const title = options.title ?? previous?.metadata.title;
    const encoded = await encodeSnapshot(valid, options.compress ?? true);
    const metadata = metadataFor(valid, id, createdAt, title);
    this.records.set(id, { metadata: structuredClone(metadata), encoding: encoded.encoding, payload: encoded.bytes.slice() });
    return structuredClone(metadata);
  }

  async load(id: string): Promise<RuntimeSnapshotV2> {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown saved world: ${id}`);
    return decodeSnapshot({ encoding: record.encoding, bytes: record.payload.slice() });
  }

  async list(): Promise<WorldSaveMetadata[]> {
    return [...this.records.values()].map((record) => structuredClone(record.metadata)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IndexedDbWorldPersistence implements WorldPersistenceProvider {
  private readonly factory: IDBFactory;
  constructor(private readonly dbName = "simarium", factory?: IDBFactory) {
    const resolved = factory ?? globalThis.indexedDB;
    if (!resolved) throw new Error("IndexedDB is not available in this runtime");
    this.factory = resolved;
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("worlds")) {
          const store = db.createObjectStore("worlds", { keyPath: "metadata.id" });
          store.createIndex("updatedAt", "metadata.updatedAt");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
  }

  async save(snapshot: RuntimeSnapshotV2, options: SaveWorldOptions = {}): Promise<WorldSaveMetadata> {
    const db = await this.open();
    try {
      const valid = parseRuntimeSnapshot(snapshot);
      const id = options.id ?? generateId();
      const readTx = db.transaction("worlds", "readonly");
      const previous = await requestResult(readTx.objectStore("worlds").get(id) as IDBRequest<StoredWorldRecord | undefined>);
      await transactionDone(readTx);
      const createdAt = previous?.metadata.createdAt ?? new Date().toISOString();
      const title = options.title ?? previous?.metadata.title;
      const encoded = await encodeSnapshot(valid, options.compress ?? true);
      const metadata = metadataFor(valid, id, createdAt, title);
      const record: StoredWorldRecord = { metadata, encoding: encoded.encoding, payload: encoded.bytes };
      const writeTx = db.transaction("worlds", "readwrite");
      writeTx.objectStore("worlds").put(record);
      await transactionDone(writeTx);
      return metadata;
    } finally {
      db.close();
    }
  }

  async load(id: string): Promise<RuntimeSnapshotV2> {
    const db = await this.open();
    try {
      const tx = db.transaction("worlds", "readonly");
      const record = await requestResult(tx.objectStore("worlds").get(id) as IDBRequest<StoredWorldRecord | undefined>);
      await transactionDone(tx);
      if (!record) throw new Error(`Unknown saved world: ${id}`);
      return decodeSnapshot({ encoding: record.encoding, bytes: new Uint8Array(record.payload) });
    } finally {
      db.close();
    }
  }

  async list(): Promise<WorldSaveMetadata[]> {
    const db = await this.open();
    try {
      const tx = db.transaction("worlds", "readonly");
      const records = await requestResult(tx.objectStore("worlds").getAll() as IDBRequest<StoredWorldRecord[]>);
      await transactionDone(tx);
      return records.map((record) => record.metadata).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    try {
      const tx = db.transaction("worlds", "readwrite");
      tx.objectStore("worlds").delete(id);
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
}
