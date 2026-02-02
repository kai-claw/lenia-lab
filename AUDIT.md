# Lenia Lab — White Hat Audit Baseline

**Date:** 2025-07-26  
**Pass:** 1/10 (White Hat — Facts & Audit)

## Codebase Summary

| Metric | Value |
|--------|-------|
| Total LOC | 3,356 |
| Source files | 16 |
| Components | 5 (App, LeniaCanvas, Controls, CreatureGallery, SimCanvas/Gallery) |
| Test files | 2 |
| Tests | 50 |
| TS errors | 0 |
| Build size | 224.83 KB JS (69.37 KB gzip) + 6.57 KB CSS |
| Bundle total | ~231 KB (71 KB gzip) |

## Architecture

Two parallel rendering systems exist:

### Active System (WebGL1) — Used by App.tsx
- `gl/renderer.ts` — LeniaRenderer class (WebGL1, RGBA float textures)
- `gl/shaders.ts` — GLSL 1.0 shaders (update, display, brush, stamp)
- `gl/kernels.ts` — Kernel math, species definitions, creature patterns
- `components/LeniaCanvas.tsx` — Canvas component with imperative handle
- `components/Controls.tsx` — Control panel UI
- `components/CreatureGallery.tsx` — Creature selection overlay

### Inactive System (WebGL2) — Dead Code
- `engine/LeniaEngine.ts` — LeniaEngine class (WebGL2, R32F textures)
- `species.ts` — Duplicate species definitions (4 creatures vs 10 in active)
- `store/useStore.ts` — Zustand store (not used by active App)
- `components/SimCanvas.tsx` — Alternate canvas + global engine holder pattern
- `components/Gallery.tsx` — Alternate gallery component

**Note:** The WebGL2 engine is cleaner architecture but has fewer species and isn't wired to the app. The WebGL1 system is the live path.

## Species (Active System)

10 species defined: Orbium, Geminium, Scutium, Gyrium, Pentium, Bubbles, Worms, Genesis, Amoeba, Coral

## Features Present
- [x] GPU-accelerated simulation (WebGL)
- [x] 10 species presets
- [x] 6 color maps (Viridis, Magma, Inferno, Plasma, Ocean, Neon)
- [x] Drawing tools (draw/erase/stamp)
- [x] Creature gallery with descriptions
- [x] Adjustable parameters (dt, growth μ/σ)
- [x] Speed control (1-10x)
- [x] Grid resize (128/256/512)
- [x] Touch support
- [x] FPS counter

## Features Missing
- [ ] Keyboard shortcuts
- [ ] Help overlay
- [ ] ARIA accessibility (roles, labels, focus management)
- [ ] prefers-reduced-motion support
- [ ] Error boundary
- [ ] Mobile-responsive layout
- [ ] PWA manifest
- [ ] Performance monitoring/auto-degradation
- [ ] Cinematic autoplay
- [ ] Screenshot/export
- [ ] No animations or micro-interactions on UI elements

## Known Issues
1. **Dead code:** ~1,000 LOC of unused WebGL2 system
2. **No error boundary** — WebGL failures crash the app
3. **No keyboard navigation** — all interaction is mouse/touch only
4. **No ARIA** — canvas and controls lack accessibility attributes
5. **SimCanvas.tsx uses `window` global** — `(window as unknown as { __leniaEngine })` pattern
6. **State managed in App.tsx** — 12+ useState calls, could use Zustand store
7. **preserveDrawingBuffer: true** in WebGL1 renderer (perf cost)
