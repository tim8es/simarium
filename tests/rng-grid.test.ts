import { describe, expect, it } from "vitest";
import { ScalarGrid3D } from "../packages/sim-core/src/grid.ts";
import { DeterministicRng } from "../packages/sim-core/src/rng.ts";

describe("DeterministicRng", () => {
  it("replays the same sequence from the same seed", () => {
    const a = new DeterministicRng(42);
    const b = new DeterministicRng(42);

    const seqA = Array.from({ length: 100 }, () => a.nextUint32());
    const seqB = Array.from({ length: 100 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it("restores exactly from serialized state", () => {
    const a = new DeterministicRng(7);
    for (let i = 0; i < 25; i++) a.nextUint32();

    const b = new DeterministicRng(7, a.getState());
    expect(b.nextUint32()).toBe(a.nextUint32());
  });
});

describe("ScalarGrid3D", () => {
  it("diffuses conservatively and reduces a local peak", () => {
    const grid = new ScalarGrid3D(3, 3, 3, 0);
    grid.set(1, 1, 1, 27);
    const before = grid.total();

    grid.diffuse(0.1);

    expect(grid.total()).toBeCloseTo(before, 12);
    expect(grid.get(1, 1, 1)).toBeLessThan(27);
    expect(grid.min()).toBeGreaterThanOrEqual(0);
  });

  it("rejects an unstable explicit diffusion coefficient", () => {
    const grid = new ScalarGrid3D(2, 2, 2, 1);
    expect(() => grid.diffuse(0.2)).toThrow(/1\/6/);
  });
});
