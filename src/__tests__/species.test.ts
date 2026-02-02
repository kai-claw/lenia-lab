import { describe, it, expect } from 'vitest';
import { CREATURES, ORBIUM_PARAMS, GEMINIUM_PARAMS, SCUTIUM_PARAMS, HYDROGEMINIUM_PARAMS, generateRandom } from '../species';
import type { SpeciesParams } from '../types';

// ── Species Params ─────────────────────────────────────────────────

describe('species parameter sets', () => {
  const allParams: [string, SpeciesParams][] = [
    ['Orbium', ORBIUM_PARAMS],
    ['Geminium', GEMINIUM_PARAMS],
    ['Scutium', SCUTIUM_PARAMS],
    ['Hydrogeminium', HYDROGEMINIUM_PARAMS],
  ];

  for (const [name, params] of allParams) {
    describe(name, () => {
      it('has valid radius', () => {
        expect(params.R).toBeGreaterThan(0);
        expect(params.R).toBeLessThanOrEqual(20); // MAX_R in shader
      });

      it('has valid dt', () => {
        expect(params.dt).toBeGreaterThan(0);
        expect(params.dt).toBeLessThanOrEqual(0.5);
      });

      it('has at least one kernel ring', () => {
        expect(params.rings.length).toBeGreaterThan(0);
      });

      it('ring parameters are valid', () => {
        for (const ring of params.rings) {
          expect(ring.mu).toBeGreaterThanOrEqual(0);
          expect(ring.mu).toBeLessThanOrEqual(1);
          expect(ring.sigma).toBeGreaterThan(0);
          expect(ring.weight).toBeGreaterThan(0);
        }
      });

      it('growth params are valid', () => {
        expect(params.growthMu).toBeGreaterThan(0);
        expect(params.growthSigma).toBeGreaterThan(0);
      });
    });
  }
});

// ── Creatures Gallery ──────────────────────────────────────────────

describe('CREATURES array', () => {
  it('has at least 3 creatures', () => {
    expect(CREATURES.length).toBeGreaterThanOrEqual(3);
  });

  it('all creatures have required fields', () => {
    for (const creature of CREATURES) {
      expect(creature.name).toBeTruthy();
      expect(creature.emoji).toBeTruthy();
      expect(creature.description.length).toBeGreaterThan(10);
      expect(creature.species).toBeDefined();
      expect(typeof creature.init).toBe('function');
    }
  });

  it('creature names are unique', () => {
    const names = CREATURES.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('init functions produce values in [0, 1]', () => {
    for (const creature of CREATURES) {
      const w = 64, h = 64;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const v = creature.init(x, y, w, h);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('init functions produce non-trivial patterns', () => {
    for (const creature of CREATURES) {
      const w = 64, h = 64;
      let total = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          total += creature.init(x, y, w, h);
        }
      }
      expect(total).toBeGreaterThan(0);
    }
  });
});

// ── Random Generator ───────────────────────────────────────────────

describe('generateRandom', () => {
  it('returns values in [0, 1) range', () => {
    for (let y = 0; y < 64; y += 4) {
      for (let x = 0; x < 64; x += 4) {
        const v = generateRandom(x, y, 64, 64);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('returns 0 outside radius', () => {
    // Points far from center should be 0
    expect(generateRandom(0, 0, 256, 256)).toBe(0);
    expect(generateRandom(255, 255, 256, 256)).toBe(0);
  });

  it('has non-zero values near center', () => {
    const cx = 32, cy = 32;
    const v = generateRandom(cx, cy, 64, 64);
    expect(v).toBeGreaterThan(0);
  });
});
