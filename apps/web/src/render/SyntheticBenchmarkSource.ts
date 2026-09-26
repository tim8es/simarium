import type {
  RenderEntity,
  RenderWorldDelta,
  RenderWorldDimensions,
  RenderWorldSnapshot
} from "@simarium/render-core";

type MutableVector3 = [number, number, number];

type MovingRecord = {
  entity: RenderEntity;
  velocity: MutableVector3;
  flying: boolean;
};

class BenchmarkRng {
  constructor(private state = 0x51a9d37b) {}

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

const PLANT_SPECIES = [
  "fittonia-albivenis",
  "peperomia-caperata",
  "pilea-depressa"
] as const;

const ANIMAL_GROUPS = [
  { speciesId: "folsomia-candida", lifeStage: "adult", count: 320, flying: false },
  { speciesId: "trichorhina-tomentosa", lifeStage: "adult", count: 240, flying: false },
  { speciesId: "bradysia-impatiens", lifeStage: "larva", count: 220, flying: false },
  { speciesId: "bradysia-impatiens", lifeStage: "adult", count: 180, flying: true },
  { speciesId: "dalotia-coriaria", lifeStage: "adult", count: 240, flying: false }
] as const;

export const BENCHMARK_DIMENSIONS: RenderWorldDimensions = {
  width: 1.2,
  depth: 0.6,
  height: 0.9
};

export class SyntheticBenchmarkSource {
  private readonly rng = new BenchmarkRng();
  private readonly plants: RenderEntity[] = [];
  private readonly animals: MovingRecord[] = [];
  private sequence = 0;
  private simulationTime = 0;

  readonly focusTargetId: string;

  constructor() {
    this.buildPlants();
    this.buildAnimals();
    this.focusTargetId = this.animals.find((record) => record.entity.speciesId === "dalotia-coriaria")?.entity.id ?? this.animals[0]!.entity.id;
  }

  createSnapshot(): RenderWorldSnapshot {
    return {
      sequence: this.sequence,
      simulationTime: this.simulationTime,
      dimensions: BENCHMARK_DIMENSIONS,
      entities: [...this.plants, ...this.animals.map((record) => record.entity)]
    };
  }

  step(dtSeconds: number): RenderWorldDelta {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
    this.simulationTime += dt;
    this.sequence++;

    const halfWidth = BENCHMARK_DIMENSIONS.width * 0.47;
    const halfDepth = BENCHMARK_DIMENSIONS.depth * 0.46;

    for (const record of this.animals) {
      const [x0, y0, z0] = record.entity.position;
      let x = x0 + record.velocity[0] * dt;
      let y = y0 + record.velocity[1] * dt;
      let z = z0 + record.velocity[2] * dt;

      if (x < -halfWidth || x > halfWidth) {
        record.velocity[0] *= -1;
        x = Math.max(-halfWidth, Math.min(halfWidth, x));
      }
      if (z < -halfDepth || z > halfDepth) {
        record.velocity[2] *= -1;
        z = Math.max(-halfDepth, Math.min(halfDepth, z));
      }

      if (record.flying) {
        if (y < 0.2 || y > 0.78) {
          record.velocity[1] *= -1;
          y = Math.max(0.2, Math.min(0.78, y));
        }
      } else {
        y = 0.145;
      }

      const yaw = Math.atan2(record.velocity[2], record.velocity[0]);
      const halfYaw = yaw * 0.5;
      record.entity = {
        ...record.entity,
        position: [x, y, z],
        orientation: [0, Math.sin(halfYaw), 0, Math.cos(halfYaw)],
        animationState: "locomotion"
      };
    }

    return {
      sequence: this.sequence,
      simulationTime: this.simulationTime,
      upserts: this.animals.map((record) => record.entity),
      removals: []
    };
  }

  private buildPlants(): void {
    let id = 0;
    for (const speciesId of PLANT_SPECIES) {
      for (let i = 0; i < 60; i++) {
        this.plants.push({
          id: `plant-${String(id++).padStart(4, "0")}`,
          speciesId,
          lifeStage: "mature",
          position: [this.rng.range(-0.52, 0.52), 0.14, this.rng.range(-0.24, 0.24)],
          orientation: [0, 0, 0, 1],
          scale: this.rng.range(0.78, 1.2),
          animationState: "idle",
          alive: true,
          visible: true
        });
      }
    }
  }

  private buildAnimals(): void {
    for (const group of ANIMAL_GROUPS) {
      for (let i = 0; i < group.count; i++) {
        const id = `${group.speciesId}-${group.lifeStage}-${String(i).padStart(4, "0")}`;
        const speed = group.flying ? this.rng.range(0.025, 0.065) : this.rng.range(0.006, 0.022);
        const angle = this.rng.range(0, Math.PI * 2);
        const velocityY = group.flying ? this.rng.range(-0.02, 0.02) : 0;
        const y = group.flying ? this.rng.range(0.2, 0.78) : 0.145;
        const yaw = angle;
        const halfYaw = yaw * 0.5;

        this.animals.push({
          flying: group.flying,
          velocity: [Math.cos(angle) * speed, velocityY, Math.sin(angle) * speed],
          entity: {
            id,
            speciesId: group.speciesId,
            lifeStage: group.lifeStage,
            position: [this.rng.range(-0.55, 0.55), y, this.rng.range(-0.26, 0.26)],
            orientation: [0, Math.sin(halfYaw), 0, Math.cos(halfYaw)],
            scale: this.rng.range(0.82, 1.18),
            animationState: "locomotion",
            alive: true,
            visible: true
          }
        });
      }
    }
  }
}
