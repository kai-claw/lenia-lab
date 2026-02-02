# 🧬 Lenia Lab

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-138_passing-brightgreen)](./src/__tests__)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Bundle](https://img.shields.io/badge/bundle-241KB_(74KB_gzip)-purple)]()

**Interactive continuous cellular automata simulator inspired by [Lenia](https://arxiv.org/abs/1812.05433).** Explore artificial life with GPU-accelerated WebGL, 10 species, real-time drawing tools, and beautiful color maps.

> 🔗 **[Live Demo →](https://kai-claw.github.io/lenia-lab/)**

---

## ✨ Features

### Core Simulation
| Feature | Description |
|---------|-------------|
| **GPU-Accelerated** | Full WebGL 1.0 pipeline — kernel convolution + growth function on GPU |
| **10 Species** | Orbium, Geminium, Scutium, Hydrogeminium, Gyrium, Pentium, Bubbles, Worms, Genesis, Amoeba, Coral |
| **Smooth Morphing** | Switching species lerps growth/dt params over 800ms via smoothstep |
| **Adjustable Params** | Real-time mu, sigma, dt sliders with NaN-safe clamping |
| **Multi-ring Kernels** | Species with complex kernel structures (Scutium, Hydrogeminium) |

### Visual & Interactive
| Feature | Description |
|---------|-------------|
| **6 Color Maps** | Viridis, Magma, Inferno, Plasma, Cividis, Grayscale |
| **Drawing Tools** | Draw, Erase, Stamp — paint life directly on the canvas |
| **Petri Dish Mode** | Seeds 4-6 random species simultaneously for multi-species interactions |
| **Cinematic Autoplay** | Auto-tours all 10 species with floating badge and progress bar |
| **Mutation Mode** | Growth params random-walk for emergent evolutionary dynamics |
| **Population Chart** | Real-time sparkline of average cell density (10Hz sampling) |

### Performance & Polish
| Feature | Description |
|---------|-------------|
| **Adaptive Monitor** | Auto-degrades speed at <30fps, auto-recovers at >45fps |
| **Pre-allocated Buffers** | Zero per-frame GC in GPU readback, RGBA upload, density sampling |
| **Cached GL Lookups** | Attribute locations cached per program |
| **Ring Buffer Charts** | O(1) insert population tracking |
| **Canvas Vignette** | Cinematic depth framing overlay |
| **Micro-interactions** | Slider glow, button springs, panel blur-dissolve, heartbeat indicator |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Randomize (seeds 3 creatures) |
| `C` | Clear canvas |
| `H` | Toggle help overlay |
| `E` | Petri Dish mode |
| `A` | Cinematic autoplay |
| `M` | Mutation mode |
| `P` | Population density chart |

---

## 🏗️ Architecture

```
src/
├── App.tsx                 (666 lines)  Main app — state, layout, cinematic, mutation
├── App.css                              Styles + animations
├── constants.ts            (48 lines)   Named constants (intervals, ranges, defaults)
├── utils.ts                (22 lines)   smoothstep, lerp, safeClamp
├── types.ts                (29 lines)   Creature, SpeciesParams, Ring interfaces
├── species.ts              (179 lines)  10 species definitions + pattern generators
├── gl/
│   ├── kernels.ts          (336 lines)  Kernel generation, RGBA textures, SPECIES map
│   ├── renderer.ts         (471 lines)  WebGL renderer — init, step, draw, readback
│   └── shaders.ts          (287 lines)  GLSL vertex/fragment shaders
├── components/
│   ├── LeniaCanvas.tsx     (373 lines)  Canvas + interaction + keyboard + animation loop
│   ├── Controls.tsx        (268 lines)  Sidebar — species, tools, params, experiences
│   ├── CreatureGallery.tsx (67 lines)   Modal gallery of all species
│   └── ErrorBoundary.tsx   (52 lines)   WebGL crash recovery
├── store/
│   └── useStore.ts         (90 lines)   Zustand state management
└── __tests__/              (1188 lines) 138 tests across 5 test files
```

---

## 🧪 Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React 19 + TypeScript 5.8 |
| **Build** | Vite 7 |
| **GPU** | WebGL 1.0 (kernel convolution + growth shaders) |
| **State** | Zustand |
| **Tests** | Vitest (138 tests) |
| **CI/CD** | GitHub Actions → GitHub Pages |
| **Styles** | CSS with animations + prefers-reduced-motion |

---

## 🔬 Lenia Concepts

| Concept | Description |
|---------|-------------|
| **Continuous CA** | Unlike Conway's Game of Life, Lenia uses continuous states (0–1) and continuous kernels |
| **Growth Function** | Gaussian growth centered at `mu` with width `sigma` — controls what neighborhood density supports life |
| **Kernel Rings** | Radial distance weights — multi-ring kernels create complex species behaviors |
| **Time Step (dt)** | Controls update granularity — smaller dt = smoother but slower evolution |
| **Orbium** | The "hello world" of Lenia — a gliding circular creature |
| **Geminium** | A species that splits into two mirrored organisms |

---

## 🚀 Getting Started

```bash
# Clone
git clone https://github.com/kai-claw/lenia-lab.git
cd lenia-lab

# Install
npm install

# Dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Deploy to GitHub Pages
npm run deploy
```

---

## 📊 Bundle Stats

| Metric | Value |
|--------|-------|
| **JS Bundle** | 241 KB (74 KB gzip) |
| **CSS** | 20 KB (5 KB gzip) |
| **Source Files** | 14 |
| **Lines of Code** | ~2,900 |
| **Tests** | 138 (5 test files) |
| **Build Time** | ~500ms |

---

## 📄 License

[MIT](./LICENSE) — built by [kai-claw](https://github.com/kai-claw)
