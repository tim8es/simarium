import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DodecahedronGeometry,
  DynamicDrawUsage,
  EdgesGeometry,
  Frustum,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3
} from "three";
import { RenderAdapter, type RenderEntity } from "@simarium/render-core";

const PLANT_SPECIES = new Set(["fittonia-albivenis", "peperomia-caperata", "pilea-depressa"]);
const LEAVES_PER_PLANT = 24;
const MAX_NEAR_ANIMALS = 260;
const MAX_ANIMALS = 1200;

const ANIMAL_VISUAL_KEYS = [
  "folsomia-candida:egg",
  "folsomia-candida:juvenile",
  "folsomia-candida:adult",
  "trichorhina-tomentosa:manca",
  "trichorhina-tomentosa:juvenile",
  "trichorhina-tomentosa:adult",
  "bradysia-impatiens:egg",
  "bradysia-impatiens:larva",
  "bradysia-impatiens:pupa",
  "bradysia-impatiens:adult",
  "dalotia-coriaria:egg",
  "dalotia-coriaria:larva",
  "dalotia-coriaria:pupa",
  "dalotia-coriaria:adult"
] as const;

type AnimalVisualKey = typeof ANIMAL_VISUAL_KEYS[number];

export interface TemperatureGridProjection {
  width: number;
  height: number;
  depth: number;
  values: readonly number[];
}

export interface DynamicHardscapeEntry {
  id: string;
  kind: string;
  position: { x: number; y: number; z: number };
}

export interface BenchmarkSceneMetrics {
  visibleEntityCount: number;
  visibleAnimalMeshCount: number;
  farAnimalProxyCount: number;
  plantLeafInstanceCount: number;
  dynamicHardscapeCount: number;
}

type VisibleAnimal = {
  entity: Readonly<RenderEntity>;
  distanceSq: number;
  position: Vector3;
};

const plantStyle = {
  "fittonia-albivenis": { color: 0x3f7b4f, length: 0.055, width: 0.03, height: 0.17 },
  "peperomia-caperata": { color: 0x315b3e, length: 0.05, width: 0.038, height: 0.15 },
  "pilea-depressa": { color: 0x5d9b57, length: 0.03, width: 0.021, height: 0.11 }
} as const;

const animalStyle: Record<AnimalVisualKey, { color: number; length: number; height: number; width: number }> = {
  "folsomia-candida:egg": { color: 0xf4f6f4, length: 0.00045, height: 0.00032, width: 0.0004 },
  "folsomia-candida:juvenile": { color: 0xeaf0f3, length: 0.00115, height: 0.00038, width: 0.00048 },
  "folsomia-candida:adult": { color: 0xe7edf1, length: 0.0018, height: 0.00045, width: 0.00055 },
  "trichorhina-tomentosa:manca": { color: 0xe4e9e5, length: 0.0016, height: 0.00055, width: 0.0009 },
  "trichorhina-tomentosa:juvenile": { color: 0xdde4df, length: 0.0028, height: 0.0008, width: 0.00155 },
  "trichorhina-tomentosa:adult": { color: 0xd6ddd8, length: 0.0042, height: 0.0011, width: 0.0022 },
  "bradysia-impatiens:egg": { color: 0xf1e9d0, length: 0.00055, height: 0.00032, width: 0.0004 },
  "bradysia-impatiens:larva": { color: 0xe7dfbe, length: 0.006, height: 0.00075, width: 0.0009 },
  "bradysia-impatiens:pupa": { color: 0x8e735a, length: 0.0033, height: 0.00085, width: 0.0011 },
  "bradysia-impatiens:adult": { color: 0x263036, length: 0.003, height: 0.0008, width: 0.001 },
  "dalotia-coriaria:egg": { color: 0xe9dcc8, length: 0.00065, height: 0.00042, width: 0.00048 },
  "dalotia-coriaria:larva": { color: 0x6d4937, length: 0.0032, height: 0.00072, width: 0.0009 },
  "dalotia-coriaria:pupa": { color: 0x755843, length: 0.0036, height: 0.0009, width: 0.00115 },
  "dalotia-coriaria:adult": { color: 0x492f24, length: 0.0045, height: 0.001, width: 0.00135 }
};

function animalKey(entity: Readonly<RenderEntity>): AnimalVisualKey | null {
  const key = `${entity.speciesId}:${entity.lifeStage}` as AnimalVisualKey;
  return ANIMAL_VISUAL_KEYS.includes(key) ? key : null;
}

