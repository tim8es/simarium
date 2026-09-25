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

export class MassLedger {
  private readonly pools = new Map<string, Material>();
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

  transfer(from: string, to: string, amount: Material): void {
    if (from === to) return;
    assertNonNegativeMaterial(amount, "transfer");

    const source = this.requirePool(from);
    const destination = this.requirePool(to);

    for (const key of MATERIAL_KEYS) {
      if (source[key] + 1e-12 < amount[key]) {
        throw new Error(
          `Insufficient ${key} in ${from}: have ${source[key]}, need ${amount[key]}`
        );
      }
    }

    for (const key of MATERIAL_KEYS) {
      source[key] -= amount[key];
      destination[key] += amount[key];
      if (Math.abs(source[key]) < 1e-12) source[key] = 0;
    }
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
