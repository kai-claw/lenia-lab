// ─── Lenia Kernel Generation ──────────────────────────────────────
// Kernels define how cells influence their neighbors.
// In Lenia, kernels are continuous ring-shaped or multi-peaked functions.

export interface KernelParams {
  radius: number;       // kernel radius in grid cells
  peaks: number[];      // beta values: heights of each ring peak
  peakCenters: number[]; // mu values: center of each ring (0-1 normalized)
  peakWidths: number[];  // sigma values: width of each ring peak
}

export interface GrowthParams {
  mu: number;    // growth function center
  sigma: number; // growth function width
}

export interface SpeciesParams {
  name: string;
  kernel: KernelParams;
  growth: GrowthParams;
  dt: number;     // time step
  description: string;
}

/**
 * Bell/Gaussian function
 */
function bell(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma;
  return Math.exp(-d * d / 2);
}

/**
 * Generate kernel values as a 2D array for a given kernel parameterization.
 * Returns a Float32Array of size (2R+1) x (2R+1) representing the kernel.
 */
export function generateKernel(params: KernelParams): Float32Array {
  const R = params.radius;
  const size = 2 * R + 1;
  const kernel = new Float32Array(size * size);
  
  let sum = 0;
  
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.sqrt(dx * dx + dy * dy) / R; // normalized distance [0, 1+]
      
      if (r > 1) {
        kernel[(dy + R) * size + (dx + R)] = 0;
        continue;
      }
      
      // Multi-peaked kernel: sum of bell functions at different radii
      let value = 0;
      for (let p = 0; p < params.peaks.length; p++) {
        const center = params.peakCenters[p];
        const width = params.peakWidths[p];
        const height = params.peaks[p];
        value += height * bell(r, center, width);
      }
      
      kernel[(dy + R) * size + (dx + R)] = value;
      sum += value;
    }
  }
  
  // Normalize kernel so it sums to 1
  if (sum > 0) {
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
  }
  
  return kernel;
}

/**
 * Generate kernel as a texture-ready RGBA array
 * Stores kernel weight in R channel
 */
export function generateKernelTexture(params: KernelParams): { data: Float32Array; size: number } {
  const R = params.radius;
  const size = 2 * R + 1;
  const kernel = generateKernel(params);
  const rgba = new Float32Array(size * size * 4);
  
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4 + 0] = kernel[i]; // R = weight
    rgba[i * 4 + 1] = kernel[i]; // G
    rgba[i * 4 + 2] = kernel[i]; // B
    rgba[i * 4 + 3] = 1.0;       // A
  }
  
  return { data: rgba, size };
}

// ─── Predefined species / kernel configurations ───────────────────

export const SPECIES: Record<string, SpeciesParams> = {
  orbium: {
    name: 'Orbium',
    description: 'A classic Lenia glider — smooth orbiting creature that moves steadily across the field',
    kernel: {
      radius: 13,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.15],
    },
    growth: { mu: 0.15, sigma: 0.015 },
    dt: 0.1,
  },

  geminium: {
    name: 'Geminium',
    description: 'Self-replicating organism that splits into two copies',
    kernel: {
      radius: 13,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.15],
    },
    growth: { mu: 0.14, sigma: 0.014 },
    dt: 0.1,
  },

  scutium: {
    name: 'Scutium',
    description: 'Shield-shaped stationary creature that pulses gently',
    kernel: {
      radius: 13,
      peaks: [1, 0.5],
      peakCenters: [0.35, 0.7],
      peakWidths: [0.12, 0.10],
    },
    growth: { mu: 0.16, sigma: 0.016 },
    dt: 0.1,
  },

  gyrium: {
    name: 'Gyrium',
    description: 'Spinning creature with rotational movement',
    kernel: {
      radius: 15,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.13],
    },
    growth: { mu: 0.152, sigma: 0.0168 },
    dt: 0.1,
  },

  pentium: {
    name: 'Pentium',
    description: 'Five-fold symmetric lifeform, forms pentagonal shapes',
    kernel: {
      radius: 13,
      peaks: [1, 0.8],
      peakCenters: [0.4, 0.7],
      peakWidths: [0.14, 0.10],
    },
    growth: { mu: 0.17, sigma: 0.02 },
    dt: 0.1,
  },

  bubbles: {
    name: 'Bubbles',
    description: 'Bubbly, organic forms that merge and split — narrow growth window creates surface-tension effects',
    kernel: {
      radius: 10,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.20],
    },
    growth: { mu: 0.21, sigma: 0.025 },
    dt: 0.15,
  },

  worms: {
    name: 'Worms',
    description: 'Worm-like elongated creatures that slither across the grid',
    kernel: {
      radius: 12,
      peaks: [1, 0.6],
      peakCenters: [0.3, 0.6],
      peakWidths: [0.10, 0.15],
    },
    growth: { mu: 0.13, sigma: 0.013 },
    dt: 0.08,
  },

  genesis: {
    name: 'Genesis',
    description: 'Wide growth window — lots of things survive. Great for exploring random initial conditions',
    kernel: {
      radius: 13,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.15],
    },
    growth: { mu: 0.15, sigma: 0.035 },
    dt: 0.1,
  },

  amoeba: {
    name: 'Amoeba',
    description: 'Large squishy blobs that slowly shift and morph, with broad smooth kernels',
    kernel: {
      radius: 18,
      peaks: [1],
      peakCenters: [0.5],
      peakWidths: [0.22],
    },
    growth: { mu: 0.18, sigma: 0.030 },
    dt: 0.12,
  },

  coral: {
    name: 'Coral',
    description: 'Branch-like structures that grow outward from initial seeds, forming complex dendritic patterns',
    kernel: {
      radius: 10,
      peaks: [1, 0.7, 0.3],
      peakCenters: [0.25, 0.5, 0.8],
      peakWidths: [0.08, 0.10, 0.06],
    },
    growth: { mu: 0.22, sigma: 0.018 },
    dt: 0.1,
  },
};

