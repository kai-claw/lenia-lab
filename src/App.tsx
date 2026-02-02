import { useState, useCallback, useRef, useEffect } from 'react';
import { LeniaCanvas, type LeniaCanvasHandle } from './components/LeniaCanvas';
import { Controls } from './components/Controls';
import { CreatureGallery } from './components/CreatureGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SPECIES, generateCreaturePattern, type SpeciesParams } from './gl/kernels';
import {
  SPECIES_IDS,
  CINEMATIC_INTERVAL,
  MORPH_DURATION,
  DEFAULT_GRID_SIZE,
  DEFAULT_COLOR_MAP,
  DEFAULT_SPECIES,
  DEFAULT_BRUSH_SIZE,
  RANDOMIZE_COUNT,
  PETRI_DISH_MIN,
  PETRI_DISH_RANGE,
  PLACEMENT_MARGIN,
  GROWTH_MU_RANGE,
  GROWTH_SIGMA_RANGE,
  DT_RANGE,
  MUTATION_INTERVAL,
  MUTATION_MU_STEP,
  MUTATION_SIGMA_STEP,
  MUTATION_DT_STEP,
  POP_CHART_SAMPLES,
  POP_SAMPLE_INTERVAL,
} from './constants';
import { smoothstep, lerp, safeClamp } from './utils';
import './App.css';

