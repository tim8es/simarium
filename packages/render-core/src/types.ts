export type RenderVector3 = readonly [x: number, y: number, z: number];
export type RenderQuaternion = readonly [x: number, y: number, z: number, w: number];

export interface RenderWorldDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface RenderEntity {
  id: string;
  speciesId: string;
  lifeStage: string;
  position: RenderVector3;
  orientation: RenderQuaternion;
  scale: number;
  animationState: string;
  alive: boolean;
  visible: boolean;
}

export interface RenderWorldSnapshot {
  sequence: number;
  simulationTime: number;
  dimensions: RenderWorldDimensions;
  entities: readonly RenderEntity[];
}

export interface RenderWorldDelta {
  sequence: number;
  simulationTime: number;
  upserts: readonly RenderEntity[];
  removals: readonly string[];
}

export interface RenderAdapterMetrics {
  sequence: number;
  simulationTime: number;
  totalEntities: number;
  aliveEntities: number;
  visibleEntities: number;
}
