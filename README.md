# 🧬 Lenia Lab

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-138_passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Bundle](https://img.shields.io/badge/bundle-241KB_(74KB_gzip)-blue)]()

**Interactive continuous cellular automata simulator** inspired by [Lenia](https://chakazul.github.io/lenia.html) by Bert Wang-Chak Chan. Explore artificial life with GPU-accelerated WebGL rendering, 10 species, real-time drawing tools, mutation evolution, and cinematic autoplay.

🔗 **[Live Demo →](https://kai-claw.github.io/lenia-lab/)**

---

## ✨ Features

### Core Simulation
| Feature | Description |
|---------|-------------|
| **GPU-Accelerated** | Full WebGL 1.0 pipeline — convolution, growth, and display all run on the GPU |
| **10 Species** | Orbium, Geminium, Scutium, Gyrium, Pentium, Bubbles, Worms, Genesis, Amoeba, Coral |
| **Continuous CA** | True Lenia math — multi-peaked kernels with Gaussian growth functions |
| **Variable Speed** | 1×–10× simulation speed with sub-step accuracy |
| **Multiple Grids** | 128², 256², 512² resolution options |

### Visual Effects
| Feature | Description |
|---------|-------------|
| **6 Color Maps** | Viridis, Magma, Inferno, Plasma, Ocean, Neon |
| **Canvas Vignette** | Cinematic radial darkening for depth framing |
| **Title Shimmer** | Animated gradient sweep on header |
| **Micro-interactions** | Slider glow-on-drag, button springs, species card bounces, breathing indicators |

### Interactive
| Feature | Description |
|---------|-------------|
| **Draw Tool** | Paint life directly onto the canvas |
| **Erase Tool** | Selectively remove organisms |
| **Stamp Tool** | Place species creatures at click points |
| **Creature Gallery** | Visual catalog of all 10 species with descriptions and parameters |
| **Advanced Params** | Live-tunable dt, growth μ, and growth σ sliders |

### Experience Modes
| Feature | Description |
|---------|-------------|
| **🧫 Petri Dish** | Seeds 4–6 random species for emergent multi-species interactions |
| **🎬 Cinematic Autoplay** | Auto-tours all species with floating badge and progress bar |
| **🧬 Mutation Mode** | Growth params random-walk for live evolutionary dynamics |
| **📊 Population Chart** | Real-time sparkline showing average cell density via GPU readback |

### Performance
| Feature | Description |
|---------|-------------|
| **Pre-allocated Buffers** | GPU readback + RGBA upload buffers reused across frames |
| **Cached GL Locations** | Attribute locations cached per program — no per-draw queries |
| **Ring Buffer Charts** | O(1) insert population tracker, no array.shift() |
| **Sparse Density Sampling** | Samples every 4th pixel for readback accuracy within 5% |
| **Adaptive Monitor** | Auto-reduces speed at sustained <30fps, auto-recovers at >45fps |

---

## 🧬 Species

| Species | Emoji | Description | Growth μ | Growth σ | dt |
|---------|-------|-------------|----------|----------|----|
| Orbium | 🔵 | Classic Lenia glider — smooth orbiting creature | 0.15 | 0.015 | 0.1 |
| Geminium | ♊ | Self-replicating organism that splits into copies | 0.14 | 0.014 | 0.1 |
| Scutium | 🛡 | Shield-shaped stationary creature that pulses | 0.16 | 0.016 | 0.1 |
| Gyrium | 🌀 | Spinning creature with rotational movement | 0.152 | 0.0168 | 0.1 |
| Pentium | ⬡ | Five-fold symmetric lifeform, pentagonal shapes | 0.17 | 0.02 | 0.1 |
| Bubbles | 🫧 | Organic forms that merge and split with surface tension | 0.21 | 0.025 | 0.15 |
| Worms | 🐛 | Elongated slithering creatures | 0.13 | 0.013 | 0.08 |
| Genesis | ✨ | Wide growth window — ideal for exploration | 0.15 | 0.035 | 0.1 |
| Amoeba | 🦠 | Large squishy blobs that slowly morph | 0.18 | 0.030 | 0.12 |
| Coral | 🪸 | Dendritic branching structures from seed points | 0.22 | 0.018 | 0.1 |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Randomize — seed creatures |
| `C` | Clear canvas |
| `E` | Petri Dish — seed ecosystem |
| `A` | Cinematic autoplay |
| `M` | Mutation mode — evolving params |
| `P` | Population density chart |
| `H` | Toggle help overlay |

---

## 🏗️ Architecture

```
src/
├── App.tsx                 (666 lines)  Main app: state, effects, cinematic, mutation, pop chart
├── App.css                (1222 lines)  All styling: layout, animations, micro-interactions
├── constants.ts             (48 lines)  Named constants: intervals, ranges, defaults
├── utils.ts                 (22 lines)  Shared math: smoothstep, lerp, safeClamp
├── types.ts                 (29 lines)  TypeScript interfaces
├── species.ts              (179 lines)  Creature gallery: 4 param sets + init functions
├── gl/
│   ├── kernels.ts          (336 lines)  Kernel generation, species params, creature patterns
│   ├── renderer.ts         (471 lines)  WebGL renderer: convolution, growth, display, brush
│   └── shaders.ts          (287 lines)  GLSL shaders: step, display, brush, stamp
├── components/
│   ├── LeniaCanvas.tsx     (373 lines)  Canvas component: animation loop, input, imperative API
│   ├── Controls.tsx        (268 lines)  Sidebar control panel: species, tools, experience
│   ├── CreatureGallery.tsx  (67 lines)  Creature gallery overlay
│   └── ErrorBoundary.tsx    (52 lines)  WebGL crash recovery
└── __tests__/
    ├── kernels.test.ts     (207 lines)  Kernel generation, normalization, bounds
    ├── species.test.ts     (121 lines)  Species params, init functions, gallery
    ├── architecture.test.ts(437 lines)  Constants, utils, cross-module integration
    ├── bugs.test.ts        (180 lines)  Edge cases, NaN guards, stability
    └── stress.test.ts      (243 lines)  Large grid, high radius, bit ops, buffer reuse
```

**Total:** ~4,079 source LOC • 1,188 test LOC • 14 source files • 5 test files

---

## 🔧 Tech Stack

| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev/) | UI components + state management |
| [TypeScript 5.8](https://www.typescriptlang.org/) | Full strict mode, zero `any` casts |
| [Zustand](https://zustand-demo.pmnd.rs/) | Lightweight state store |
| [WebGL 1.0](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) | GPU-accelerated simulation + rendering |
| [Vite 7](https://vite.dev/) | Build tool + HMR |
| [Vitest](https://vitest.dev/) | 138 unit + integration tests |
| [GitHub Actions](https://github.com/features/actions) | CI/CD: typecheck → test → build → deploy |
| [GitHub Pages](https://pages.github.com/) | Static hosting |

---

## 🔬 Science Concepts

| Concept | Description |
|---------|-------------|
| **Continuous CA** | Unlike discrete Game of Life, Lenia uses continuous states (0–1) and continuous kernels |
| **Multi-peaked Kernels** | Ring-shaped convolution kernels with Gaussian peaks at configurable radii |
| **Growth Function** | Gaussian centered at μ with width σ determines cell state change from neighborhood potential |
| **Time Step (dt)** | Controls integration granularity — smaller dt = more precise but slower dynamics |
| **Emergent Life** | Complex behaviors (gliding, splitting, pulsing) emerge from simple local rules |
| **Artificial Life** | Lenia creatures exhibit properties analogous to biological organisms |

> Based on [*Lenia: Biology of Artificial Life*](https://arxiv.org/abs/2005.03742) by Bert Wang-Chak Chan

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

## 📊 Build Stats

| Metric | Value |
|--------|-------|
| Bundle (JS) | 241 KB (74 KB gzip) |
| Stylesheet | 20 KB (5 KB gzip) |
| Source LOC | ~4,079 |
| Test LOC | ~1,188 |
| Tests | 138 passing |
| Type Errors | 0 |
| Lint Errors | 0 |

---

## 📄 License

[MIT](LICENSE) — Lenia research by [Bert Wang-Chak Chan](https://chakazul.github.io/lenia.html)
