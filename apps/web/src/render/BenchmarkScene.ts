import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
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
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Vector3
} from "three";
import { RenderAdapter, type RenderEntity } from "@simarium/render-core";

const PLANT_SPECIES = new Set(["fittonia-albivenis", "peperomia-caperata", "pilea-depressa"]);
const LEAVES_PER_PLANT = 24;
const MAX_NEAR_ANIMALS = 260;
const MAX_ANIMALS = 1200;

const ANIMAL_VISUAL_KEYS = [
  "folsomia-candida:adult",
  "trichorhina-tomentosa:adult",
  "bradysia-impatiens:larva",
  "bradysia-impatiens:adult",
  "dalotia-coriaria:adult"
] as const;

type AnimalVisualKey = typeof ANIMAL_VISUAL_KEYS[number];

export interface BenchmarkSceneMetrics {
  visibleEntityCount: number;
  visibleAnimalMeshCount: number;
  farAnimalProxyCount: number;
  plantLeafInstanceCount: number;
}

const plantStyle = {
  "fittonia-albivenis": { color: 0x3f7b4f, length: 0.055, width: 0.03, height: 0.17 },
  "peperomia-caperata": { color: 0x315b3e, length: 0.05, width: 0.038, height: 0.15 },
  "pilea-depressa": { color: 0x5d9b57, length: 0.03, width: 0.021, height: 0.11 }
} as const;

const animalStyle: Record<AnimalVisualKey, { color: number; length: number; height: number; width: number }> = {
  "folsomia-candida:adult": { color: 0xe7edf1, length: 0.0018, height: 0.00045, width: 0.00055 },
  "trichorhina-tomentosa:adult": { color: 0xd6ddd8, length: 0.0042, height: 0.0011, width: 0.0022 },
  "bradysia-impatiens:larva": { color: 0xe7dfbe, length: 0.006, height: 0.00075, width: 0.0009 },
  "bradysia-impatiens:adult": { color: 0x263036, length: 0.003, height: 0.0008, width: 0.001 },
  "dalotia-coriaria:adult": { color: 0x492f24, length: 0.0045, height: 0.001, width: 0.00135 }
};

