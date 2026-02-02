// ─── Final Verification Integration Tests ──────────────────────────
// White Hat Pass 10: cross-module integration, preset stability,
// type system consistency, feature completeness

import { describe, it, expect } from 'vitest';

import {
  SPECIES,
  generateKernel,
  generateKernelTexture,
  generateCreaturePattern,
  generateRandomState,
} from '../gl/kernels';

import {
  SPECIES_IDS,
  DEFAULT_SPECIES,
  DEFAULT_GRID_SIZE,
  DEFAULT_COLOR_MAP,
  DEFAULT_BRUSH_SIZE,
  GROWTH_MU_RANGE,
  GROWTH_SIGMA_RANGE,
  DT_RANGE,
  CINEMATIC_INTERVAL,
  MORPH_DURATION,
  MUTATION_INTERVAL,
  MUTATION_MU_STEP,
  MUTATION_SIGMA_STEP,
  MUTATION_DT_STEP,
  POP_CHART_SAMPLES,
  POP_SAMPLE_INTERVAL,
  RANDOMIZE_COUNT,
  PETRI_DISH_MIN,
  PETRI_DISH_RANGE,
  PLACEMENT_MARGIN,
} from '../constants';

import { smoothstep, lerp, safeClamp } from '../utils';

import {
  CREATURES,
  ORBIUM_PARAMS,
  GEMINIUM_PARAMS,
  SCUTIUM_PARAMS,
  HYDROGEMINIUM_PARAMS,
  generateRandom,
} from '../species';

// ─── Cross-Module Integration ─────────────────────────────────────

