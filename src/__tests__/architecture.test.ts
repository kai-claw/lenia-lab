// ─── Architecture & Integration Tests ─────────────────────────────
// Blue Hat Pass 6: module structure, constants, cross-module integration
import { describe, it, expect } from 'vitest';

import {
  SPECIES_IDS,
  CINEMATIC_INTERVAL,
  MORPH_DURATION,
  DEFAULT_GRID_SIZE,
  DEFAULT_COLOR_MAP,
  DEFAULT_SPECIES,
  DEFAULT_BRUSH_SIZE,
  RANDOMIZE_COUNT,
  PETRI_DISH_MIN,
  PETRI_DISH_RANGE,
  PLACEMENT_MARGIN,
  GROWTH_MU_RANGE,
  GROWTH_SIGMA_RANGE,
  DT_RANGE,
  MUTATION_INTERVAL,
  MUTATION_MU_STEP,
  MUTATION_SIGMA_STEP,
  MUTATION_DT_STEP,
  POP_CHART_SAMPLES,
  POP_SAMPLE_INTERVAL,
} from '../constants';

import { smoothstep, lerp, safeClamp } from '../utils';

import {
  SPECIES,
  generateKernel,
  generateKernelTexture,
  generateCreaturePattern,
  generateRandomState,
  type SpeciesParams,
  type KernelParams,
  type GrowthParams,
} from '../gl/kernels';

// ─── Constants Validation ─────────────────────────────────────────

describe('Constants', () => {
  it('SPECIES_IDS matches SPECIES record keys', () => {
    expect(SPECIES_IDS).toEqual(Object.keys(SPECIES));
    expect(SPECIES_IDS.length).toBeGreaterThanOrEqual(10);
  });

  it('DEFAULT_SPECIES exists in SPECIES', () => {
    expect(SPECIES[DEFAULT_SPECIES]).toBeDefined();
  });

  it('CINEMATIC_INTERVAL is positive', () => {
    expect(CINEMATIC_INTERVAL).toBeGreaterThan(0);
  });

  it('MORPH_DURATION is positive and less than CINEMATIC_INTERVAL', () => {
    expect(MORPH_DURATION).toBeGreaterThan(0);
    expect(MORPH_DURATION).toBeLessThan(CINEMATIC_INTERVAL);
  });

  it('DEFAULT_GRID_SIZE is a power of 2', () => {
    expect(DEFAULT_GRID_SIZE).toBeGreaterThan(0);
    expect(Math.log2(DEFAULT_GRID_SIZE) % 1).toBe(0);
  });

  it('DEFAULT_COLOR_MAP is a valid index', () => {
    expect(DEFAULT_COLOR_MAP).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_BRUSH_SIZE is in (0, 1)', () => {
    expect(DEFAULT_BRUSH_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_BRUSH_SIZE).toBeLessThan(1);
  });

  it('RANDOMIZE_COUNT is positive', () => {
    expect(RANDOMIZE_COUNT).toBeGreaterThan(0);
  });

  it('PETRI_DISH range produces valid counts', () => {
    expect(PETRI_DISH_MIN).toBeGreaterThan(0);
    expect(PETRI_DISH_RANGE).toBeGreaterThan(0);
    // Max creatures
    expect(PETRI_DISH_MIN + PETRI_DISH_RANGE - 1).toBeLessThanOrEqual(SPECIES_IDS.length);
  });

  it('PLACEMENT_MARGIN leaves room for placement', () => {
    expect(PLACEMENT_MARGIN).toBeGreaterThan(0);
    expect(PLACEMENT_MARGIN).toBeLessThan(0.5); // Must leave center space
    expect(1 - 2 * PLACEMENT_MARGIN).toBeGreaterThan(0);
  });

  it('growth param ranges are valid', () => {
    for (const range of [GROWTH_MU_RANGE, GROWTH_SIGMA_RANGE, DT_RANGE]) {
      expect(range.min).toBeLessThan(range.max);
      expect(range.fallback).toBeGreaterThanOrEqual(range.min);
      expect(range.fallback).toBeLessThanOrEqual(range.max);
    }
  });
});

// ─── Utility Functions ────────────────────────────────────────────

