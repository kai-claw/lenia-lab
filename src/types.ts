export interface KernelRing {
  mu: number;
  sigma: number;
  weight: number;
}

export interface SpeciesParams {
  name: string;
  R: number;
  dt: number;
  rings: KernelRing[];
  growthMu: number;
  growthSigma: number;
}

export interface Creature {
  name: string;
  emoji: string;
  description: string;
  species: SpeciesParams;
  init: (x: number, y: number, w: number, h: number) => number;
}

export type ColormapName = 'viridis' | 'magma' | 'plasma' | 'inferno' | 'grayscale';

export const COLORMAP_NAMES: ColormapName[] = ['viridis', 'magma', 'plasma', 'inferno', 'grayscale'];

export const RESOLUTIONS = [256, 512] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