describe('Cross-Module Integration', () => {
  it('every species generates a valid kernel', () => {
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      const kernel = generateKernel(sp.kernel);
      expect(kernel.length).toBe((2 * sp.kernel.radius + 1) ** 2);
      
      // Kernel should be normalized (sum ≈ 1)
      let sum = 0;
      for (let i = 0; i < kernel.length; i++) sum += kernel[i];
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('every species generates a valid RGBA kernel texture', () => {
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      const { data, size } = generateKernelTexture(sp.kernel);
      expect(size).toBe(2 * sp.kernel.radius + 1);
      expect(data.length).toBe(size * size * 4);
      
      // All values should be finite and non-negative
      for (let i = 0; i < data.length; i++) {
        expect(Number.isFinite(data[i])).toBe(true);
        expect(data[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every species generates a valid creature pattern', () => {
    for (const id of SPECIES_IDS) {
      const pattern = generateCreaturePattern(id, 64);
      expect(pattern.length).toBe(64 * 64);
      
      let hasNonZero = false;
      for (let i = 0; i < pattern.length; i++) {
        expect(pattern[i]).toBeGreaterThanOrEqual(0);
        expect(pattern[i]).toBeLessThanOrEqual(1);
        if (pattern[i] > 0) hasNonZero = true;
      }
      expect(hasNonZero).toBe(true);
    }
  });

  it('creature pattern size scales correctly', () => {
    const sizes = [32, 64, 128];
    for (const size of sizes) {
      const pattern = generateCreaturePattern('orbium', size);
      expect(pattern.length).toBe(size * size);
    }
  });

  it('random state generation works at all grid sizes', () => {
    for (const size of [128, 256, 512]) {
      const state = generateRandomState(size, size, 0.5);
      expect(state.length).toBe(size * size);
      
      let hasNonZero = false;
      for (let i = 0; i < state.length; i++) {
        expect(state[i]).toBeGreaterThanOrEqual(0);
        expect(state[i]).toBeLessThanOrEqual(1);
        expect(Number.isFinite(state[i])).toBe(true);
        if (state[i] > 0) hasNonZero = true;
      }
      expect(hasNonZero).toBe(true);
    }
  });

  it('species growth params are within safe ranges', () => {
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      expect(sp.growth.mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
      expect(sp.growth.mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
      expect(sp.growth.sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
      expect(sp.growth.sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
      expect(sp.dt).toBeGreaterThanOrEqual(DT_RANGE.min);
      expect(sp.dt).toBeLessThanOrEqual(DT_RANGE.max);
    }
  });
});

// ─── Species Completeness ─────────────────────────────────────────

describe('Species Completeness', () => {
  it('all 10 species have required fields', () => {
    expect(SPECIES_IDS.length).toBe(10);
    for (const id of SPECIES_IDS) {
      const sp = SPECIES[id];
      expect(sp.name).toBeTruthy();
      expect(sp.description).toBeTruthy();
      expect(sp.kernel).toBeDefined();
      expect(sp.growth).toBeDefined();
      expect(typeof sp.dt).toBe('number');
      expect(sp.kernel.radius).toBeGreaterThan(0);
      expect(sp.kernel.peaks.length).toBeGreaterThan(0);
      expect(sp.kernel.peakCenters.length).toBe(sp.kernel.peaks.length);
      expect(sp.kernel.peakWidths.length).toBe(sp.kernel.peaks.length);
    }
  });

  it('all species have unique names', () => {
    const names = SPECIES_IDS.map(id => SPECIES[id].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all species have unique IDs', () => {
    expect(new Set(SPECIES_IDS).size).toBe(SPECIES_IDS.length);
  });

  it('all species descriptions are non-trivial (> 20 chars)', () => {
    for (const id of SPECIES_IDS) {
      expect(SPECIES[id].description.length).toBeGreaterThan(20);
    }
  });

  it('kernel peak arrays are consistent per species', () => {
    for (const id of SPECIES_IDS) {
      const k = SPECIES[id].kernel;
      expect(k.peaks.length).toBe(k.peakCenters.length);
      expect(k.peaks.length).toBe(k.peakWidths.length);
      
      for (let i = 0; i < k.peaks.length; i++) {
        expect(k.peaks[i]).toBeGreaterThan(0);
        expect(k.peakCenters[i]).toBeGreaterThanOrEqual(0);
        expect(k.peakCenters[i]).toBeLessThanOrEqual(1);
        expect(k.peakWidths[i]).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Creatures Gallery Integration ────────────────────────────────

describe('Creatures Gallery', () => {
  it('all 4 creatures have valid species params', () => {
    expect(CREATURES.length).toBe(4);
    for (const c of CREATURES) {
      expect(c.name).toBeTruthy();
      expect(c.emoji).toBeTruthy();
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.species).toBeDefined();
      expect(c.species.R).toBeGreaterThan(0);
      expect(c.species.dt).toBeGreaterThan(0);
      expect(c.species.rings.length).toBeGreaterThan(0);
      expect(typeof c.init).toBe('function');
    }
  });

  it('creature init functions produce valid patterns', () => {
    const size = 64;
    for (const c of CREATURES) {
      let hasNonZero = false;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const v = c.init(x, y, size, size);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
          expect(Number.isFinite(v)).toBe(true);
          if (v > 0) hasNonZero = true;
        }
      }
      expect(hasNonZero).toBe(true);
    }
  });

  it('generateRandom produces values in [0, 1]', () => {
    const size = 128;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = generateRandom(x, y, size, size);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('named param exports match creature entries', () => {
    expect(ORBIUM_PARAMS.name).toBe('Orbium');
    expect(GEMINIUM_PARAMS.name).toBe('Geminium');
    expect(SCUTIUM_PARAMS.name).toBe('Scutium');
    expect(HYDROGEMINIUM_PARAMS.name).toBe('Hydrogeminium');
  });
});

// ─── Mutation Safety ──────────────────────────────────────────────

describe('Mutation Mode Safety', () => {
  it('random walk stays in growth mu range over 10000 steps', () => {
    let mu = 0.15;
    for (let i = 0; i < 10000; i++) {
      mu += (Math.random() - 0.5) * 2 * MUTATION_MU_STEP;
      mu = Math.max(GROWTH_MU_RANGE.min, Math.min(GROWTH_MU_RANGE.max, mu));
    }
    expect(mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
    expect(mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
  });

  it('random walk stays in growth sigma range over 10000 steps', () => {
    let sigma = 0.015;
    for (let i = 0; i < 10000; i++) {
      sigma += (Math.random() - 0.5) * 2 * MUTATION_SIGMA_STEP;
      sigma = Math.max(GROWTH_SIGMA_RANGE.min, Math.min(GROWTH_SIGMA_RANGE.max, sigma));
    }
    expect(sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
    expect(sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
  });

  it('random walk stays in dt range over 10000 steps', () => {
    let dt = 0.1;
    for (let i = 0; i < 10000; i++) {
      dt += (Math.random() - 0.5) * 2 * MUTATION_DT_STEP;
      dt = Math.max(DT_RANGE.min, Math.min(DT_RANGE.max, dt));
    }
    expect(dt).toBeGreaterThanOrEqual(DT_RANGE.min);
    expect(dt).toBeLessThanOrEqual(DT_RANGE.max);
  });

  it('mutation step sizes are small relative to ranges', () => {
    const muRange = GROWTH_MU_RANGE.max - GROWTH_MU_RANGE.min;
    const sigmaRange = GROWTH_SIGMA_RANGE.max - GROWTH_SIGMA_RANGE.min;
    const dtRange = DT_RANGE.max - DT_RANGE.min;
    
    expect(MUTATION_MU_STEP / muRange).toBeLessThan(0.02);
    expect(MUTATION_SIGMA_STEP / sigmaRange).toBeLessThan(0.02);
    expect(MUTATION_DT_STEP / dtRange).toBeLessThan(0.02);
  });
});

// ─── Smoothstep Morphing ─────────────────────────────────────────

describe('Species Morphing Math', () => {
  it('smoothstep produces monotonic output for [0,1] input', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const s = smoothstep(t);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('smoothstep clamps outside [0,1]', () => {
    expect(smoothstep(-0.5)).toBe(0);
    expect(smoothstep(1.5)).toBe(1);
  });

  it('lerp produces correct intermediate values', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(2, 8, 0.25)).toBeCloseTo(3.5);
  });

  it('safeClamp handles NaN with fallback', () => {
    expect(safeClamp(NaN, 0, 1, 0.5)).toBe(0.5);
    expect(safeClamp(Infinity, 0, 1, 0.5)).toBe(1);
    expect(safeClamp(-Infinity, 0, 1, 0.5)).toBe(0);
    expect(safeClamp(0.7, 0, 1, 0.5)).toBe(0.7);
  });

  it('morphing between all adjacent species pairs produces valid params', () => {
    for (let i = 0; i < SPECIES_IDS.length - 1; i++) {
      const a = SPECIES[SPECIES_IDS[i]];
      const b = SPECIES[SPECIES_IDS[i + 1]];
      
      for (let t = 0; t <= 1; t += 0.1) {
        const mu = lerp(a.growth.mu, b.growth.mu, smoothstep(t));
        const sigma = lerp(a.growth.sigma, b.growth.sigma, smoothstep(t));
        const dt = lerp(a.dt, b.dt, smoothstep(t));
        
        expect(mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
        expect(mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
        expect(sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
        expect(sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
        expect(dt).toBeGreaterThanOrEqual(DT_RANGE.min);
        expect(dt).toBeLessThanOrEqual(DT_RANGE.max);
      }
    }
  });
});

// ─── Timing Constants Consistency ─────────────────────────────────

describe('Timing & Configuration Consistency', () => {
  it('cinematic interval allows morph to complete', () => {
    expect(MORPH_DURATION).toBeLessThan(CINEMATIC_INTERVAL * 0.5);
  });

  it('mutation interval samples at reasonable frequency', () => {
    expect(MUTATION_INTERVAL).toBeGreaterThanOrEqual(100);
    expect(MUTATION_INTERVAL).toBeLessThanOrEqual(2000);
  });

  it('population chart has sufficient sample count', () => {
    expect(POP_CHART_SAMPLES).toBeGreaterThanOrEqual(100);
    expect(POP_SAMPLE_INTERVAL).toBeGreaterThanOrEqual(50);
    expect(POP_SAMPLE_INTERVAL).toBeLessThanOrEqual(500);
  });

  it('placement margin leaves room for creatures', () => {
    expect(PLACEMENT_MARGIN).toBeGreaterThan(0);
    expect(PLACEMENT_MARGIN).toBeLessThan(0.5);
    // Available placement area should be > 50% of canvas
    const available = (1 - 2 * PLACEMENT_MARGIN);
    expect(available).toBeGreaterThan(0.5);
  });

  it('petri dish count range is reasonable', () => {
    const min = PETRI_DISH_MIN;
    const max = PETRI_DISH_MIN + PETRI_DISH_RANGE;
    expect(min).toBeGreaterThanOrEqual(2);
    expect(max).toBeLessThanOrEqual(SPECIES_IDS.length);
  });

  it('default brush size is usable', () => {
    expect(DEFAULT_BRUSH_SIZE).toBeGreaterThanOrEqual(0.005);
    expect(DEFAULT_BRUSH_SIZE).toBeLessThanOrEqual(0.2);
  });

  it('randomize count produces visible results', () => {
    expect(RANDOMIZE_COUNT).toBeGreaterThanOrEqual(1);
    expect(RANDOMIZE_COUNT).toBeLessThanOrEqual(10);
  });

  it('default color map index is valid', () => {
    expect(DEFAULT_COLOR_MAP).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_COLOR_MAP).toBeLessThan(6); // 6 color maps
  });

  it('default grid size is one of the supported sizes', () => {
    expect([128, 256, 512]).toContain(DEFAULT_GRID_SIZE);
  });
});

// ─── Module Export Verification ───────────────────────────────────

describe('Module Exports', () => {
  it('kernels.ts exports all expected symbols', () => {
    expect(typeof generateKernel).toBe('function');
    expect(typeof generateKernelTexture).toBe('function');
    expect(typeof generateCreaturePattern).toBe('function');
    expect(typeof generateRandomState).toBe('function');
    expect(typeof SPECIES).toBe('object');
  });

  it('constants.ts exports all expected symbols', () => {
    expect(typeof SPECIES_IDS).toBe('object');
    expect(typeof CINEMATIC_INTERVAL).toBe('number');
    expect(typeof MORPH_DURATION).toBe('number');
    expect(typeof DEFAULT_GRID_SIZE).toBe('number');
    expect(typeof DEFAULT_COLOR_MAP).toBe('number');
    expect(typeof DEFAULT_SPECIES).toBe('string');
    expect(typeof DEFAULT_BRUSH_SIZE).toBe('number');
    expect(typeof MUTATION_INTERVAL).toBe('number');
    expect(typeof MUTATION_MU_STEP).toBe('number');
    expect(typeof MUTATION_SIGMA_STEP).toBe('number');
    expect(typeof MUTATION_DT_STEP).toBe('number');
    expect(typeof POP_CHART_SAMPLES).toBe('number');
    expect(typeof POP_SAMPLE_INTERVAL).toBe('number');
  });

  it('utils.ts exports all expected functions', () => {
    expect(typeof smoothstep).toBe('function');
    expect(typeof lerp).toBe('function');
    expect(typeof safeClamp).toBe('function');
  });

  it('species.ts exports all expected symbols', () => {
    expect(typeof CREATURES).toBe('object');
    expect(typeof ORBIUM_PARAMS).toBe('object');
    expect(typeof GEMINIUM_PARAMS).toBe('object');
    expect(typeof SCUTIUM_PARAMS).toBe('object');
    expect(typeof HYDROGEMINIUM_PARAMS).toBe('object');
    expect(typeof generateRandom).toBe('function');
  });

  it('dead WebGL2 modules are not importable', () => {
    // These modules were deleted in Blue Hat pass — verify they stay gone
    expect(() => require('../engine/LeniaEngine')).toThrow();
    expect(() => require('../components/SimCanvas')).toThrow();
    expect(() => require('../components/Gallery')).toThrow();
  });
});