function animalGeometry(key: AnimalVisualKey): BufferGeometry {
  if (key.startsWith("folsomia-candida:")) {
    const geometry = new CapsuleGeometry(0.22, 0.56, 3, 6);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  if (key.startsWith("trichorhina-tomentosa:")) {
    return new SphereGeometry(0.5, 8, 5);
  }
  if (key === "bradysia-impatiens:adult") {
    const geometry = new ConeGeometry(0.34, 1, 6);
    geometry.rotateZ(-Math.PI / 2);
    return geometry;
  }
  if (key.startsWith("bradysia-impatiens:")) {
    const geometry = new CapsuleGeometry(0.18, 0.64, 3, 6);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  if (key.startsWith("dalotia-coriaria:")) {
    const geometry = new CapsuleGeometry(0.28, 0.5, 3, 6);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }
  return new DodecahedronGeometry(0.5, 0);
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export class BenchmarkScene {
  readonly scene = new Scene();

  private readonly adapter: RenderAdapter;
  private readonly leafMeshes = new Map<string, InstancedMesh>();
  private readonly leafEntityIds = new Map<string, string[]>();
  private readonly animalMeshes = new Map<AnimalVisualKey, InstancedMesh>();
  private readonly animalInstanceIds = new Map<AnimalVisualKey, string[]>();
  private readonly stemMesh: InstancedMesh;
  private readonly stemEntityIds: string[] = [];
  private readonly dynamicHardscapeMeshes = new Map<string, Mesh>();
  private readonly temperatureOverlay: InstancedMesh;
  private readonly hemisphereLight: HemisphereLight;
  private readonly keyLight: DirectionalLight;
  private readonly farPoints: Points;
  private readonly farPositions = new Float32Array(MAX_ANIMALS * 3);
  private readonly farColors = new Float32Array(MAX_ANIMALS * 3);
  private readonly dummy = new Object3D();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly frustum = new Frustum();
  private readonly projectionView = new Matrix4();
  private readonly visibleAnimals: VisibleAnimal[] = [];
  private readonly smoothedAnimalPositions = new Map<string, Vector3>();
  private readonly seenAnimalIds = new Set<string>();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private plantSignature = "";
  private metrics: BenchmarkSceneMetrics = {
    visibleEntityCount: 0,
    visibleAnimalMeshCount: 0,
    farAnimalProxyCount: 0,
    plantLeafInstanceCount: 0,
    dynamicHardscapeCount: 0
  };

  constructor(adapter: RenderAdapter) {
    this.adapter = adapter;
    this.scene.background = new Color(0x0f1716);
    const lighting = this.addLighting();
    this.hemisphereLight = lighting.hemisphere;
    this.keyLight = lighting.key;
    this.addTerrarium();
    this.addHardscape();
    this.temperatureOverlay = this.createTemperatureOverlay();
    this.stemMesh = this.createStemMesh();
    this.farPoints = this.createFarPoints();
    this.createAnimalMeshes();
  }

  initializeFromSnapshot(): void {
    this.refreshPlantInstances(true);
  }

  update(camera: PerspectiveCamera, dtSeconds: number): BenchmarkSceneMetrics {
    this.refreshPlantInstances(false);
    camera.updateMatrixWorld();
    this.projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projectionView);

    const animals = this.visibleAnimals;
    let animalCount = 0;
    let visiblePlants = 0;
    this.seenAnimalIds.clear();
    const blend = 1 - Math.exp(-8 * Math.max(0, dtSeconds));

    this.adapter.forEachRenderableEntity((entity) => {
      this.position.set(...entity.position);
      if (PLANT_SPECIES.has(entity.speciesId)) {
        if (this.frustum.containsPoint(this.position)) visiblePlants++;
        return;
      }

      this.seenAnimalIds.add(entity.id);
      let visualPosition = this.smoothedAnimalPositions.get(entity.id);
      if (!visualPosition) {
        visualPosition = new Vector3(...entity.position);
        this.smoothedAnimalPositions.set(entity.id, visualPosition);
      } else {
        visualPosition.lerp(this.position, blend);
      }
      if (!this.frustum.containsPoint(visualPosition)) return;

      const distanceSq = camera.position.distanceToSquared(visualPosition);
      const record = animals[animalCount];
      if (record) {
        record.entity = entity;
        record.distanceSq = distanceSq;
        record.position.copy(visualPosition);
      } else {
        animals.push({
          entity,
          distanceSq,
          position: visualPosition.clone()
        });
      }
      animalCount++;
    });

    for (const id of this.smoothedAnimalPositions.keys()) {
      if (!this.seenAnimalIds.has(id)) this.smoothedAnimalPositions.delete(id);
    }

    animals.length = animalCount;
    animals.sort((a, b) => a.distanceSq - b.distanceSq);
    const nearCount = Math.min(MAX_NEAR_ANIMALS, animals.length);
    this.updateNearAnimals(animals, nearCount);
    this.updateFarAnimals(animals, nearCount);

    this.metrics = {
      visibleEntityCount: visiblePlants + animals.length,
      visibleAnimalMeshCount: nearCount,
      farAnimalProxyCount: Math.max(0, animals.length - nearCount),
      plantLeafInstanceCount: this.metrics.plantLeafInstanceCount,
      dynamicHardscapeCount: this.dynamicHardscapeMeshes.size
    };
    return this.metrics;
  }

  getMetrics(): BenchmarkSceneMetrics {
    return { ...this.metrics };
  }

  getDynamicHardscapeCount(): number {
    return this.dynamicHardscapeMeshes.size;
  }

  setTemperatureGridOverlay(
    grid: TemperatureGridProjection | null,
    visible: boolean
  ): void {
    if (
      !visible ||
      !grid ||
      grid.width <= 0 ||
      grid.height <= 0 ||
      grid.depth <= 0 ||
      grid.values.length !== grid.width * grid.height * grid.depth
    ) {
      this.temperatureOverlay.visible = false;
      this.temperatureOverlay.count = 0;
      return;
    }

    const cellValues: number[] = [];
    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        let sum = 0;
        for (let y = 0; y < grid.height; y++) {
          const index = x + grid.width * (y + grid.height * z);
          sum += grid.values[index] ?? 0;
        }
        cellValues.push(sum / grid.height);
      }
    }

    const min = Math.min(...cellValues);
    const max = Math.max(...cellValues);
    const span = Math.max(1e-9, max - min);
    const color = new Color();
    let instance = 0;
    const maxInstances = Math.min(256, grid.width * grid.depth);

    for (let z = 0; z < grid.depth && instance < maxInstances; z++) {
      for (let x = 0; x < grid.width && instance < maxInstances; x++) {
        const value = cellValues[x + grid.width * z] ?? min;
        const normalized = (value - min) / span;
        color.setHSL((1 - normalized) * 0.64, 0.72, 0.52);

        this.dummy.position.set(
          -0.58 + ((x + 0.5) / grid.width) * 1.16,
          0.137,
          -0.28 + ((z + 0.5) / grid.depth) * 0.56
        );
        this.dummy.rotation.set(-Math.PI / 2, 0, 0);
        this.dummy.scale.set(
          (1.16 / grid.width) * 0.96,
          (0.56 / grid.depth) * 0.96,
          1
        );
        this.dummy.updateMatrix();
        this.temperatureOverlay.setMatrixAt(instance, this.dummy.matrix);
        this.temperatureOverlay.setColorAt(instance, color);
        instance++;
      }
    }

    this.temperatureOverlay.count = instance;
    this.temperatureOverlay.visible = true;
    this.temperatureOverlay.instanceMatrix.needsUpdate = true;
    if (this.temperatureOverlay.instanceColor) {
      this.temperatureOverlay.instanceColor.needsUpdate = true;
    }
  }

  setDynamicHardscape(entries: readonly DynamicHardscapeEntry[]): void {
    const desired = new Set(entries.map((entry) => entry.id));
    for (const [id, mesh] of this.dynamicHardscapeMeshes) {
      if (desired.has(id)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.dispose();
      } else {
        mesh.material.dispose();
      }
      this.dynamicHardscapeMeshes.delete(id);
    }

    for (const entry of entries) {
      let mesh = this.dynamicHardscapeMeshes.get(entry.id);
      if (!mesh) {
        const wood = entry.kind.toLowerCase().includes("wood");
        mesh = new Mesh(
          wood
            ? new CylinderGeometry(0.025, 0.035, 0.28, 7)
            : new DodecahedronGeometry(0.045, 0),
          new MeshStandardMaterial({
            color: wood ? 0x65412a : 0x62635e,
            roughness: 0.95
          })
        );
        if (wood) mesh.rotation.z = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.dynamicHardscapeMeshes.set(entry.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
    }
  }

  pick(
    clientX: number,
    clientY: number,
    camera: PerspectiveCamera,
    domElement: HTMLElement
  ): string | null {
    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, camera);

    const objects = [
      ...this.animalMeshes.values(),
      ...this.leafMeshes.values(),
      this.stemMesh
    ];
    for (const hit of this.raycaster.intersectObjects(objects, false)) {
      if (hit.instanceId === undefined) continue;
      if (hit.object === this.stemMesh) {
        return this.stemEntityIds[hit.instanceId] ?? null;
      }
      for (const [key, mesh] of this.animalMeshes) {
        if (hit.object === mesh) {
          return this.animalInstanceIds.get(key)?.[hit.instanceId] ?? null;
        }
      }
      for (const [speciesId, mesh] of this.leafMeshes) {
        if (hit.object === mesh) {
          return this.leafEntityIds.get(speciesId)?.[hit.instanceId] ?? null;
        }
      }
    }
    return null;
  }

  setBiologicalLight(lightPar: number, nightObservationAid: boolean): void {
    const normalized = Math.max(0, lightPar / 186);
    const dayScale = Math.min(2.5, normalized);
    const visualAid = nightObservationAid ? 0.16 : 0;
    this.keyLight.intensity = 3.2 * dayScale;
    this.hemisphereLight.intensity =
      Math.max(visualAid, 1.9 * Math.min(1.5, Math.sqrt(dayScale)));
    this.scene.background = new Color(
      dayScale > 0.05 ? 0x0f1716 : nightObservationAid ? 0x07100f : 0x020303
    );
  }

  private addLighting(): {
    hemisphere: HemisphereLight;
    key: DirectionalLight;
  } {
    const hemisphere = new HemisphereLight(0xbad8cf, 0x2c2119, 1.9);
    this.scene.add(hemisphere);

    const key = new DirectionalLight(0xfff1cf, 3.2);
    key.position.set(0.55, 1.2, 0.35);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -0.8;
    key.shadow.camera.right = 0.8;
    key.shadow.camera.top = 0.9;
    key.shadow.camera.bottom = -0.25;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 2.2;
    key.shadow.bias = -0.0003;
    this.scene.add(key);
    return { hemisphere, key };
  }

  private addTerrarium(): void {
    const glass = new Mesh(
      new BoxGeometry(1.2, 0.9, 0.6),
      new MeshPhysicalMaterial({
        color: 0xbad7d3,
        transparent: true,
        opacity: 0.09,
        roughness: 0.08,
        metalness: 0,
        depthWrite: false,
        side: DoubleSide
      })
    );
    glass.position.y = 0.45;
    glass.renderOrder = 20;
    this.scene.add(glass);

    const edges = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1.2, 0.9, 0.6)),
      new LineBasicMaterial({ color: 0x66807b, transparent: true, opacity: 0.42 })
    );
    edges.position.y = 0.45;
    this.scene.add(edges);

    const substrate = new Mesh(
      new BoxGeometry(1.16, 0.13, 0.56),
      new MeshStandardMaterial({ color: 0x33251d, roughness: 1, metalness: 0 })
    );
    substrate.position.y = 0.065;
    substrate.receiveShadow = true;
    this.scene.add(substrate);
  }

  private addHardscape(): void {
    const litterMaterial = new MeshStandardMaterial({ color: 0x70513a, roughness: 1 });
    const litter = new InstancedMesh(new PlaneGeometry(0.035, 0.018), litterMaterial, 220);
    const litterDummy = new Object3D();
    for (let i = 0; i < 220; i++) {
      const a = hash01(`litter-a-${i}`);
      const b = hash01(`litter-b-${i}`);
      litterDummy.position.set((a - 0.5) * 1.08, 0.132 + (i % 3) * 0.0004, (b - 0.5) * 0.5);
      litterDummy.rotation.set(-Math.PI / 2 + (a - 0.5) * 0.2, b * Math.PI * 2, 0);
      litterDummy.scale.setScalar(0.7 + hash01(`litter-s-${i}`) * 0.7);
      litterDummy.updateMatrix();
      litter.setMatrixAt(i, litterDummy.matrix);
    }
    litter.instanceMatrix.needsUpdate = true;
    litter.receiveShadow = true;
    this.scene.add(litter);

    const rockMaterial = new MeshStandardMaterial({ color: 0x5b5a55, roughness: 0.92 });
    const rocks = new InstancedMesh(new DodecahedronGeometry(0.035, 0), rockMaterial, 14);
    for (let i = 0; i < 14; i++) {
      const a = hash01(`rock-a-${i}`);
      const b = hash01(`rock-b-${i}`);
      litterDummy.position.set((a - 0.5) * 0.98, 0.155, (b - 0.5) * 0.45);
      litterDummy.rotation.set(a * 2, b * 2, (a + b) * 2);
      litterDummy.scale.set(0.7 + a, 0.5 + b * 0.8, 0.7 + b);
      litterDummy.updateMatrix();
      rocks.setMatrixAt(i, litterDummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.scene.add(rocks);

    const woodMaterial = new MeshStandardMaterial({ color: 0x5a3420, roughness: 1 });
    const wood = new InstancedMesh(new CylinderGeometry(0.025, 0.035, 0.34, 7), woodMaterial, 6);
    for (let i = 0; i < 6; i++) {
      litterDummy.position.set(-0.38 + i * 0.15, 0.19, -0.1 + (i % 2) * 0.2);
      litterDummy.rotation.set(Math.PI / 2, 0, -0.25 + i * 0.1);
      litterDummy.scale.setScalar(0.75 + (i % 3) * 0.12);
      litterDummy.updateMatrix();
      wood.setMatrixAt(i, litterDummy.matrix);
    }
    wood.instanceMatrix.needsUpdate = true;
    wood.castShadow = true;
    wood.receiveShadow = true;
    this.scene.add(wood);
  }

  private createTemperatureOverlay(): InstancedMesh {
    const mesh = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        vertexColors: true,
        side: DoubleSide,
        depthWrite: false
      }),
      256
    );
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 12;
    this.scene.add(mesh);
    return mesh;
  }

  private createStemMesh(): InstancedMesh {
    const mesh = new InstancedMesh(
      new CylinderGeometry(0.003, 0.004, 1, 6),
      new MeshStandardMaterial({ color: 0x38593b, roughness: 0.92 }),
      512
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  private createFarPoints(): Points {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(this.farPositions, 3).setUsage(DynamicDrawUsage);
    const color = new BufferAttribute(this.farColors, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("color", color);
    geometry.setDrawRange(0, 0);

    const points = new Points(
      geometry,
      new PointsMaterial({
        size: 0.0045,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9
      })
    );
    points.frustumCulled = false;
    this.scene.add(points);
    return points;
  }

  private createAnimalMeshes(): void {
    for (const key of ANIMAL_VISUAL_KEYS) {
      const style = animalStyle[key];
      const mesh = new InstancedMesh(
        animalGeometry(key),
        new MeshStandardMaterial({ color: style.color, roughness: 0.72, metalness: 0 }),
        MAX_NEAR_ANIMALS
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.animalMeshes.set(key, mesh);
    }
  }

  private refreshPlantInstances(force: boolean): void {
    const plants = this.adapter
      .getRenderableEntities()
      .filter((entity) => PLANT_SPECIES.has(entity.speciesId));
    const signature = plants
      .map((plant) => `${plant.id}:${plant.scale.toFixed(4)}`)
      .sort()
      .join("|");
    if (!force && signature === this.plantSignature) return;
    this.plantSignature = signature;
    this.buildPlantInstances(plants);
  }

  private buildPlantInstances(plants: readonly RenderEntity[]): void {
    for (const mesh of this.leafMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.dispose();
      } else {
        mesh.material.dispose();
      }
    }
    this.leafMeshes.clear();
    this.leafEntityIds.clear();
    this.stemEntityIds.splice(0, this.stemEntityIds.length);

    const speciesPlants = new Map<string, RenderEntity[]>();
    for (const plant of plants) {
      const bucket = speciesPlants.get(plant.speciesId) ?? [];
      bucket.push(plant);
      speciesPlants.set(plant.speciesId, bucket);
    }

    let stemIndex = 0;
    let totalLeaves = 0;

    for (const [speciesId, style] of Object.entries(plantStyle)) {
      const members = speciesPlants.get(speciesId) ?? [];
      const capacity = Math.max(1, members.length * LEAVES_PER_PLANT);
      const mesh = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshStandardMaterial({
          color: style.color,
          roughness: 0.86,
          side: DoubleSide
        }),
        capacity
      );
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      let leafIndex = 0;
      const leafIds: string[] = [];
      for (const plant of members) {
        const baseAngle = hash01(plant.id) * Math.PI * 2;
        for (let leaf = 0; leaf < LEAVES_PER_PLANT; leaf++) {
          const t = leaf / LEAVES_PER_PLANT;
          const angle = baseAngle + leaf * 2.399963229728653;
          const radius = (0.018 + 0.07 * Math.sqrt(t)) * plant.scale;
          const height =
            (0.035 + style.height * (0.25 + t * 0.75)) * plant.scale;
          this.dummy.position.set(
            plant.position[0] + Math.cos(angle) * radius,
            plant.position[1] + height,
            plant.position[2] + Math.sin(angle) * radius
          );
          this.dummy.rotation.set(
            -Math.PI / 2 + 0.28 * Math.sin(angle),
            angle,
            0.18 * Math.cos(angle)
          );
          const leafScale = (0.7 + 0.5 * t) * plant.scale;
          this.dummy.scale.set(
            style.length * leafScale,
            style.width * leafScale,
            1
          );
          this.dummy.updateMatrix();
          mesh.setMatrixAt(leafIndex, this.dummy.matrix);
          leafIds[leafIndex] = plant.id;
          leafIndex++;
        }

        if (stemIndex >= 512) continue;
        const stemHeight = style.height * plant.scale;
        this.dummy.position.set(
          plant.position[0],
          plant.position[1] + stemHeight * 0.5,
          plant.position[2]
        );
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(plant.scale, stemHeight, plant.scale);
        this.dummy.updateMatrix();
        this.stemMesh.setMatrixAt(stemIndex, this.dummy.matrix);
        this.stemEntityIds[stemIndex] = plant.id;
        stemIndex++;
      }

      mesh.count = leafIndex;
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      this.leafMeshes.set(speciesId, mesh);
      this.leafEntityIds.set(speciesId, leafIds);
      totalLeaves += leafIndex;
    }

    this.stemMesh.count = stemIndex;
    this.stemMesh.instanceMatrix.needsUpdate = true;
    this.metrics.plantLeafInstanceCount = totalLeaves;
  }

  private updateNearAnimals(
    animals: VisibleAnimal[],
    nearCount: number
  ): void {
    const counts = new Map<AnimalVisualKey, number>(
      ANIMAL_VISUAL_KEYS.map((key): [AnimalVisualKey, number] => [key, 0])
    );
    for (const key of ANIMAL_VISUAL_KEYS) {
      this.animalInstanceIds.set(key, []);
    }

    for (let i = 0; i < nearCount; i++) {
      const entity = animals[i]!.entity;
      const key = animalKey(entity);
      if (key === null) continue;
      const mesh = this.animalMeshes.get(key)!;
      const index = counts.get(key)!;
      const style = animalStyle[key];

      this.position.copy(animals[i]!.position);
      this.quaternion.set(...entity.orientation);
      this.scale.set(style.length * entity.scale, style.height * entity.scale, style.width * entity.scale);
      this.dummy.position.copy(this.position);
      this.dummy.quaternion.copy(this.quaternion);
      this.dummy.scale.copy(this.scale);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      this.animalInstanceIds.get(key)![index] = entity.id;
      counts.set(key, index + 1);
    }

    for (const key of ANIMAL_VISUAL_KEYS) {
      const mesh = this.animalMeshes.get(key)!;
      mesh.count = counts.get(key)!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateFarAnimals(
    animals: VisibleAnimal[],
    nearCount: number
  ): void {
    const farCount = Math.min(MAX_ANIMALS, Math.max(0, animals.length - nearCount));
    const color = new Color();

    for (let i = 0; i < farCount; i++) {
      const entity = animals[nearCount + i]!.entity;
      const key = animalKey(entity);
      const style = key ? animalStyle[key] : animalStyle["folsomia-candida:adult"];
      const offset = i * 3;
      const visualPosition = animals[nearCount + i]!.position;
      this.farPositions[offset] = visualPosition.x;
      this.farPositions[offset + 1] = visualPosition.y;
      this.farPositions[offset + 2] = visualPosition.z;
      color.setHex(style.color);
      this.farColors[offset] = color.r;
      this.farColors[offset + 1] = color.g;
      this.farColors[offset + 2] = color.b;
    }

    const geometry = this.farPoints.geometry;
    geometry.setDrawRange(0, farCount);
    const position = geometry.getAttribute("position") as BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as BufferAttribute;
    position.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }
}
