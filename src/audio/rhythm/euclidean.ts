/**
 * Euclidean Rhythm Generator - Bjorklund's Algorithm
 * 
 * Distributes k pulses as evenly as possible over n steps.
 * Creates culturally significant rhythms found worldwide:
 * - (3,8) = Tresillo/Reggaeton
 * - (5,8) = Cinquillo/Cuban
 * - (7,12) = West African bell pattern
 * - (5,16) = Bossa Nova
 * 
 * @module audio/rhythm/euclidean
 */

// ===========================================
// TYPES
// ===========================================

export interface EuclideanPattern {
  /** The binary pattern (true = pulse, false = rest) */
  pattern: boolean[];
  /** Number of steps */
  steps: number;
  /** Number of pulses */
  pulses: number;
  /** Rotation offset */
  rotation: number;
}

// ===========================================
// BJORKLUND'S ALGORITHM
// ===========================================

/**
 * Generate a Euclidean rhythm pattern using Bjorklund's algorithm.
 * 
 * The algorithm distributes pulses evenly by recursively applying
 * the Bresenham line algorithm principle.
 * 
 * @param steps - Total number of steps (n)
 * @param pulses - Number of pulses to distribute (k)
 * @param rotation - Rotation offset (default 0)
 * @returns EuclideanPattern object
 * 
 * @example
 * euclidean(8, 3) // Returns [1,0,0,1,0,0,1,0] (Tresillo)
 * euclidean(8, 5) // Returns [1,0,1,1,0,1,1,0] (Cinquillo)
 */
export function euclidean(steps: number, pulses: number, rotation: number = 0): EuclideanPattern {
  // Clamp pulses to valid range
  pulses = Math.max(0, Math.min(pulses, steps));
  
  if (steps <= 0) {
    return { pattern: [], steps: 0, pulses: 0, rotation: 0 };
  }
  
  if (pulses === 0) {
    return { 
      pattern: Array(steps).fill(false), 
      steps, 
      pulses: 0, 
      rotation 
    };
  }
  
  if (pulses === steps) {
    return { 
      pattern: Array(steps).fill(true), 
      steps, 
      pulses, 
      rotation 
    };
  }

  // Bjorklund's algorithm using the Bresenham approach
  const pattern: boolean[] = [];
  let bucket = 0;
  
  for (let i = 0; i < steps; i++) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern.push(true);
    } else {
      pattern.push(false);
    }
  }
  
  // Apply rotation
  const rotated = rotatePattern(pattern, rotation);
  
  return {
    pattern: rotated,
    steps,
    pulses,
    rotation,
  };
}

/**
 * Rotate a pattern by n steps.
 * Positive rotation shifts right, negative shifts left.
 */
export function rotatePattern(pattern: boolean[], rotation: number): boolean[] {
  if (pattern.length === 0 || rotation === 0) return [...pattern];
  
  const len = pattern.length;
  const normalizedRotation = ((rotation % len) + len) % len;
  
  return [
    ...pattern.slice(len - normalizedRotation),
    ...pattern.slice(0, len - normalizedRotation),
  ];
}

/**
 * Convert a pattern to a string representation.
 * 
 * @example
 * patternToString([true, false, false, true]) // "x--x"
 */
export function patternToString(pattern: boolean[]): string {
  return pattern.map(p => p ? 'x' : '-').join('');
}

/**
 * Convert a string to a pattern.
 * 
 * @example
 * stringToPattern("x--x") // [true, false, false, true]
 */
export function stringToPattern(str: string): boolean[] {
  return str.split('').map(c => c === 'x' || c === '1');
}

// ===========================================
// PRESET PATTERNS
// ===========================================

export const EUCLIDEAN_PRESETS = {
  // 8-step patterns
  tresillo: { steps: 8, pulses: 3, name: 'Tresillo', origin: 'Cuba/Reggaeton' },
  cinquillo: { steps: 8, pulses: 5, name: 'Cinquillo', origin: 'Cuba' },
  
  // 12-step patterns
  westAfrican: { steps: 12, pulses: 7, name: 'West African Bell', origin: 'Ghana' },
  
  // 16-step patterns
  bossaNova: { steps: 16, pulses: 5, name: 'Bossa Nova', origin: 'Brazil' },
  fourOnFloor: { steps: 16, pulses: 4, name: 'Four on the Floor', origin: 'Disco/House' },
  
  // Odd meters
  balkan7_3: { steps: 7, pulses: 3, name: 'Balkan 7/8', origin: 'Balkans' },
  indian9_4: { steps: 9, pulses: 4, name: 'Navatal', origin: 'India' },
} as const;

export type EuclideanPresetName = keyof typeof EUCLIDEAN_PRESETS;

/**
 * Generate a pattern from a preset name.
 */
export function fromPreset(presetName: EuclideanPresetName, rotation: number = 0): EuclideanPattern {
  const preset = EUCLIDEAN_PRESETS[presetName];
  return euclidean(preset.steps, preset.pulses, rotation);
}

// ===========================================
// PATTERN ANALYSIS
// ===========================================

/**
 * Get the indices where pulses occur in a pattern.
 */
export function getPulseIndices(pattern: boolean[]): number[] {
  return pattern.reduce<number[]>((acc, val, idx) => {
    if (val) acc.push(idx);
    return acc;
  }, []);
}

/**
 * Calculate the density (ratio of pulses to steps).
 */
export function getPatternDensity(pattern: boolean[]): number {
  if (pattern.length === 0) return 0;
  return pattern.filter(Boolean).length / pattern.length;
}

/**
 * Get the intervals between pulses (useful for analyzing rhythm feel).
 */
export function getPulseIntervals(pattern: boolean[]): number[] {
  const indices = getPulseIndices(pattern);
  if (indices.length < 2) return [];
  
  const intervals: number[] = [];
  for (let i = 1; i < indices.length; i++) {
    intervals.push(indices[i] - indices[i - 1]);
  }
  // Add wrap-around interval
  intervals.push(pattern.length - indices[indices.length - 1] + indices[0]);
  
  return intervals;
}

// ===========================================
// PATTERN MANIPULATION
// ===========================================

/**
 * Invert a pattern (swap pulses and rests).
 */
export function invertPattern(pattern: boolean[]): boolean[] {
  return pattern.map(p => !p);
}

/**
 * Combine two patterns with OR logic.
 */
export function combinePatterns(a: boolean[], b: boolean[]): boolean[] {
  const maxLen = Math.max(a.length, b.length);
  const result: boolean[] = [];
  
  for (let i = 0; i < maxLen; i++) {
    result.push((a[i % a.length] ?? false) || (b[i % b.length] ?? false));
  }
  
  return result;
}

/**
 * Apply probability to each step.
 * Returns a function that, when called, returns a new pattern
 * with probabilistic triggering applied.
 */
export function applyProbability(
  pattern: boolean[],
  probabilities: number[]
): () => boolean[] {
  return () => pattern.map((pulse, i) => {
    if (!pulse) return false;
    const prob = probabilities[i] ?? 1;
    return Math.random() < prob;
  });
}

export default euclidean;
