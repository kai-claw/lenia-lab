import { describe, it, expect } from 'vitest';
import { SPECIES, generateKernel, generateCreaturePattern, generateRandomState } from '../gl/kernels';
import { POP_CHART_SAMPLES, MUTATION_MU_STEP, MUTATION_SIGMA_STEP, MUTATION_DT_STEP, GROWTH_MU_RANGE, GROWTH_SIGMA_RANGE, DT_RANGE } from '../constants';

describe('Black Hat #2 — Stress Test & Performance', () => {
  describe('Ring buffer population chart', () => {
    it('ring buffer wrap-around produces correct ordering', () => {
      const buf = new Float64Array(POP_CHART_SAMPLES);
      let idx = 0;
      let count = 0;

      // Fill buffer beyond capacity (1.5x)
      const totalWrites = Math.floor(POP_CHART_SAMPLES * 1.5);
      for (let i = 0; i < totalWrites; i++) {
        buf[idx] = i;
        idx = (idx + 1) % POP_CHART_SAMPLES;
        count = Math.min(count + 1, POP_CHART_SAMPLES);
      }

      // Read back in order — should be last POP_CHART_SAMPLES values
      const startIdx = (idx - count + POP_CHART_SAMPLES) % POP_CHART_SAMPLES;
      const values: number[] = [];
      for (let i = 0; i < count; i++) {
        values.push(buf[(startIdx + i) % POP_CHART_SAMPLES]);
      }

      expect(values.length).toBe(POP_CHART_SAMPLES);
      // First value should be totalWrites - POP_CHART_SAMPLES
      expect(values[0]).toBe(totalWrites - POP_CHART_SAMPLES);
      // Last value should be totalWrites - 1
      expect(values[values.length - 1]).toBe(totalWrites - 1);
      // Values should be monotonically increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('ring buffer handles exact capacity fill', () => {
      const buf = new Float64Array(POP_CHART_SAMPLES);
      let idx = 0;
      let count = 0;
      for (let i = 0; i < POP_CHART_SAMPLES; i++) {
        buf[idx] = i * 0.01;
        idx = (idx + 1) % POP_CHART_SAMPLES;
        count = Math.min(count + 1, POP_CHART_SAMPLES);
      }
      expect(count).toBe(POP_CHART_SAMPLES);
      expect(idx).toBe(0); // wrapped around exactly
    });

    it('manual max avoids spread operator on large arrays', () => {
      // Simulate finding max without Math.max(...arr) — stack overflow risk
      const arr = new Float64Array(10000);
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.random();
      }
      arr[5000] = 999.0;

      let max = 0.01;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > max) max = arr[i];
      }
      expect(max).toBe(999.0);
    });
  });

  describe('Mutation random walk bounds safety', () => {
    it('mu stays in range after 10000 random walk steps', () => {
      let mu = 0.15;
      for (let i = 0; i < 10000; i++) {
        mu += (Math.random() - 0.5) * 2 * MUTATION_MU_STEP;
        mu = Math.max(GROWTH_MU_RANGE.min, Math.min(GROWTH_MU_RANGE.max, mu));
      }
      expect(mu).toBeGreaterThanOrEqual(GROWTH_MU_RANGE.min);
      expect(mu).toBeLessThanOrEqual(GROWTH_MU_RANGE.max);
    });

    it('sigma stays in range after 10000 random walk steps', () => {
      let sigma = 0.015;
      for (let i = 0; i < 10000; i++) {
        sigma += (Math.random() - 0.5) * 2 * MUTATION_SIGMA_STEP;
        sigma = Math.max(GROWTH_SIGMA_RANGE.min, Math.min(GROWTH_SIGMA_RANGE.max, sigma));
      }
      expect(sigma).toBeGreaterThanOrEqual(GROWTH_SIGMA_RANGE.min);
      expect(sigma).toBeLessThanOrEqual(GROWTH_SIGMA_RANGE.max);
    });

    it('dt stays in range after 10000 random walk steps', () => {
      let dt = 0.1;
      for (let i = 0; i < 10000; i++) {
        dt += (Math.random() - 0.5) * 2 * MUTATION_DT_STEP;
        dt = Math.max(DT_RANGE.min, Math.min(DT_RANGE.max, dt));
      }
      expect(dt).toBeGreaterThanOrEqual(DT_RANGE.min);
      expect(dt).toBeLessThanOrEqual(DT_RANGE.max);
    });
  });

  describe('Large dataset stability', () => {
    it('512x512 random state generates without issues', () => {
      const state = generateRandomState(512, 512, 0.5);
      expect(state.length).toBe(512 * 512);
      for (let i = 0; i < state.length; i++) {
        expect(state[i]).toBeGreaterThanOrEqual(0);
        expect(state[i]).toBeLessThanOrEqual(1);
        expect(isFinite(state[i])).toBe(true);
      }
    });

    it('all species kernel generation at radius 20 (stress)', () => {
      for (const [id, sp] of Object.entries(SPECIES)) {
        const stressParams = { ...sp.kernel, radius: 20 };
        const kernel = generateKernel(stressParams);
        const size = 2 * 20 + 1;
        expect(kernel.length).toBe(size * size);

        let sum = 0;
        let hasNaN = false;
        for (let i = 0; i < kernel.length; i++) {
          if (isNaN(kernel[i]) || !isFinite(kernel[i])) hasNaN = true;
          sum += kernel[i];
        }
        expect(hasNaN).toBe(false);
        // Normalized — should sum to ~1
        expect(sum).toBeCloseTo(1.0, 1);
      }
    });

    it('pattern generation for all species at size 128 (stress)', () => {
      for (const id of Object.keys(SPECIES)) {
        const pattern = generateCreaturePattern(id, 128);
        expect(pattern.length).toBe(128 * 128);
        let hasValue = false;
        for (let i = 0; i < pattern.length; i++) {
          expect(pattern[i]).toBeGreaterThanOrEqual(0);
          expect(pattern[i]).toBeLessThanOrEqual(1);
          if (pattern[i] > 0) hasValue = true;
        }
        expect(hasValue).toBe(true);
      }
    });
  });

  describe('RGBA buffer expansion correctness', () => {
    it('RGBA expansion via bit shift matches multiplication', () => {
      const total = 256 * 256;
      const data = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        data[i] = Math.random();
      }

      const rgba = new Float32Array(total * 4);
      for (let i = 0; i < total; i++) {
        const v = data[i];
        const idx = i << 2;
        rgba[idx] = v;
        rgba[idx + 1] = v;
        rgba[idx + 2] = v;
        rgba[idx + 3] = 1;
      }

      // Verify against i * 4
      for (let i = 0; i < total; i++) {
        expect(rgba[i * 4]).toBe(data[i]);
        expect(rgba[i * 4 + 1]).toBe(data[i]);
        expect(rgba[i * 4 + 2]).toBe(data[i]);
        expect(rgba[i * 4 + 3]).toBe(1);
      }
    });
  });

  describe('Sparse sampling accuracy', () => {
    it('stride-4 sampling approximates full average within 5%', () => {
      const total = 256 * 256;
      const data = new Float32Array(total);
      // Create realistic density distribution (clusters + empty)
      for (let i = 0; i < total; i++) {
        data[i] = Math.random() < 0.3 ? Math.random() * 0.8 : 0;
      }

      // Full average
      let fullSum = 0;
      for (let i = 0; i < total; i++) fullSum += data[i];
      const fullAvg = fullSum / total;

      // Stride-4 average
      const stride = 4;
      let sparseSum = 0;
      let count = 0;
      for (let i = 0; i < total; i += stride) {
        sparseSum += data[i];
        count++;
      }
      const sparseAvg = count > 0 ? sparseSum / count : 0;

      // Should be within 5% relative error
      const relError = Math.abs(sparseAvg - fullAvg) / Math.max(fullAvg, 0.001);
      expect(relError).toBeLessThan(0.05);
    });
  });

  describe('Pre-allocated buffer reuse pattern', () => {
    it('Float32Array pre-allocation pattern works correctly', () => {
      // Simulate the renderer pattern: alloc once, fill many times
      const gridW = 256, gridH = 256;
      const buf = new Float32Array(gridW * gridH * 4);

      // Fill with data set 1
      for (let i = 0; i < gridW * gridH; i++) {
        const v = i / (gridW * gridH);
        buf[i << 2] = v;
      }
      expect(buf[0]).toBe(0);
      expect(buf[(gridW * gridH - 1) << 2]).toBeCloseTo(1 - 1 / (gridW * gridH), 5);

      // Fill with data set 2 — should completely overwrite
      for (let i = 0; i < gridW * gridH; i++) {
        buf[i << 2] = 0.5;
      }
      expect(buf[0]).toBe(0.5);
      expect(buf[100 << 2]).toBe(0.5);
    });
  });

  describe('Performance constants validation', () => {
    it('POP_CHART_SAMPLES is reasonable size', () => {
      expect(POP_CHART_SAMPLES).toBeGreaterThanOrEqual(50);
      expect(POP_CHART_SAMPLES).toBeLessThanOrEqual(1000);
    });

    it('mutation step sizes are small enough for gradual drift', () => {
      expect(MUTATION_MU_STEP).toBeLessThan(0.05);
      expect(MUTATION_SIGMA_STEP).toBeLessThan(0.05);
      expect(MUTATION_DT_STEP).toBeLessThan(0.05);
    });

    it('growth ranges allow meaningful parameter space', () => {
      expect(GROWTH_MU_RANGE.max - GROWTH_MU_RANGE.min).toBeGreaterThan(0.1);
      expect(GROWTH_SIGMA_RANGE.max - GROWTH_SIGMA_RANGE.min).toBeGreaterThan(0.01);
      expect(DT_RANGE.max - DT_RANGE.min).toBeGreaterThan(0.1);
    });
  });
});