function animalKey(entity: RenderEntity): AnimalVisualKey | null {
  const key = `${entity.speciesId}:${entity.lifeStage}` as AnimalVisualKey;
  return ANIMAL_VISUAL_KEYS.includes(key) ? key : null;
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
  private readonly animalMeshes = new Map<AnimalVisualKey, InstancedMesh>();
  private readonly stemMesh: InstancedMesh;
  private readonly farPoints: Points;
  private readonly farPositions = new Float32Array(MAX_ANIMALS * 3);
  private readonly farColors = new Float32Array(MAX_ANIMALS * 3);
  private readonly dummy = new Object3D();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly frustum = new Frustum();
  private readonly projectionView = new Matrix4();
  private plantsBuilt = false;
  private metrics: BenchmarkSceneMetrics = {
    visibleEntityCount: 0,
    visibleAnimalMeshCount: 0,
    farAnimalProxyCount: 0,
    plantLeafInstanceCount: 0
  };

  constructor(adapter: RenderAdapter) {
    this.adapter = adapter;
    this.scene.background = new Color(0x0f1716);
    this.addLighting();
    this.addTerrarium();
    this.addHardscape();
    this.stemMesh = this.createStemMesh();
    this.farPoints = this.createFarPoints();
    this.createAnimalMeshes();
  }

  initializeFromSnapshot(): void {
    if (!this.plantsBuilt) {
      this.buildPlantInstances();
      this.plantsBuilt = true;
    }
  }

  update(camera: PerspectiveCamera): BenchmarkSceneMetrics {
    camera.updateMatrixWorld();
    this.projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projectionView);

    const renderable = this.adapter.getRenderableEntities();
    const animals: Array<{ entity: RenderEntity; distanceSq: number }> = [];
    let visiblePlants = 0;

    for (const entity of renderable) {
      this.position.set(...entity.position);
      if (PLANT_SPECIES.has(entity.speciesId)) {
        if (this.frustum.containsPoint(this.position)) visiblePlants++;
        continue;
      }
      if (!this.frustum.containsPoint(this.position)) continue;
      animals.push({ entity, distanceSq: camera.position.distanceToSquared(this.position) });
    }

    animals.sort((a, b) => a.distanceSq - b.distanceSq);
    const nearCount = Math.min(MAX_NEAR_ANIMALS, animals.length);
    this.updateNearAnimals(animals, nearCount);
    this.updateFarAnimals(animals, nearCount);

    this.metrics = {
      visibleEntityCount: visiblePlants + animals.length,
      visibleAnimalMeshCount: nearCount,
      farAnimalProxyCount: Math.max(0, animals.length - nearCount),
      plantLeafInstanceCount: this.metrics.plantLeafInstanceCount
    };
    return this.metrics;
  }

  getMetrics(): BenchmarkSceneMetrics {
    return { ...this.metrics };
  }

  private addLighting(): void {
    this.scene.add(new HemisphereLight(0xbad8cf, 0x2c2119, 1.9));

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

  private createStemMesh(): InstancedMesh {
    const mesh = new InstancedMesh(
      new CylinderGeometry(0.003, 0.004, 1, 6),
      new MeshStandardMaterial({ color: 0x38593b, roughness: 0.92 }),
      180
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
        new DodecahedronGeometry(0.5, 0),
        new MeshStandardMaterial({ color: style.color, roughness: 0.72, metalness: 0 }),
        MAX_NEAR_ANIMALS
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.animalMeshes.set(key, mesh);
    }
  }

  private buildPlantInstances(): void {
    const plants = this.adapter.getRenderableEntities().filter((entity) => PLANT_SPECIES.has(entity.speciesId));
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
      const mesh = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshStandardMaterial({ color: style.color, roughness: 0.86, side: DoubleSide }),
        members.length * LEAVES_PER_PLANT
      );
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      let leafIndex = 0;
      for (const plant of members) {
        const baseAngle = hash01(plant.id) * Math.PI * 2;
        for (let leaf = 0; leaf < LEAVES_PER_PLANT; leaf++) {
          const t = leaf / LEAVES_PER_PLANT;
          const angle = baseAngle + leaf * 2.399963229728653;
          const radius = (0.018 + 0.07 * Math.sqrt(t)) * plant.scale;
          const height = (0.035 + style.height * (0.25 + t * 0.75)) * plant.scale;
          this.dummy.position.set(
            plant.position[0] + Math.cos(angle) * radius,
            plant.position[1] + height,
            plant.position[2] + Math.sin(angle) * radius
          );
          this.dummy.rotation.set(-Math.PI / 2 + 0.28 * Math.sin(angle), angle, 0.18 * Math.cos(angle));
          const leafScale = (0.7 + 0.5 * t) * plant.scale;
          this.dummy.scale.set(style.length * leafScale, style.width * leafScale, 1);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(leafIndex++, this.dummy.matrix);
        }

        const stemHeight = style.height * plant.scale;
        this.dummy.position.set(plant.position[0], plant.position[1] + stemHeight * 0.5, plant.position[2]);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(plant.scale, stemHeight, plant.scale);
        this.dummy.updateMatrix();
        this.stemMesh.setMatrixAt(stemIndex++, this.dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
      this.leafMeshes.set(speciesId, mesh);
      totalLeaves += leafIndex;
    }

    this.stemMesh.count = stemIndex;
    this.stemMesh.instanceMatrix.needsUpdate = true;
    this.metrics.plantLeafInstanceCount = totalLeaves;
  }

  private updateNearAnimals(
    animals: Array<{ entity: RenderEntity; distanceSq: number }>,
    nearCount: number
  ): void {
    const counts = new Map<AnimalVisualKey, number>(
      ANIMAL_VISUAL_KEYS.map((key): [AnimalVisualKey, number] => [key, 0])
    );

    for (let i = 0; i < nearCount; i++) {
      const entity = animals[i]!.entity;
      const key = animalKey(entity);
      if (key === null) continue;
      const mesh = this.animalMeshes.get(key)!;
      const index = counts.get(key)!;
      const style = animalStyle[key];

      this.position.set(...entity.position);
      this.quaternion.set(...entity.orientation);
      this.scale.set(style.length * entity.scale, style.height * entity.scale, style.width * entity.scale);
      this.dummy.position.copy(this.position);
      this.dummy.quaternion.copy(this.quaternion);
      this.dummy.scale.copy(this.scale);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      counts.set(key, index + 1);
    }

    for (const key of ANIMAL_VISUAL_KEYS) {
      const mesh = this.animalMeshes.get(key)!;
      mesh.count = counts.get(key)!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateFarAnimals(
    animals: Array<{ entity: RenderEntity; distanceSq: number }>,
    nearCount: number
  ): void {
    const farCount = Math.min(MAX_ANIMALS, Math.max(0, animals.length - nearCount));
    const color = new Color();

    for (let i = 0; i < farCount; i++) {
      const entity = animals[nearCount + i]!.entity;
      const key = animalKey(entity);
      const style = key ? animalStyle[key] : animalStyle["folsomia-candida:adult"];
      const offset = i * 3;
      this.farPositions[offset] = entity.position[0];
      this.farPositions[offset + 1] = entity.position[1];
      this.farPositions[offset + 2] = entity.position[2];
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
