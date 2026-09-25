export interface GridSnapshot {
  width: number;
  height: number;
  depth: number;
  values: number[];
}

export class ScalarGrid3D {
  readonly values: Float64Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly depth: number,
    initialValue = 0,
    values?: ArrayLike<number>
  ) {
    if (![width, height, depth].every((v) => Number.isInteger(v) && v > 0)) {
      throw new Error("Grid dimensions must be positive integers");
    }
    const length = width * height * depth;
    this.values = values ? Float64Array.from(values) : new Float64Array(length);
    if (this.values.length !== length) {
      throw new Error(`Expected ${length} grid values, received ${this.values.length}`);
    }
    if (!values) this.values.fill(initialValue);
    this.assertFinite();
  }

  index(x: number, y: number, z: number): number {
    if (
      x < 0 || x >= this.width ||
      y < 0 || y >= this.height ||
      z < 0 || z >= this.depth
    ) {
      throw new Error(`Grid coordinate out of bounds: ${x},${y},${z}`);
    }
    return x + this.width * (y + this.height * z);
  }

  get(x: number, y: number, z: number): number {
    return this.values[this.index(x, y, z)]!;
  }

  set(x: number, y: number, z: number, value: number): void {
    if (!Number.isFinite(value)) throw new Error("Grid value must be finite");
    this.values[this.index(x, y, z)] = value;
  }

  total(): number {
    let sum = 0;
    for (const value of this.values) sum += value;
    return sum;
  }

  mean(): number {
    return this.total() / this.values.length;
  }

  min(): number {
    let result = Infinity;
    for (const value of this.values) result = Math.min(result, value);
    return result;
  }

  max(): number {
    let result = -Infinity;
    for (const value of this.values) result = Math.max(result, value);
    return result;
  }

  diffuse(alpha: number): void {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1 / 6) {
      throw new Error("Diffusion alpha must be in [0, 1/6] for the explicit 3D scheme");
    }
    if (alpha === 0) return;

    const source = this.values.slice();
    const next = new Float64Array(source.length);

    for (let z = 0; z < this.depth; z++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const i = this.index(x, y, z);
          const center = source[i]!;
          let laplacian = 0;
          if (x > 0) laplacian += source[this.index(x - 1, y, z)]! - center;
          if (x + 1 < this.width) laplacian += source[this.index(x + 1, y, z)]! - center;
          if (y > 0) laplacian += source[this.index(x, y - 1, z)]! - center;
          if (y + 1 < this.height) laplacian += source[this.index(x, y + 1, z)]! - center;
          if (z > 0) laplacian += source[this.index(x, y, z - 1)]! - center;
          if (z + 1 < this.depth) laplacian += source[this.index(x, y, z + 1)]! - center;
          next[i] = center + alpha * laplacian;
        }
      }
    }

    this.values.set(next);
    this.assertFinite();
  }

  relaxBoundaryFaces(target: number, fraction: number): void {
    if (!Number.isFinite(target)) throw new Error("Boundary target must be finite");
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new Error("Boundary relaxation fraction must be in [0, 1]");
    }

    for (let z = 0; z < this.depth; z++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const boundary =
            x === 0 || x === this.width - 1 ||
            y === 0 || y === this.height - 1 ||
            z === 0 || z === this.depth - 1;
          if (!boundary) continue;
          const i = this.index(x, y, z);
          this.values[i] = this.values[i]! + (target - this.values[i]!) * fraction;
        }
      }
    }
  }

  snapshot(): GridSnapshot {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth,
      values: Array.from(this.values)
    };
  }

  static fromSnapshot(snapshot: GridSnapshot): ScalarGrid3D {
    return new ScalarGrid3D(
      snapshot.width,
      snapshot.height,
      snapshot.depth,
      0,
      snapshot.values
    );
  }

  assertFinite(): void {
    for (let i = 0; i < this.values.length; i++) {
      if (!Number.isFinite(this.values[i]!)) {
        throw new Error(`Grid contains non-finite value at index ${i}`);
      }
    }
  }
}
