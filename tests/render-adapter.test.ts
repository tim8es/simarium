import { describe, expect, it } from "vitest";
import { RenderAdapter, type RenderEntity } from "../packages/render-core/src/index.ts";

const entity = (overrides: Partial<RenderEntity> = {}): RenderEntity => ({
  id: "animal-1",
  speciesId: "folsomia-candida",
  lifeStage: "adult",
  position: [0.1, 0.12, 0.2],
  orientation: [0, 0, 0, 1],
  scale: 1,
  animationState: "locomotion",
  alive: true,
  visible: true,
  ...overrides
});

describe("RenderAdapter", () => {
  it("projects snapshots without retaining caller-owned transform arrays", () => {
    const adapter = new RenderAdapter();
    const source = entity();
    adapter.applySnapshot({
      sequence: 1,
      simulationTime: 10,
      dimensions: { width: 1.2, depth: 0.6, height: 0.9 },
      entities: [source]
    });

    const projected = adapter.getEntity(source.id);
    expect(projected).toEqual(source);
    expect(projected).not.toBe(source);
    expect(projected?.position).not.toBe(source.position);
  });

  it("applies monotonic deltas and removals", () => {
    const adapter = new RenderAdapter();
    adapter.applySnapshot({
      sequence: 3,
      simulationTime: 20,
      dimensions: { width: 1.2, depth: 0.6, height: 0.9 },
      entities: [entity(), entity({ id: "animal-2" })]
    });

    adapter.applyDelta({
      sequence: 4,
      simulationTime: 21,
      upserts: [entity({ position: [0.2, 0.12, 0.25], animationState: "feeding" })],
      removals: ["animal-2"]
    });

    expect(adapter.getMetrics()).toMatchObject({ totalEntities: 1, aliveEntities: 1, visibleEntities: 1 });
    expect(adapter.getEntity("animal-1")?.position).toEqual([0.2, 0.12, 0.25]);
    expect(adapter.getEntity("animal-1")?.animationState).toBe("feeding");
  });

  it("filters dead or explicitly hidden entities from the renderable view", () => {
    const adapter = new RenderAdapter();
    adapter.applySnapshot({
      sequence: 0,
      simulationTime: 0,
      dimensions: { width: 1.2, depth: 0.6, height: 0.9 },
      entities: [
        entity({ id: "visible" }),
        entity({ id: "dead", alive: false }),
        entity({ id: "hidden", visible: false })
      ]
    });

    expect(adapter.getRenderableEntities().map((item) => item.id)).toEqual(["visible"]);
  });

  it("rejects stale deltas and invalid transforms", () => {
    const adapter = new RenderAdapter();
    adapter.applySnapshot({
      sequence: 2,
      simulationTime: 1,
      dimensions: { width: 1.2, depth: 0.6, height: 0.9 },
      entities: []
    });

    expect(() => adapter.applyDelta({ sequence: 2, simulationTime: 2, upserts: [], removals: [] })).toThrow(/newer/);
    expect(() => adapter.applyDelta({
      sequence: 3,
      simulationTime: 2,
      upserts: [entity({ position: [Number.NaN, 0, 0] })],
      removals: []
    })).toThrow(/non-finite/);
  });
});
