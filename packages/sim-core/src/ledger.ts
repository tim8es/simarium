import {
  MATERIAL_KEYS,
  addMaterial,
  assertFiniteMaterial,
  assertNonNegativeMaterial,
  cloneMaterial,
  type Material,
  zeroMaterial
} from "./material.js";

export interface LedgerSnapshot {
  pools: Record<string, Material>;
  cumulativeBoundaryFlux: Material;
}

export interface TransferEvent {
  from: string;
  to: string;
  amount: Material;
  sourceBefore: Material;
}

export type TransferObserver = (event: TransferEvent) => void;

export class MassLedger {
  private readonly pools = new Map<string, Material>();
  private readonly observers = new Set<TransferObserver>();
  private boundaryFlux: Material;

  constructor(
    initialPools: Record<string, Material>,
    cumulativeBoundaryFlux: Material = zeroMaterial()
  ) {
    for (const [name, value] of Object.entries(initialPools)) {
      assertNonNegativeMaterial(value, `pool:${name}`);
      this.pools.set(name, cloneMaterial(value));
    }
    assertFiniteMaterial(cumulativeBoundaryFlux, "cumulativeBoundaryFlux");
    this.boundaryFlux = cloneMaterial(cumulativeBoundaryFlux);
  }

  hasPool(name: string): boolean {
    return this.pools.has(name);
  }

  getPool(name: string): Material {
    return cloneMaterial(this.requirePool(name));
  }

  poolNames(): string[] {
    return [...this.pools.keys()];
  }

  observeTransfers(observer: TransferObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  transfer(from: string, to: string, amount: Material): void {
    if (from === to) return;
    assertNonNegativeMaterial(amount, "transfer");

    const source = this.requirePool(from);
    const destination = this.requirePool(to);
    const sourceBefore = cloneMaterial(source);

    const effectiveAmount = cloneMaterial(amount);

    for (const key of MATERIAL_KEYS) {
      const tolerance = Math.max(1e-12, Math.abs(source[key]) * 1e-9);
      if (amount[key] > source[key]) {
        if (amount[key] - source[key] > tolerance) {
          throw new Error(
            `Insufficient ${key} in ${from}: have ${source[key]}, need ${amount[key]}`
          );
        }
        effectiveAmount[key] = source[key];
      }
    }

    for (const key of MATERIAL_KEYS) {
      source[key] -= effectiveAmount[key];
      destination[key] += effectiveAmount[key];
      if (Math.abs(source[key]) < 1e-12) source[key] = 0;
    }

    const event: TransferEvent = {
      from,
      to,
      amount: cloneMaterial(effectiveAmount),
      sourceBefore
    };
    for (const observer of this.observers) observer(event);
  }

  applyBoundaryFlux(poolName: string, delta: Material): void {
    assertFiniteMaterial(delta, "boundaryFlux");
    const pool = this.requirePool(poolName);

    for (const key of MATERIAL_KEYS) {
      const next = pool[key] + delta[key];
      if (next < -1e-12) {
        throw new Error(
          `Boundary flux would make ${poolName}.${key} negative: ${next}`
        );
      }
      pool[key] = Math.abs(next) < 1e-12 ? 0 : next;
      this.boundaryFlux[key] += delta[key];
    }
  }

  totals(): Material {
    let total = zeroMaterial();
    for (const pool of this.pools.values()) {
      total = addMaterial(total, pool);
    }
    return total;
  }

  cumulativeBoundaryFlux(): Material {
    return cloneMaterial(this.boundaryFlux);
  }

  snapshot(): LedgerSnapshot {
    const pools: Record<string, Material> = {};
    for (const [name, value] of this.pools) pools[name] = cloneMaterial(value);
    return { pools, cumulativeBoundaryFlux: cloneMaterial(this.boundaryFlux) };
  }

  assertValid(): void {
    for (const [name, value] of this.pools) {
      assertNonNegativeMaterial(value, `pool:${name}`);
    }
    assertFiniteMaterial(this.boundaryFlux, "cumulativeBoundaryFlux");
  }

  private requirePool(name: string): Material {
    const pool = this.pools.get(name);
    if (!pool) throw new Error(`Unknown material pool: ${name}`);
    return pool;
  }
}
