import {
  MATERIAL_KEYS,
  assertNonNegativeMaterial,
  cloneMaterial,
  type Material,
  zeroMaterial
} from "./material.js";
import type { MassLedger, TransferEvent } from "./ledger.js";

export class MassTracer {
  private readonly tracers = new Map<string, Map<string, Material>>();
  private detachObserver?: () => void;

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
    for (const pools of this.tracers.values()) {
      const sourceTracer = pools.get(event.from);
      if (!sourceTracer) continue;

      const moved = zeroMaterial();
      for (const key of MATERIAL_KEYS) {
        const sourceMass = event.sourceBefore[key];
        if (sourceMass <= 0 || event.amount[key] <= 0 || sourceTracer[key] <= 0) continue;
        const fraction = Math.min(1, event.amount[key] / sourceMass);
        moved[key] = sourceTracer[key] * fraction;
        sourceTracer[key] -= moved[key];
        if (Math.abs(sourceTracer[key]) < 1e-15) sourceTracer[key] = 0;
      }

      const destinationTracer = pools.get(event.to) ?? zeroMaterial();
      for (const key of MATERIAL_KEYS) destinationTracer[key] += moved[key];
      pools.set(event.to, destinationTracer);
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