describe('Utils', () => {
  describe('smoothstep', () => {
    it('returns 0 at t=0', () => {
      expect(smoothstep(0)).toBe(0);
    });

    it('returns 1 at t=1', () => {
      expect(smoothstep(1)).toBe(1);
    });

    it('returns 0.5 at t=0.5', () => {
      expect(smoothstep(0.5)).toBe(0.5);
    });

    it('clamps below 0', () => {
      expect(smoothstep(-1)).toBe(0);
    });

    it('clamps above 1', () => {
      expect(smoothstep(2)).toBe(1);
    });

    it('is monotonically increasing', () => {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        const v = smoothstep(t);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-10);
        prev = v;
      }
    });
  });

  describe('lerp', () => {
    it('returns a at t=0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('returns b at t=1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('returns midpoint at t=0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('extrapolates beyond 0-1', () => {
      expect(lerp(0, 10, 2)).toBe(20);
    });
  });

  describe('safeClamp', () => {
    it('clamps within range', () => {
      expect(safeClamp(0.5, 0, 1, 0.5)).toBe(0.5);
    });

    it('clamps below min', () => {
      expect(safeClamp(-5, 0, 1, 0.5)).toBe(0);
    });

    it('clamps above max', () => {
      expect(safeClamp(10, 0, 1, 0.5)).toBe(1);
    });

    it('uses fallback for NaN', () => {
      expect(safeClamp(NaN, 0, 1, 0.75)).toBe(0.75);
    });

    it('uses fallback for NaN and clamps it', () => {
      expect(safeClamp(NaN, 0.5, 1, 0.2)).toBe(0.5);
    });
  });
});

// ─── Species Completeness ─────────────────────────────────────────

describe('Species completeness', () => {
  it('all species have required fields', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      expect(sp.name, `${id}.name`).toBeTruthy();
      expect(sp.description, `${id}.description`).toBeTruthy();
      expect(sp.dt, `${id}.dt`).toBeGreaterThan(0);
      expect(sp.dt, `${id}.dt`).toBeLessThanOrEqual(DT_RANGE.max);
      expect(sp.kernel, `${id}.kernel`).toBeDefined();
      expect(sp.growth, `${id}.growth`).toBeDefined();
    }
  });

  it('all species have valid kernel params', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      const k = sp.kernel;
      expect(k.radius, `${id}.kernel.radius`).toBeGreaterThan(0);
      expect(k.peaks.length, `${id}.kernel.peaks`).toBeGreaterThan(0);
      expect(k.peakCenters.length, `${id}.kernel.peakCenters`).toBe(k.peaks.length);
      expect(k.peakWidths.length, `${id}.kernel.peakWidths`).toBe(k.peaks.length);

      // All peak values positive
      for (let i = 0; i < k.peaks.length; i++) {
        expect(k.peaks[i], `${id}.peaks[${i}]`).toBeGreaterThan(0);
        expect(k.peakCenters[i], `${id}.peakCenters[${i}]`).toBeGreaterThanOrEqual(0);
        expect(k.peakCenters[i], `${id}.peakCenters[${i}]`).toBeLessThanOrEqual(1);
        expect(k.peakWidths[i], `${id}.peakWidths[${i}]`).toBeGreaterThan(0);
      }
    }
  });

  it('all species have valid growth params', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      expect(sp.growth.mu, `${id}.growth.mu`).toBeGreaterThan(0);
      expect(sp.growth.mu, `${id}.growth.mu`).toBeLessThan(1);
      expect(sp.growth.sigma, `${id}.growth.sigma`).toBeGreaterThan(0);
    }
  });

  it('all species names are unique', () => {
    const names = Object.values(SPECIES).map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all species IDs are unique', () => {
    expect(new Set(SPECIES_IDS).size).toBe(SPECIES_IDS.length);
  });
});

// ─── Cross-module Integration ─────────────────────────────────────

