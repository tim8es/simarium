export type RngState = readonly [number, number, number, number];

function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function seedWords(seed: number): [number, number, number, number] {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };

  const words: [number, number, number, number] = [next(), next(), next(), next()];
  if (words.every((value) => value === 0)) words[0] = 1;
  return words;
}

export class DeterministicRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number, state?: RngState) {
    const words = state
      ? [...state] as [number, number, number, number]
      : seedWords(seed);
    if (words.every((value) => value === 0)) {
      throw new Error("RNG state cannot be all zero");
    }
    [this.s0, this.s1, this.s2, this.s3] = words.map((value) => value >>> 0) as [
      number, number, number, number
    ];
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);

    this.s0 >>>= 0;
    this.s1 >>>= 0;
    this.s2 >>>= 0;
    this.s3 >>>= 0;
    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive integer");
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  getState(): RngState {
    return [this.s0, this.s1, this.s2, this.s3] as const;
  }
}
