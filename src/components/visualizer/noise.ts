/**
 * Simplex Noise Implementation for Flow Field Visualizer
 * 
 * Based on Stefan Gustavson's simplex noise algorithm.
 * Optimized for 2D/3D flow field generation.
 * 
 * @module components/visualizer/noise
 */

// Permutation table
const p = new Uint8Array(256);
const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// Gradient vectors for 3D
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
]);

// Skewing factors for 2D and 3D
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

/**
 * Initialize the permutation table with a seed.
 */
export function seed(s: number): void {
  // Simple seeded random
  const random = () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };

  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }

  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
}

// Initialize with default seed
seed(Date.now());

/**
 * 2D Simplex Noise
 */
export function noise2D(x: number, y: number): number {
  // Skew input to determine which simplex cell we're in
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  // Unskew back to get simplex vertex coordinates
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  // Determine which simplex we're in
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  // Offsets for corners
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  // Hash coordinates
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = permMod12[ii + perm[jj]] * 3;
  const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
  const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;

  // Calculate contributions from each corner
  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
  }

  // Sum contributions and scale to [-1, 1]
  return 70 * (n0 + n1 + n2);
}

/**
 * 3D Simplex Noise (for animated flow fields)
 */
export function noise3D(x: number, y: number, z: number): number {
  // Skew input
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  // Unskew
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  // Determine simplex
  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  // Offsets
  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3;
  const y3 = y0 - 1 + 3 * G3;
  const z3 = z0 - 1 + 3 * G3;

  // Hash
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  const gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3;
  const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
  const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
  const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;

  // Contributions
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0 + grad3[gi0 + 2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1 + grad3[gi1 + 2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2 + grad3[gi2 + 2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 >= 0) {
    t3 *= t3;
    n3 = t3 * t3 * (grad3[gi3] * x3 + grad3[gi3 + 1] * y3 + grad3[gi3 + 2] * z3);
  }

  return 32 * (n0 + n1 + n2 + n3);
}

export default { seed, noise2D, noise3D };