function App() {
  const canvasRef = useRef<LeniaCanvasHandle>(null);

  // Simulation state
  const [species, setSpecies] = useState<string>(DEFAULT_SPECIES);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [colorMap, setColorMap] = useState(DEFAULT_COLOR_MAP);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [tool, setTool] = useState<'draw' | 'erase' | 'stamp'>('draw');
  const [showGallery, setShowGallery] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fps, setFps] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [hasBooted, setHasBooted] = useState(false);

  // Cinematic autoplay state
  const [cinematic, setCinematic] = useState(false);
  const cinematicIdxRef = useRef(0);
  const [cinematicSpecies, setCinematicSpecies] = useState<string | null>(null);
  const [cinematicProgress, setCinematicProgress] = useState(0);
  const cinematicTimerRef = useRef(0);

  // Mutation mode state
  const [mutation, setMutation] = useState(false);

  // Population chart state — ring buffer (no array.shift())
  const [showPopChart, setShowPopChart] = useState(false);
  const popRingRef = useRef({ buf: new Float64Array(POP_CHART_SAMPLES), idx: 0, count: 0 });
  const popCanvasRef = useRef<HTMLCanvasElement>(null);

  // Performance monitor state
  const [perfWarning, setPerfWarning] = useState(false);
  const perfRef = useRef({ lowCount: 0, highCount: 0, degraded: false });

  // Advanced params (initialized from default species)
  const [dt, setDt] = useState(SPECIES[DEFAULT_SPECIES].dt);
  const [growthMu, setGrowthMu] = useState(SPECIES[DEFAULT_SPECIES].growth.mu);
  const [growthSigma, setGrowthSigma] = useState(SPECIES[DEFAULT_SPECIES].growth.sigma);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Morphing ref for smooth species transitions
  const morphRef = useRef<{ animId: number } | null>(null);

  const currentSpecies: SpeciesParams = SPECIES[species] || SPECIES[DEFAULT_SPECIES];

  // ── Auto-start: place Orbium at center and run on first load ──
  useEffect(() => {
    if (hasBooted) return;
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.clear();
        const pattern = generateCreaturePattern(DEFAULT_SPECIES, 64);
        canvasRef.current.stampCreature(pattern, 64, 0.5, 0.5);
        setIsRunning(true);
        setHasBooted(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [hasBooted]);

  const handleSpeciesChange = useCallback((id: string) => {
    const sp = SPECIES[id];
    if (!sp) return;
    setSpecies(id);

    // Cancel any in-progress morph
    if (morphRef.current) {
      cancelAnimationFrame(morphRef.current.animId);
      morphRef.current = null;
    }

    // Capture starting params for smooth morphing
    const startMu = growthMu;
    const startSigma = growthSigma;
    const startDt = dt;
    const targetMu = sp.growth.mu;
    const targetSigma = sp.growth.sigma;
    const targetDt = sp.dt;
    const startTime = performance.now();

    // Immediately update kernel (needs to change atomically)
    if (canvasRef.current) {
      canvasRef.current.setKernel(sp.kernel);
    }

    // Smoothly morph growth/dt params
    const morph = { animId: 0 };
    morphRef.current = morph;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const rawT = Math.min(1, elapsed / MORPH_DURATION);
      const t = smoothstep(rawT);

      const mu = lerp(startMu, targetMu, t);
      const sigma = lerp(startSigma, targetSigma, t);
      const d = lerp(startDt, targetDt, t);

      setGrowthMu(mu);
      setGrowthSigma(sigma);
      setDt(d);

      if (canvasRef.current) {
        canvasRef.current.setGrowth({ mu, sigma });
        canvasRef.current.setDt(d);
      }

      if (rawT < 1) {
        morph.animId = requestAnimationFrame(animate);
      } else {
        morphRef.current = null;
      }
    };

    morph.animId = requestAnimationFrame(animate);
  }, [growthMu, growthSigma, dt]);

  const handleRandomize = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clear();
      for (let i = 0; i < RANDOMIZE_COUNT; i++) {
        const pattern = generateCreaturePattern(species, 64);
        const uvX = PLACEMENT_MARGIN + Math.random() * (1 - 2 * PLACEMENT_MARGIN);
        const uvY = PLACEMENT_MARGIN + Math.random() * (1 - 2 * PLACEMENT_MARGIN);
        canvasRef.current.stampCreature(pattern, 64, uvX, uvY);
      }
      setStepCount(0);
      if (!isRunning) setIsRunning(true);
    }
  }, [species, isRunning]);

  const handleClear = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.clear();
      setStepCount(0);
    }
  }, []);

  const handleToggleRun = useCallback(() => {
    setIsRunning(r => !r);
  }, []);

  const handleToggleHelp = useCallback(() => {
    setShowHelp(h => !h);
  }, []);

  const handlePlaceCreature = useCallback((speciesId: string, x?: number, y?: number) => {
    if (canvasRef.current) {
      const pattern = generateCreaturePattern(speciesId, 64);
      const uvX = x ?? 0.5;
      const uvY = y ?? 0.5;
      canvasRef.current.stampCreature(pattern, 64, uvX, uvY);
    }
  }, []);

  // ── Petri Dish: populate canvas with multiple species ──
  const handlePetriDish = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.clear();
    setStepCount(0);

    const count = PETRI_DISH_MIN + Math.floor(Math.random() * PETRI_DISH_RANGE);
    const shuffled = [...SPECIES_IDS].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, count);

    // Use genesis params as base (wide growth window lets most things survive)
    const genesis = SPECIES.genesis;
    setSpecies('genesis');
    setDt(genesis.dt);
    setGrowthMu(genesis.growth.mu);
    setGrowthSigma(genesis.growth.sigma);
    if (canvasRef.current) {
      canvasRef.current.setKernel(genesis.kernel);
      canvasRef.current.setGrowth(genesis.growth);
      canvasRef.current.setDt(genesis.dt);
    }

    // Stamp creatures at random positions avoiding edges
    for (const id of picks) {
      const pattern = generateCreaturePattern(id, 64);
      const uvX = PLACEMENT_MARGIN + Math.random() * (1 - 2 * PLACEMENT_MARGIN);
      const uvY = PLACEMENT_MARGIN + Math.random() * (1 - 2 * PLACEMENT_MARGIN);
      canvasRef.current.stampCreature(pattern, 64, uvX, uvY);
    }

    if (!isRunning) setIsRunning(true);
  }, [isRunning]);

  // ── Cinematic Autoplay ──
  const handleCinematicToggle = useCallback(() => {
    setCinematic(prev => {
      if (!prev) {
        return true;
      }
      setCinematicSpecies(null);
      setCinematicProgress(0);
      return false;
    });
  }, []);

  // Cinematic autoplay effect
  useEffect(() => {
    if (!cinematic) return;

    const placeSpecies = () => {
      const idx = cinematicIdxRef.current % SPECIES_IDS.length;
      const id = SPECIES_IDS[idx];
      const sp = SPECIES[id];
      cinematicIdxRef.current = idx + 1;

      // Update species state
      setSpecies(id);
      setDt(sp.dt);
      setGrowthMu(sp.growth.mu);
      setGrowthSigma(sp.growth.sigma);
      setCinematicSpecies(id);
      setCinematicProgress(0);
      cinematicTimerRef.current = performance.now();

      if (canvasRef.current) {
        canvasRef.current.clear();
        canvasRef.current.setKernel(sp.kernel);
        canvasRef.current.setGrowth(sp.growth);
        canvasRef.current.setDt(sp.dt);

        // Place creature at center
        const pattern = generateCreaturePattern(id, 64);
        canvasRef.current.stampCreature(pattern, 64, 0.5, 0.5);
      }

      setStepCount(0);
      if (!isRunning) setIsRunning(true);
    };

    // Place first species immediately
    placeSpecies();

    const interval = setInterval(placeSpecies, CINEMATIC_INTERVAL);
    return () => clearInterval(interval);
  }, [cinematic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cinematic progress bar timer
  useEffect(() => {
    if (!cinematic) return;
    let animId = 0;
    const tick = () => {
      const elapsed = performance.now() - cinematicTimerRef.current;
      setCinematicProgress(Math.min(1, elapsed / CINEMATIC_INTERVAL));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [cinematic]);

  // ── Mutation Mode: random walk on growth params ──
  const handleMutationToggle = useCallback(() => {
    setMutation(prev => !prev);
  }, []);

  useEffect(() => {
    if (!mutation) return;

    const interval = setInterval(() => {
      setGrowthMu(prev => {
        const next = prev + (Math.random() - 0.5) * 2 * MUTATION_MU_STEP;
        const clamped = Math.max(GROWTH_MU_RANGE.min, Math.min(GROWTH_MU_RANGE.max, next));
        if (canvasRef.current) canvasRef.current.setGrowth({ mu: clamped, sigma: growthSigma });
        return clamped;
      });
      setGrowthSigma(prev => {
        const next = prev + (Math.random() - 0.5) * 2 * MUTATION_SIGMA_STEP;
        const clamped = Math.max(GROWTH_SIGMA_RANGE.min, Math.min(GROWTH_SIGMA_RANGE.max, next));
        if (canvasRef.current) canvasRef.current.setGrowth({ mu: growthMu, sigma: clamped });
        return clamped;
      });
      setDt(prev => {
        const next = prev + (Math.random() - 0.5) * 2 * MUTATION_DT_STEP;
        const clamped = Math.max(DT_RANGE.min, Math.min(DT_RANGE.max, next));
        if (canvasRef.current) canvasRef.current.setDt(clamped);
        return clamped;
      });
    }, MUTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [mutation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Population Tracker: sparkline chart ──
  const handlePopChartToggle = useCallback(() => {
    setShowPopChart(prev => {
      if (!prev) {
        // Reset ring buffer
        const ring = popRingRef.current;
        ring.buf.fill(0);
        ring.idx = 0;
        ring.count = 0;
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!showPopChart) return;

    const interval = setInterval(() => {
      if (!canvasRef.current) return;
      const density = canvasRef.current.readDensity();

      // Ring buffer insert (O(1) — no array.shift())
      const ring = popRingRef.current;
      ring.buf[ring.idx] = density;
      ring.idx = (ring.idx + 1) % POP_CHART_SAMPLES;
      ring.count = Math.min(ring.count + 1, POP_CHART_SAMPLES);

      // Draw sparkline
      const canvas = popCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const n = ring.count;
      ctx.clearRect(0, 0, w, h);

      if (n < 2) return;

      // Manual max (avoids Math.max(...spread) stack pressure)
      let max = 0.01;
      const startIdx = (ring.idx - n + POP_CHART_SAMPLES) % POP_CHART_SAMPLES;
      for (let i = 0; i < n; i++) {
        const v = ring.buf[(startIdx + i) % POP_CHART_SAMPLES];
        if (v > max) max = v;
      }

      // Fill area
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < n; i++) {
        const v = ring.buf[(startIdx + i) % POP_CHART_SAMPLES];
        const x = (i / (POP_CHART_SAMPLES - 1)) * w;
        const y = h - (v / max) * h * 0.9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(((n - 1) / (POP_CHART_SAMPLES - 1)) * w, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
      ctx.fill();

      // Line
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = ring.buf[(startIdx + i) % POP_CHART_SAMPLES];
        const x = (i / (POP_CHART_SAMPLES - 1)) * w;
        const y = h - (v / max) * h * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Current value label
      const current = ring.buf[(ring.idx - 1 + POP_CHART_SAMPLES) % POP_CHART_SAMPLES];
      ctx.fillStyle = '#00ff88';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${(current * 100).toFixed(1)}%`, w - 4, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.fillText('density', w - 4, 25);
    }, POP_SAMPLE_INTERVAL);

    return () => clearInterval(interval);
  }, [showPopChart]);

  // ── Performance Monitor: auto-degrade at sustained low FPS ──
  useEffect(() => {
    if (!isRunning) return;
    const perf = perfRef.current;

    const check = setInterval(() => {
      if (fps > 0 && fps < 30) {
        perf.lowCount++;
        perf.highCount = 0;
        if (perf.lowCount >= 3 && !perf.degraded) {
          // Auto-degrade: reduce speed to 1
          perf.degraded = true;
          setPerfWarning(true);
          setSpeed(prev => Math.min(prev, 1));
        }
      } else if (fps >= 45) {
        perf.highCount++;
        perf.lowCount = 0;
        if (perf.highCount >= 5 && perf.degraded) {
          perf.degraded = false;
          setPerfWarning(false);
        }
      } else {
        perf.lowCount = Math.max(0, perf.lowCount - 1);
      }
    }, 1000);

    return () => clearInterval(check);
  }, [isRunning, fps]);

  const handleGridResize = useCallback((size: number) => {
    setGridSize(size);
    if (canvasRef.current) {
      canvasRef.current.resize(size, size);
    }
    setStepCount(0);
  }, []);

  // Update advanced params
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.setGrowth({ mu: growthMu, sigma: growthSigma });
      canvasRef.current.setDt(dt);
    }
  }, [growthMu, growthSigma, dt]);

  // Validate growth params — clamp to safe ranges using shared utility
  const safeSetGrowthMu = useCallback((v: number) => {
    setGrowthMu(safeClamp(v, GROWTH_MU_RANGE.min, GROWTH_MU_RANGE.max, GROWTH_MU_RANGE.fallback));
  }, []);

  const safeSetGrowthSigma = useCallback((v: number) => {
    setGrowthSigma(safeClamp(v, GROWTH_SIGMA_RANGE.min, GROWTH_SIGMA_RANGE.max, GROWTH_SIGMA_RANGE.fallback));
  }, []);

  const safeSetDt = useCallback((v: number) => {
    setDt(safeClamp(v, DT_RANGE.min, DT_RANGE.max, DT_RANGE.fallback));
  }, []);

  return (
    <ErrorBoundary>
      <div className="app" role="application" aria-label="Lenia Lab — Continuous Artificial Life Simulator">
        <header className="app-header" role="banner">
          <div className="header-left">
            <h1>
              <span className="logo-icon">🧬</span>
              Lenia Lab
            </h1>
            <span className="subtitle">Continuous Artificial Life</span>
          </div>
          <div className="header-right">
            <span className={`stat ${isRunning ? 'stat-live' : ''}`} aria-label={`Step count: ${stepCount}`}>
              <span className={`heartbeat ${isRunning ? '' : 'heartbeat-off'}`} aria-hidden="true" />
              Step: {stepCount}
            </span>
            <span className={`stat ${fps < 20 ? 'stat-fps-bad' : fps < 40 ? 'stat-fps-warn' : ''}`} aria-label={`Frames per second: ${fps}`}>{fps} FPS</span>
            <span className="stat" aria-label={`Grid size: ${gridSize} by ${gridSize}`}>{gridSize}×{gridSize}</span>
            {perfWarning && (
              <span className="stat stat-perf-warn" aria-label="Performance warning — speed reduced" title="Auto-reduced speed for better performance">⚠️ Perf</span>
            )}
          </div>
        </header>

        <div className="main-layout">
          <aside className="sidebar" role="complementary" aria-label="Simulation controls">
            <Controls
              species={species}
              isRunning={isRunning}
              speed={speed}
              colorMap={colorMap}
              gridSize={gridSize}
              brushSize={brushSize}
              tool={tool}
              showAdvanced={showAdvanced}
              dt={dt}
              growthMu={growthMu}
              growthSigma={growthSigma}
              onSpeciesChange={handleSpeciesChange}
              onToggleRun={handleToggleRun}
              onStep={() => canvasRef.current?.singleStep()}
              onSpeedChange={setSpeed}
              onColorMapChange={setColorMap}
              onGridResize={handleGridResize}
              onBrushSizeChange={setBrushSize}
              onToolChange={setTool}
              onRandomize={handleRandomize}
              onClear={handleClear}
              onToggleGallery={() => setShowGallery(g => !g)}
              onToggleAdvanced={() => setShowAdvanced(a => !a)}
              onDtChange={safeSetDt}
              onGrowthMuChange={safeSetGrowthMu}
              onGrowthSigmaChange={safeSetGrowthSigma}
              onToggleHelp={handleToggleHelp}
              onPetriDish={handlePetriDish}
              cinematic={cinematic}
              onCinematicToggle={handleCinematicToggle}
              mutation={mutation}
              onMutationToggle={handleMutationToggle}
              showPopChart={showPopChart}
              onPopChartToggle={handlePopChartToggle}
            />
          </aside>

          <main className="canvas-area" role="main" aria-label="Simulation display">
            {/* Canvas vignette for cinematic depth */}
            <div className="canvas-vignette" aria-hidden="true" />

            {/* Cinematic species badge with progress */}
            {cinematic && cinematicSpecies && SPECIES[cinematicSpecies] && (
              <div className="cinematic-badge" aria-live="polite">
                <div className="cinematic-badge-indicator" />
                <div className="cinematic-badge-content">
                  <span className="cinematic-badge-name">{SPECIES[cinematicSpecies].name}</span>
                  <span className="cinematic-badge-desc">{SPECIES[cinematicSpecies].description}</span>
                  <div className="cinematic-progress-track">
                    <div
                      className="cinematic-progress-fill"
                      style={{ width: `${cinematicProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Mutation mode indicator */}
            {mutation && (
              <div className="mutation-badge" aria-live="polite">
                <span className="mutation-badge-icon">🧬</span>
                <span className="mutation-badge-text">Mutating</span>
                <span className="mutation-badge-params">
                  μ={growthMu.toFixed(4)} σ={growthSigma.toFixed(4)} dt={dt.toFixed(3)}
                </span>
              </div>
            )}

            {/* Population density chart */}
            {showPopChart && (
              <div className="pop-chart-container">
                <div className="pop-chart-title">📊 Population Density</div>
                <canvas
                  ref={popCanvasRef}
                  className="pop-chart-canvas"
                  width={260}
                  height={80}
                  aria-label="Population density chart"
                />
              </div>
            )}

            <LeniaCanvas
              ref={canvasRef}
              gridWidth={gridSize}
              gridHeight={gridSize}
              isRunning={isRunning}
              speed={speed}
              colorMap={colorMap}
              species={currentSpecies}
              brushSize={brushSize}
              tool={tool}
              onFpsUpdate={setFps}
              onStepUpdate={setStepCount}
              onToggleRun={handleToggleRun}
              onRandomize={handleRandomize}
              onClear={handleClear}
              onToggleHelp={handleToggleHelp}
              onPetriDish={handlePetriDish}
              onCinematicToggle={handleCinematicToggle}
              onMutationToggle={handleMutationToggle}
              onPopChartToggle={handlePopChartToggle}
            />

            {/* Instructions bar */}
            <div className="instructions-bar" aria-hidden="true">
              <span><kbd>Space</kbd> Play/Pause</span>
              <span><kbd>E</kbd> Petri Dish</span>
              <span><kbd>A</kbd> Cinematic</span>
              <span><kbd>M</kbd> Mutate</span>
              <span><kbd>P</kbd> Pop Chart</span>
              <span><kbd>H</kbd> Help</span>
            </div>

            {showGallery && (
              <CreatureGallery
                onSelect={(id) => {
                  handleSpeciesChange(id);
                  handlePlaceCreature(id);
                }}
                onPlace={handlePlaceCreature}
                onClose={() => setShowGallery(false)}
              />
            )}

            {showHelp && (
              <div className="help-overlay" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setShowHelp(false)}>
                <div className="help-panel" onClick={e => e.stopPropagation()}>
                  <div className="help-header">
                    <h2>⌨️ Keyboard Shortcuts</h2>
                    <button className="btn btn-close" onClick={() => setShowHelp(false)} aria-label="Close help">✕</button>
                  </div>
                  <div className="help-grid">
                    <div className="help-row"><kbd>Space</kbd><span>Play / Pause</span></div>
                    <div className="help-row"><kbd>R</kbd><span>Randomize — seed creatures</span></div>
                    <div className="help-row"><kbd>C</kbd><span>Clear</span></div>
                    <div className="help-row"><kbd>E</kbd><span>Petri Dish — seed ecosystem</span></div>
                    <div className="help-row"><kbd>A</kbd><span>Cinematic autoplay</span></div>
                    <div className="help-row"><kbd>M</kbd><span>Mutation mode — evolving params</span></div>
                    <div className="help-row"><kbd>P</kbd><span>Population density chart</span></div>
                    <div className="help-row"><kbd>H</kbd><span>Toggle this help</span></div>
                  </div>
                  <p className="help-hint">Click canvas to draw. Switch tools in the sidebar.</p>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="app-footer" role="contentinfo">
          <span>
            Lenia — a continuous generalization of Conway's Game of Life by Bert Wang-Chak Chan
          </span>
          <div className="footer-links">
            <span className="version-badge">v1.0.0</span>
            <button className="btn-link" onClick={handleToggleHelp} aria-label="Show keyboard shortcuts">
              Press <kbd>H</kbd> for shortcuts
            </button>
            <a href="https://github.com/c-goro" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
