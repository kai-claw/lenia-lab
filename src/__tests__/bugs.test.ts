import { describe, it, expect } from 'vitest';
import { SPECIES, generateKernel, generateKernelTexture, generateCreaturePattern, generateRandomState } from '../gl/kernels';

describe('Black Hat — Edge cases & stability', () => {
  describe('NaN/Infinity guards in kernel generation', () => {
    it('kernel never produces NaN values', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        const kernel = generateKernel(sp.kernel);
        for (let i = 0; i < kernel.length; i++) {
          expect(isNaN(kernel[i]), `NaN at index ${i} for species ${id}`).toBe(false);
          expect(isFinite(kernel[i]), `Infinite at index ${i} for species ${id}`).toBe(true);
        }
      }
    });

    it('kernel texture RGBA never produces NaN', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        const { data } = generateKernelTexture(sp.kernel);
        for (let i = 0; i < data.length; i++) {
          expect(isNaN(data[i]), `NaN in RGBA at ${i} for ${id}`).toBe(false);
        }
      }
    });

    it('kernel with zero sigma does not produce NaN', () => {
      // Edge case: sigma=0 could cause division by zero in bell()
      const params = {
        radius: 5,
        peaks: [1],
        peakCenters: [0.5],
        peakWidths: [0], // zero sigma!
      };
      const kernel = generateKernel(params);
      for (let i = 0; i < kernel.length; i++) {
        expect(isNaN(kernel[i])).toBe(false);
      }
    });

    it('kernel with radius 1 (minimum) works', () => {
      const params = {
        radius: 1,
        peaks: [1],
        peakCenters: [0.5],
        peakWidths: [0.15],
      };
      const kernel = generateKernel(params);
      expect(kernel.length).toBe(9); // 3x3
      expect(kernel.some(v => v > 0)).toBe(true);
    });
  });

  describe('Random state generation edge cases', () => {
    it('never produces values outside [0, 1]', () => {
      for (let trial = 0; trial < 10; trial++) {
        const state = generateRandomState(64, 64, 0.5);
        for (let i = 0; i < state.length; i++) {
          expect(state[i]).toBeGreaterThanOrEqual(0);
          expect(state[i]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('handles extreme density values', () => {
      const state0 = generateRandomState(32, 32, 0);
      expect(state0.every(v => v >= 0 && v <= 1)).toBe(true);
      
      const state1 = generateRandomState(32, 32, 1.0);
      expect(state1.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('handles 1x1 grid', () => {
      const state = generateRandomState(1, 1, 0.5);
      expect(state.length).toBe(1);
      expect(state[0]).toBeGreaterThanOrEqual(0);
      expect(state[0]).toBeLessThanOrEqual(1);
    });

    it('handles very large grid without crash', () => {
      const state = generateRandomState(512, 512, 0.3);
      expect(state.length).toBe(512 * 512);
    });
  });

  describe('Creature pattern edge cases', () => {
    it('all species produce valid patterns', () => {
      for (const id of Object.keys(SPECIES)) {
        const pattern = generateCreaturePattern(id, 64);
        expect(pattern.length).toBe(64 * 64);
        for (let i = 0; i < pattern.length; i++) {
          expect(pattern[i]).toBeGreaterThanOrEqual(0);
          expect(pattern[i]).toBeLessThanOrEqual(1);
          expect(isNaN(pattern[i])).toBe(false);
        }
      }
    });

    it('unknown species falls back to generic pattern', () => {
      const pattern = generateCreaturePattern('nonexistent_species', 32);
      expect(pattern.length).toBe(32 * 32);
      expect(pattern.some(v => v > 0)).toBe(true); // not empty
    });

    it('minimum pattern size 1 works', () => {
      const pattern = generateCreaturePattern('orbium', 1);
      expect(pattern.length).toBe(1);
    });

    it('geminium pattern has two distinct blobs', () => {
      const pattern = generateCreaturePattern('geminium', 64);
      // Left half and right half should both have non-zero values
      let leftSum = 0, rightSum = 0;
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 32; x++) leftSum += pattern[y * 64 + x];
        for (let x = 32; x < 64; x++) rightSum += pattern[y * 64 + x];
      }
      expect(leftSum).toBeGreaterThan(0);
      expect(rightSum).toBeGreaterThan(0);
    });
  });

  describe('Growth parameter validation', () => {
    it('all species have positive sigma (no division by zero)', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        expect(sp.growth.sigma, `sigma for ${id}`).toBeGreaterThan(0);
      }
    });

    it('all species have mu in valid range (0, 1)', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        expect(sp.growth.mu, `mu for ${id}`).toBeGreaterThan(0);
        expect(sp.growth.mu, `mu for ${id}`).toBeLessThan(1);
      }
    });

    it('all species dt is positive and < 1', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        expect(sp.dt, `dt for ${id}`).toBeGreaterThan(0);
        expect(sp.dt, `dt for ${id}`).toBeLessThan(1);
      }
    });

    it('all species kernel radius is positive integer', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        expect(sp.kernel.radius, `radius for ${id}`).toBeGreaterThan(0);
        expect(Number.isInteger(sp.kernel.radius), `radius for ${id} is integer`).toBe(true);
      }
    });

    it('all species kernel peak arrays are same length', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        const n = sp.kernel.peaks.length;
        expect(sp.kernel.peakCenters.length, `peakCenters for ${id}`).toBe(n);
        expect(sp.kernel.peakWidths.length, `peakWidths for ${id}`).toBe(n);
      }
    });
  });

  describe('Species completeness', () => {
    it('all species have non-empty names', () => {
      for (const sp of Object.values(SPECIES)) {
        expect(sp.name.trim().length).toBeGreaterThan(0);
      }
    });

    it('all species have non-empty descriptions', () => {
      for (const sp of Object.values(SPECIES)) {
        expect(sp.description.trim().length).toBeGreaterThan(0);
      }
    });

    it('there are at least 10 species', () => {
      expect(Object.keys(SPECIES).length).toBeGreaterThanOrEqual(10);
    });

    it('species names are unique', () => {
      const names = Object.values(SPECIES).map(s => s.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
