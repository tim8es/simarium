import { PerspectiveCamera, Vector3 } from "three";
import { FlyControls } from "three/addons/controls/FlyControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RenderAdapter } from "@simarium/render-core";

export type CameraMode = "orbit" | "free" | "macro" | "follow";

export class CameraController {
  readonly camera: PerspectiveCamera;
  private readonly orbit: OrbitControls;
  private readonly fly: FlyControls;
  private readonly adapter: RenderAdapter;
  private mode: CameraMode = "orbit";
  private followTargetId: string | null = null;
  private readonly target = new Vector3();
  private readonly desiredCamera = new Vector3();

  constructor(domElement: HTMLElement, adapter: RenderAdapter) {
    this.adapter = adapter;
    this.camera = new PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.001, 10);
    this.camera.position.set(1.35, 0.8, 1.1);

    this.orbit = new OrbitControls(this.camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.075;
    this.orbit.target.set(0, 0.33, 0);
    this.orbit.minDistance = 0.08;
    this.orbit.maxDistance = 3.5;

    this.fly = new FlyControls(this.camera, domElement);
    this.fly.enabled = false;
    this.fly.dragToLook = true;
    this.fly.movementSpeed = 0.35;
    this.fly.rollSpeed = 0.35;
  }

  setFollowTarget(id: string): void {
    this.followTargetId = id;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.orbit.enabled = false;
    this.fly.enabled = false;

    if (mode === "orbit") {
      this.camera.fov = 48;
      this.camera.near = 0.001;
      this.camera.position.set(1.35, 0.8, 1.1);
      this.orbit.target.set(0, 0.33, 0);
      this.orbit.minDistance = 0.08;
      this.orbit.maxDistance = 3.5;
      this.orbit.enabled = true;
    } else if (mode === "free") {
      this.camera.fov = 55;
      this.camera.near = 0.001;
      this.camera.position.set(0.82, 0.44, 0.62);
      this.fly.enabled = true;
    } else if (mode === "macro") {
      const entity = this.followTargetId ? this.adapter.getEntity(this.followTargetId) : undefined;
      this.target.set(...(entity?.position ?? [0, 0.15, 0]));
      this.camera.fov = 34;
      this.camera.near = 0.00015;
      this.camera.position.copy(this.target).add(new Vector3(0.028, 0.018, 0.038));
      this.orbit.target.copy(this.target);
      this.orbit.minDistance = 0.008;
      this.orbit.maxDistance = 0.18;
      this.orbit.enabled = true;
    } else {
      this.camera.fov = 38;
      this.camera.near = 0.0002;
    }

    this.camera.updateProjectionMatrix();
  }

  update(dtSeconds: number): void {
    if (this.mode === "follow" && this.followTargetId) {
      const entity = this.adapter.getEntity(this.followTargetId);
      if (entity) {
        this.target.set(...entity.position);
        this.desiredCamera.copy(this.target).add(new Vector3(0.035, 0.022, 0.045));
        const blend = 1 - Math.exp(-6 * dtSeconds);
        this.camera.position.lerp(this.desiredCamera, blend);
        this.camera.lookAt(this.target);
      }
    } else if (this.orbit.enabled) {
      this.orbit.update();
    } else if (this.fly.enabled) {
      this.fly.update(dtSeconds);
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  getMode(): CameraMode {
    return this.mode;
  }
}
