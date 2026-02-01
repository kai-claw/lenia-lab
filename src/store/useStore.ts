import { create } from 'zustand';
import type { ColormapName, Resolution } from '../types.ts';
import { COLORMAP_NAMES } from '../types.ts';

interface SimState {
  // Simulation
  playing: boolean;
  dt: number;
  resolution: Resolution;
  generation: number;

  // Drawing
  brushSize: number;
  brushIntensity: number;
  eraser: boolean;

  // Visual
  colormapName: ColormapName;
  colormapIndex: number;
  showGrid: boolean;

  // UI panels
  showInfo: boolean;
  showGallery: boolean;

  // Species
  speciesIndex: number;

  // Actions
  togglePlay: () => void;
  setPlaying: (p: boolean) => void;
  setDt: (dt: number) => void;
  setResolution: (r: Resolution) => void;
  incrementGeneration: () => void;
  resetGeneration: () => void;

  setBrushSize: (s: number) => void;
  setBrushIntensity: (i: number) => void;
  toggleEraser: () => void;

  setColormap: (name: ColormapName) => void;
  toggleGrid: () => void;

  toggleInfo: () => void;
  toggleGallery: () => void;

  setSpecies: (idx: number) => void;
}

export const useSimStore = create<SimState>((set) => ({
  playing: false,
  dt: 0.1,
  resolution: 256,
  generation: 0,

  brushSize: 8,
  brushIntensity: 0.5,
  eraser: false,

  colormapName: 'viridis',
  colormapIndex: 0,
  showGrid: false,

  showInfo: false,
  showGallery: true,

  speciesIndex: 0,

  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaying: (p) => set({ playing: p }),
  setDt: (dt) => set({ dt }),
  setResolution: (resolution) => set({ resolution, generation: 0 }),
  incrementGeneration: () => set((s) => ({ generation: s.generation + 1 })),
  resetGeneration: () => set({ generation: 0 }),

  setBrushSize: (brushSize) => set({ brushSize }),
  setBrushIntensity: (brushIntensity) => set({ brushIntensity }),
  toggleEraser: () => set((s) => ({ eraser: !s.eraser })),

  setColormap: (name) => set({
    colormapName: name,
    colormapIndex: COLORMAP_NAMES.indexOf(name),
  }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  toggleInfo: () => set((s) => ({ showInfo: !s.showInfo })),
  toggleGallery: () => set((s) => ({ showGallery: !s.showGallery })),

  setSpecies: (idx) => set({ speciesIndex: idx }),
}));