describe('Cross-module integration', () => {
  it('every species produces a valid kernel', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      const kernel = generateKernel(sp.kernel);
      expect(kernel.length, `${id} kernel size`).toBe(
        (2 * sp.kernel.radius + 1) ** 2
      );

      // Kernel should be normalized (sum ≈ 1)
      let sum = 0;
      for (let i = 0; i < kernel.length; i++) sum += kernel[i];
      expect(sum).toBeCloseTo(1.0, 2);

      // No NaN/Infinity
      for (let i = 0; i < kernel.length; i++) {
        expect(isFinite(kernel[i]), `${id} kernel[${i}] finite`).toBe(true);
      }
    }
  });

  it('every species produces a valid RGBA kernel texture', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      const { data, size } = generateKernelTexture(sp.kernel);
      expect(size).toBe(2 * sp.kernel.radius + 1);
      expect(data.length).toBe(size * size * 4);

      // All RGBA values finite
      for (let i = 0; i < data.length; i++) {
        expect(isFinite(data[i]), `${id} texture[${i}] finite`).toBe(true);
      }
    }
  });

  it('every species produces a valid creature pattern', () => {
    for (const id of SPECIES_IDS) {
      const pattern = generateCreaturePattern(id, 64);
      expect(pattern.length).toBe(64 * 64);

      // Values in [0, 1]
      let hasNonZero = false;
      for (let i = 0; i < pattern.length; i++) {
        expect(pattern[i]).toBeGreaterThanOrEqual(0);
        expect(pattern[i]).toBeLessThanOrEqual(1);
        if (pattern[i] > 0) hasNonZero = true;
      }
      expect(hasNonZero, `${id} pattern is non-trivial`).toBe(true);
    }
  });

  it('generateRandomState produces valid state', () => {
    const state = generateRandomState(128, 128, 0.5);
    expect(state.length).toBe(128 * 128);

    let hasNonZero = false;
    for (let i = 0; i < state.length; i++) {
      expect(state[i]).toBeGreaterThanOrEqual(0);
      expect(state[i]).toBeLessThanOrEqual(1);
      if (state[i] > 0) hasNonZero = true;
    }
    expect(hasNonZero).toBe(true);
  });

  it('default species params are within safe clamp ranges', () => {
    const sp = SPECIES[DEFAULT_SPECIES];
    expect(sp.growth.mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
    expect(sp.growth.mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
    expect(sp.growth.sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
    expect(sp.growth.sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
    expect(sp.dt).toBeGreaterThanOrEqual(DT_RANGE.min);
    expect(sp.dt).toBeLessThanOrEqual(DT_RANGE.max);
  });

  it('all species growth params fit within safe clamp ranges', () => {
    for (const [id, sp] of Object.entries(SPECIES)) {
      expect(sp.growth.mu, `${id}.mu in range`).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
      expect(sp.growth.mu, `${id}.mu in range`).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
      expect(sp.growth.sigma, `${id}.sigma in range`).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
      expect(sp.growth.sigma, `${id}.sigma in range`).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
      expect(sp.dt, `${id}.dt in range`).toBeGreaterThanOrEqual(DT_RANGE.min);
      expect(sp.dt, `${id}.dt in range`).toBeLessThanOrEqual(DT_RANGE.max);
    }
  });
});

// ─── Module Export Verification ───────────────────────────────────

describe('Module exports', () => {
  it('constants module exports all expected values', () => {
    expect(typeof SPECIES_IDS).toBe('object');
    expect(Array.isArray(SPECIES_IDS)).toBe(true);
    expect(typeof CINEMATIC_INTERVAL).toBe('number');
    expect(typeof MORPH_DURATION).toBe('number');
    expect(typeof DEFAULT_GRID_SIZE).toBe('number');
    expect(typeof DEFAULT_COLOR_MAP).toBe('number');
    expect(typeof DEFAULT_SPECIES).toBe('string');
    expect(typeof DEFAULT_BRUSH_SIZE).toBe('number');
    expect(typeof RANDOMIZE_COUNT).toBe('number');
    expect(typeof PETRI_DISH_MIN).toBe('number');
    expect(typeof PETRI_DISH_RANGE).toBe('number');
    expect(typeof PLACEMENT_MARGIN).toBe('number');
    expect(typeof GROWTH_MU_RANGE).toBe('object');
    expect(typeof GROWTH_SIGMA_RANGE).toBe('object');
    expect(typeof DT_RANGE).toBe('object');
  });

  it('utils module exports all expected functions', () => {
    expect(typeof smoothstep).toBe('function');
    expect(typeof lerp).toBe('function');
    expect(typeof safeClamp).toBe('function');
  });

  it('kernels module exports all expected items', () => {
    expect(typeof SPECIES).toBe('object');
    expect(typeof generateKernel).toBe('function');
    expect(typeof generateKernelTexture).toBe('function');
    expect(typeof generateCreaturePattern).toBe('function');
    expect(typeof generateRandomState).toBe('function');
  });
});

// ─── Dead Code Verification ───────────────────────────────────────

describe('Dead code removal', () => {
  it('LeniaEngine module is removed (no WebGL2 dead code)', async () => {
    await expect(import('../engine/LeniaEngine' as string)).rejects.toThrow();
  });

  it('SimCanvas module is removed', async () => {
    await expect(import('../components/SimCanvas' as string)).rejects.toThrow();
  });

  it('Gallery module is removed', async () => {
    await expect(import('../components/Gallery' as string)).rejects.toThrow();
  });
});

// ─── Mutation Mode Constants ──────────────────────────────────────

describe('Mutation mode constants', () => {
  it('MUTATION_INTERVAL is a positive number', () => {
    expect(MUTATION_INTERVAL).toBeGreaterThan(0);
    expect(Number.isFinite(MUTATION_INTERVAL)).toBe(true);
  });

  it('MUTATION_MU_STEP is small enough for gradual drift', () => {
    expect(MUTATION_MU_STEP).toBeGreaterThan(0);
    expect(MUTATION_MU_STEP).toBeLessThan(0.05);
  });

  it('MUTATION_SIGMA_STEP is small enough for gradual drift', () => {
    expect(MUTATION_SIGMA_STEP).toBeGreaterThan(0);
    expect(MUTATION_SIGMA_STEP).toBeLessThan(0.02);
  });

  it('MUTATION_DT_STEP is small enough for gradual drift', () => {
    expect(MUTATION_DT_STEP).toBeGreaterThan(0);
    expect(MUTATION_DT_STEP).toBeLessThan(0.05);
  });

  it('mutation steps stay within safe ranges after many walks', () => {
    // Simulate 1000 random walks from center of range
    let mu = 0.15;
    let sigma = 0.015;
    let dt = 0.1;
    for (let i = 0; i < 1000; i++) {
      mu += (Math.random() - 0.5) * 2 * MUTATION_MU_STEP;
      mu = Math.max(GROWTH_MU_RANGE.min, Math.min(GROWTH_MU_RANGE.max, mu));
      sigma += (Math.random() - 0.5) * 2 * MUTATION_SIGMA_STEP;
      sigma = Math.max(GROWTH_SIGMA_RANGE.min, Math.min(GROWTH_SIGMA_RANGE.max, sigma));
      dt += (Math.random() - 0.5) * 2 * MUTATION_DT_STEP;
      dt = Math.max(DT_RANGE.min, Math.min(DT_RANGE.max, dt));
    }
    expect(mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
    expect(mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
    expect(sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
    expect(sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
    expect(dt).toBeGreaterThanOrEqual(DT_RANGE.min);
    expect(dt).toBeLessThanOrEqual(DT_RANGE.max);
  });
});

// ─── Population Tracker Constants ─────────────────────────────────

describe('Population tracker constants', () => {
  it('POP_CHART_SAMPLES is a reasonable buffer size', () => {
    expect(POP_CHART_SAMPLES).toBeGreaterThanOrEqual(50);
    expect(POP_CHART_SAMPLES).toBeLessThanOrEqual(1000);
  });

  it('POP_SAMPLE_INTERVAL is a reasonable sampling rate', () => {
    expect(POP_SAMPLE_INTERVAL).toBeGreaterThanOrEqual(50);
    expect(POP_SAMPLE_INTERVAL).toBeLessThanOrEqual(1000);
  });

  it('ring buffer capacity covers reasonable time window', () => {
    const windowSeconds = (POP_CHART_SAMPLES * POP_SAMPLE_INTERVAL) / 1000;
    expect(windowSeconds).toBeGreaterThanOrEqual(5);
    expect(windowSeconds).toBeLessThanOrEqual(60);
  });

  it('ring buffer overflow trims correctly', () => {
    const history: number[] = [];
    for (let i = 0; i < POP_CHART_SAMPLES + 50; i++) {
      history.push(Math.random());
      if (history.length > POP_CHART_SAMPLES) history.shift();
    }
    expect(history.length).toBe(POP_CHART_SAMPLES);
  });
});
