import type { Creature, SpeciesParams } from './types.ts';

// ─── Species Parameter Sets ───────────────────────────────────────────────────

export const ORBIUM_PARAMS: SpeciesParams = {
  name: 'Orbium',
  R: 13,
  dt: 0.1,
  rings: [{ mu: 0.5, sigma: 0.15, weight: 1.0 }],
  growthMu: 0.15,
  growthSigma: 0.015,
};

export const GEMINIUM_PARAMS: SpeciesParams = {
  name: 'Geminium',
  R: 10,
  dt: 0.1,
  rings: [{ mu: 0.5, sigma: 0.15, weight: 1.0 }],
  growthMu: 0.14,
  growthSigma: 0.014,
};

export const SCUTIUM_PARAMS: SpeciesParams = {
  name: 'Scutium',
  R: 12,
  dt: 0.08,
  rings: [
    { mu: 0.5, sigma: 0.13, weight: 1.0 },
    { mu: 0.25, sigma: 0.1, weight: 0.4 },
  ],
  growthMu: 0.16,
  growthSigma: 0.016,
};

export const HYDROGEMINIUM_PARAMS: SpeciesParams = {
  name: 'Hydrogeminium',
  R: 15,
  dt: 0.05,
  rings: [
    { mu: 0.55, sigma: 0.15, weight: 1.0 },
    { mu: 0.25, sigma: 0.1, weight: 0.5 },
  ],
  growthMu: 0.12,
  growthSigma: 0.012,
};

// ─── Initial Condition Generators ─────────────────────────────────────────────

function gaussBlob(
  x: number, y: number,
  cx: number, cy: number,
  sigma: number,
  amplitude: number
): number {
  const dx = x - cx;
  const dy = y - cy;
  return amplitude * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

/**
 * Orbium: asymmetric crescent-shaped blob that starts gliding
 */
function orbiumInit(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const s = w / 256; // scale factor
  const R = 13 * s;

  // Main body
  const body = gaussBlob(x, y, cx, cy, R * 0.6, 0.9);
  // Asymmetric bump to induce motion
  const bump = gaussBlob(x, y, cx + R * 0.35, cy - R * 0.2, R * 0.35, 0.6);
  // Trailing edge depression
  const trail = gaussBlob(x, y, cx - R * 0.3, cy + R * 0.15, R * 0.4, -0.2);

  return Math.max(0, Math.min(1, body + bump + trail));
}

/**
 * Geminium: twin-lobed shape that splits
 */
function geminiumInit(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const s = w / 256;
  const R = 10 * s;

  const lobe1 = gaussBlob(x, y, cx - R * 0.5, cy, R * 0.5, 0.7);
  const lobe2 = gaussBlob(x, y, cx + R * 0.5, cy, R * 0.5, 0.7);
  const bridge = gaussBlob(x, y, cx, cy, R * 0.3, 0.5);

  return Math.max(0, Math.min(1, lobe1 + lobe2 + bridge));
}

/**
 * Scutium: ring/shield shape that pulses
 */
function scutiumInit(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const s = w / 256;
  const R = 12 * s;

  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);

  // Ring shape
  const ring = Math.exp(-Math.pow((r - R * 0.6) / (R * 0.25), 2)) * 0.8;
  // Center dot
  const center = gaussBlob(x, y, cx, cy, R * 0.2, 0.5);

  return Math.max(0, Math.min(1, ring + center));
}

/**
 * Hydrogeminium: complex multi-lobe swimmer
 */
function hydrogeminiumInit(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const s = w / 256;
  const R = 15 * s;

  const core = gaussBlob(x, y, cx, cy, R * 0.4, 0.8);
  const arm1 = gaussBlob(x, y, cx + R * 0.5, cy - R * 0.3, R * 0.3, 0.5);
  const arm2 = gaussBlob(x, y, cx - R * 0.5, cy + R * 0.3, R * 0.3, 0.5);
  const arm3 = gaussBlob(x, y, cx + R * 0.2, cy + R * 0.5, R * 0.25, 0.4);

  return Math.max(0, Math.min(1, core + arm1 + arm2 + arm3));
}

// ─── Creature Gallery ─────────────────────────────────────────────────────────

export const CREATURES: Creature[] = [
  {
    name: 'Orbium',
    emoji: '🌀',
    description: 'The classic Lenia glider. A smooth, asymmetric blob that moves gracefully across the grid. The first creature discovered in Lenia.',
    species: ORBIUM_PARAMS,
    init: orbiumInit,
  },
  {
    name: 'Geminium',
    emoji: '🧬',
    description: 'A self-replicating creature. Starts as a twin-lobed shape that can split and multiply, creating copies of itself.',
    species: GEMINIUM_PARAMS,
    init: geminiumInit,
  },
  {
    name: 'Scutium',
    emoji: '🛡️',
    description: 'A shield-like creature with a ring structure. Pulses rhythmically, expanding and contracting in a mesmerizing dance.',
    species: SCUTIUM_PARAMS,
    init: scutiumInit,
  },
  {
    name: 'Hydrogeminium',
    emoji: '🦠',
    description: 'A complex swimmer with multiple arms. Undulates through the medium like a microscopic organism, leaving trails of activity.',
    species: HYDROGEMINIUM_PARAMS,
    init: hydrogeminiumInit,
  },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

export function generateRandom(x: number, y: number, w: number, h: number): number {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const maxR = w * 0.35;
  if (r > maxR) return 0;
  // Seeded-ish random using position
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (hash - Math.floor(hash)) * 0.6 * (1 - r / maxR);
}