/**
 * Generate a creature pattern (initial state for known lifeforms)
 * Returns a Float32Array of size x size
 */
export function generateCreaturePattern(
  species: string,
  size: number = 64
): Float32Array {
  const pattern = new Float32Array(size * size);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 3;
  
  switch (species) {
    case 'orbium': {
      // Disk with smooth edges and a gradient
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy) / R;
          if (r < 1) {
            // Ring-like pattern
            pattern[y * size + x] = bell(r, 0.35, 0.18) * 0.9;
          }
        }
      }
      break;
    }
    case 'geminium': {
      // Two close blobs
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx1 = x - (cx - R * 0.3);
          const dy1 = y - cy;
          const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) / (R * 0.6);
          const dx2 = x - (cx + R * 0.3);
          const dy2 = y - cy;
          const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) / (R * 0.6);
          const v = Math.max(
            r1 < 1 ? bell(r1, 0.3, 0.2) * 0.8 : 0,
            r2 < 1 ? bell(r2, 0.3, 0.2) * 0.8 : 0
          );
          pattern[y * size + x] = v;
        }
      }
      break;
    }
    default: {
      // Generic blob with noise for other species
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy) / R;
          if (r < 1) {
            const base = bell(r, 0.3, 0.25);
            const noise = (Math.sin(x * 0.5) * Math.cos(y * 0.7) + 1) * 0.15;
            pattern[y * size + x] = Math.min(1, base * 0.8 + noise);
          }
        }
      }
    }
  }
  
  return pattern;
}

/**
 * Generate random initial state with organic blobs
 */
export function generateRandomState(width: number, height: number, density: number = 0.3): Float32Array {
  const state = new Float32Array(width * height);
  
  // Place several random blobs
  const numBlobs = 3 + Math.floor(Math.random() * 8);
  
  for (let b = 0; b < numBlobs; b++) {
    const bx = Math.random() * width;
    const by = Math.random() * height;
    const br = 8 + Math.random() * 20;
    const intensity = 0.3 + Math.random() * 0.7;
    
    for (let y = Math.max(0, Math.floor(by - br)); y < Math.min(height, Math.ceil(by + br)); y++) {
      for (let x = Math.max(0, Math.floor(bx - br)); x < Math.min(width, Math.ceil(bx + br)); x++) {
        const dx = x - bx;
        const dy = y - by;
        const r = Math.sqrt(dx * dx + dy * dy) / br;
        if (r < 1) {
          const v = bell(r, 0.3, 0.3) * intensity;
          state[y * width + x] = Math.min(1, state[y * width + x] + v);
        }
      }
    }
  }
  
  // Add some random noise
  for (let i = 0; i < state.length; i++) {
    if (state[i] > 0) {
      state[i] = Math.min(1, state[i] + (Math.random() - 0.5) * 0.1 * density);
      state[i] = Math.max(0, state[i]);
    }
  }
  
  return state;
}
