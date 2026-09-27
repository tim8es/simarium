import {
  MATERIAL_KEYS,
  assertNonNegativeMaterial,
  cloneMaterial,
  type Material,
  type MaterialKey,
  zeroMaterial
} from "./material.js";
import type { MassLedger, TransferEvent } from "./ledger.js";

export class MassTracer {
  private readonly tracers = new Map<string, Map<string, Material>>();
  private readonly activeKeys = new Map<string, Set<MaterialKey>>();
  private detachObserver: (() => void) | undefined;

  attach(ledger: MassLedger): void {
    this.detach();
    this.detachObserver = ledger.observeTransfers((event) => this.onTransfer(event));
  }

  detach(): void {
    this.detachObserver?.();
    this.detachObserver = undefined;
  }

  seed(tracerId: string, poolName: string, amount: Material, ledger: MassLedger): void {
    assertNonNegativeMaterial(amount, `tracer:${tracerId}`);
    const source = ledger.getPool(poolName);
    for (const key of MATERIAL_KEYS) {
      if (amount[key] > source[key] + 1e-12) {
        throw new Error(
          `Tracer ${tracerId} exceeds source ${poolName}.${key}: ${amount[key]} > ${source[key]}`
        );
      }
    }
    this.getTracerPools(tracerId).set(poolName, cloneMaterial(amount));
    let keys = this.activeKeys.get(tracerId);
    if (!keys) {
      keys = new Set<MaterialKey>();
      this.activeKeys.set(tracerId, keys);
    }
    for (const key of MATERIAL_KEYS) {
      if (amount[key] > 0) keys.add(key);
    }
  }

  get(tracerId: string, poolName: string): Material {
    return cloneMaterial(this.getTracerPools(tracerId).get(poolName) ?? zeroMaterial());
  }

  totals(tracerId: string): Material {
    const total = zeroMaterial();
    for (const value of this.getTracerPools(tracerId).values()) {
      for (const key of MATERIAL_KEYS) total[key] += value[key];
    }
    return total;
  }

  private onTransfer(event: TransferEvent): void {
    for (const [tracerId, pools] of this.tracers) {
      const sourceTracer = pools.get(event.from);
      if (!sourceTracer) continue;

      const keys = this.activeKeys.get(tracerId);
      if (!keys || keys.size === 0) continue;

      let destinationTracer: Material | undefined;
      for (const key of keys) {
        const sourceMass = event.sourceBefore[key];
        const transferMass = event.amount[key];
        const tracedMass = sourceTracer[key];
        if (sourceMass <= 0 || transferMass <= 0 || tracedMass <= 0) continue;

        const moved = tracedMass * Math.min(1, transferMass / sourceMass);
        sourceTracer[key] -= moved;
        if (Math.abs(sourceTracer[key]) < 1e-15) sourceTracer[key] = 0;

        if (!destinationTracer) {
          destinationTracer = pools.get(event.to);
          if (!destinationTracer) {
            destinationTracer = zeroMaterial();
            pools.set(event.to, destinationTracer);
          }
        }
        destinationTracer[key] += moved;
      }
    }
  }

  private getTracerPools(tracerId: string): Map<string, Material> {
    let pools = this.tracers.get(tracerId);
    if (!pools) {
      pools = new Map<string, Material>();
      this.tracers.set(tracerId, pools);
    }
    return pools;
  }
}
