import { describe, it, expect } from 'vitest';
import { generateKernel, generateKernelTexture, SPECIES, generateRandomState, generateCreaturePattern } from '../gl/kernels';

// ── Kernel Generation ──────────────────────────────────────────────

describe('generateKernel', () => {
  it('returns Float32Array of correct size', () => {
    const k = generateKernel({ radius: 5, peaks: [1], peakCenters: [0.5], peakWidths: [0.15] });
    expect(k).toBeInstanceOf(Float32Array);
    expect(k.length).toBe(11 * 11); // (2*5+1)^2
  });

  it('kernel sums to ~1 (normalized)', () => {
    const k = generateKernel({ radius: 13, peaks: [1], peakCenters: [0.5], peakWidths: [0.15] });
    let sum = 0;
    for (let i = 0; i < k.length; i++) sum += k[i];
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('kernel values are non-negative', () => {
    const k = generateKernel({ radius: 10, peaks: [1, 0.5], peakCenters: [0.3, 0.7], peakWidths: [0.1, 0.12] });
    for (let i = 0; i < k.length; i++) {
      expect(k[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('zero outside radius circle', () => {
    const R = 8;
    const k = generateKernel({ radius: R, peaks: [1], peakCenters: [0.5], peakWidths: [0.15] });
    const size = 2 * R + 1;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const ox = dx - R;
        const oy = dy - R;
        const dist = Math.sqrt(ox * ox + oy * oy);
        if (dist > R + 0.5) {
          expect(k[dy * size + dx]).toBe(0);
        }
      }
    }
  });

  it('multi-peaked kernel has values at both peak centers', () => {
    const R = 13;
    const k = generateKernel({ radius: R, peaks: [1, 0.8], peakCenters: [0.35, 0.7], peakWidths: [0.12, 0.1] });
    const size = 2 * R + 1;
    // Sample along positive x-axis where dy=0
    const innerIdx = Math.round(0.35 * R); // inner peak
    const outerIdx = Math.round(0.7 * R);  // outer peak
    const cy = R;
    expect(k[cy * size + (R + innerIdx)]).toBeGreaterThan(0);
    expect(k[cy * size + (R + outerIdx)]).toBeGreaterThan(0);
  });

  it('handles small kernel (R=1)', () => {
    const k = generateKernel({ radius: 1, peaks: [1], peakCenters: [0.5], peakWidths: [0.3] });
    expect(k.length).toBe(9); // 3x3
    let sum = 0;
    for (let i = 0; i < k.length; i++) sum += k[i];
    expect(sum).toBeCloseTo(1.0, 3);
  });
});

describe('generateKernelTexture', () => {
  it('returns RGBA data with correct size', () => {
    const { data, size } = generateKernelTexture({ radius: 5, peaks: [1], peakCenters: [0.5], peakWidths: [0.15] });
    expect(size).toBe(11);
    expect(data.length).toBe(11 * 11 * 4); // RGBA
  });

  it('R channel matches kernel values', () => {
    const params = { radius: 5, peaks: [1], peakCenters: [0.5], peakWidths: [0.15] };
    const kernel = generateKernel(params);
    const { data } = generateKernelTexture(params);
    for (let i = 0; i < kernel.length; i++) {
      expect(data[i * 4]).toBeCloseTo(kernel[i], 6);
    }
  });

  it('alpha channel is always 1', () => {
    const { data, size } = generateKernelTexture({ radius: 3, peaks: [1], peakCenters: [0.5], peakWidths: [0.2] });
    for (let i = 0; i < size * size; i++) {
      expect(data[i * 4 + 3]).toBe(1.0);
    }
  });
});

// ── Species Definitions ────────────────────────────────────────────

describe('SPECIES presets', () => {
  const speciesIds = Object.keys(SPECIES);

  it('has at least 5 species', () => {
    expect(speciesIds.length).toBeGreaterThanOrEqual(5);
  });

  it('all species have required fields', () => {
    for (const id of speciesIds) {
      const sp = SPECIES[id];
      expect(sp.name).toBeTruthy();
      expect(sp.description).toBeTruthy();
      expect(sp.kernel).toBeDefined();
      expect(sp.kernel.radius).toBeGreaterThan(0);
      expect(sp.kernel.peaks.length).toBeGreaterThan(0);
      expect(sp.kernel.peakCenters.length).toBe(sp.kernel.peaks.length);
      expect(sp.kernel.peakWidths.length).toBe(sp.kernel.peaks.length);
      expect(sp.growth.mu).toBeGreaterThan(0);
      expect(sp.growth.sigma).toBeGreaterThan(0);
      expect(sp.dt).toBeGreaterThan(0);
      expect(sp.dt).toBeLessThanOrEqual(0.5);
    }
  });

  it('all species produce normalized kernels', () => {
    for (const id of speciesIds) {
      const k = generateKernel(SPECIES[id].kernel);
      let sum = 0;
      for (let i = 0; i < k.length; i++) sum += k[i];
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it('species names are unique', () => {
    const names = speciesIds.map(id => SPECIES[id].name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('kernel peaks are in [0, 1] range', () => {
    for (const id of speciesIds) {
      const sp = SPECIES[id];
      for (const center of sp.kernel.peakCenters) {
        expect(center).toBeGreaterThanOrEqual(0);
        expect(center).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ── Random State & Creature Patterns ───────────────────────────────

describe('generateRandomState', () => {
  it('returns correct size', () => {
    const state = generateRandomState(64, 64);
    expect(state.length).toBe(64 * 64);
  });

  it('values in [0, 1] range', () => {
    const state = generateRandomState(128, 128, 0.5);
    for (let i = 0; i < state.length; i++) {
      expect(state[i]).toBeGreaterThanOrEqual(0);
      expect(state[i]).toBeLessThanOrEqual(1);
    }
  });

  it('is not entirely zero', () => {
    const state = generateRandomState(64, 64, 0.5);
    let total = 0;
    for (let i = 0; i < state.length; i++) total += state[i];
    expect(total).toBeGreaterThan(0);
  });
});

describe('generateCreaturePattern', () => {
  it('returns correct size', () => {
    const p = generateCreaturePattern('orbium', 64);
    expect(p.length).toBe(64 * 64);
  });

  it('orbium values in [0, 1]', () => {
    const p = generateCreaturePattern('orbium', 64);
    for (let i = 0; i < p.length; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThanOrEqual(1);
    }
  });

  it('geminium values in [0, 1]', () => {
    const p = generateCreaturePattern('geminium', 64);
    for (let i = 0; i < p.length; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThanOrEqual(1);
    }
  });

  it('default species values in [0, 1]', () => {
    const p = generateCreaturePattern('unknown_species', 64);
    for (let i = 0; i < p.length; i++) {
      expect(p[i]).toBeGreaterThanOrEqual(0);
      expect(p[i]).toBeLessThanOrEqual(1);
    }
  });

  it('orbium pattern has non-zero center mass', () => {
    const size = 64;
    const p = generateCreaturePattern('orbium', size);
    // Check center region has content
    let centerMass = 0;
    const mid = size / 2;
    const range = 10;
    for (let y = mid - range; y < mid + range; y++) {
      for (let x = mid - range; x < mid + range; x++) {
        centerMass += p[y * size + x];
      }
    }
    expect(centerMass).toBeGreaterThan(0);
  });
});
