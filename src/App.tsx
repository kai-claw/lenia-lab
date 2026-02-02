import { useState, useCallback, useRef, useEffect } from 'react';
import { LeniaCanvas, type LeniaCanvasHandle } from './components/LeniaCanvas';
import { Controls } from './components/Controls';
import { CreatureGallery } from './components/CreatureGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SPECIES, generateCreaturePattern, type SpeciesParams } from './gl/kernels';
import './App.css';

const SPECIES_IDS = Object.keys(SPECIES);
const CINEMATIC_INTERVAL = 10000; // 10s per species
const MORPH_DURATION = 800; // ms for smooth species morphing

/** Smoothstep interpolation */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Lerp a number */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function App() {
  const canvasRef = useRef<LeniaCanvasHandle>(null);

  // Simulation state
  const [species, setSpecies] = useState<string>('orbium');
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [colorMap, setColorMap] = useState(1); // Magma — visually striking default
  const [gridSize, setGridSize] = useState(256);
  const [brushSize, setBrushSize] = useState(0.03);
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

  // Advanced params
  const [dt, setDt] = useState(SPECIES.orbium.dt);
  const [growthMu, setGrowthMu] = useState(SPECIES.orbium.growth.mu);
  const [growthSigma, setGrowthSigma] = useState(SPECIES.orbium.growth.sigma);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Morphing ref for smooth species transitions
  const morphRef = useRef<{ animId: number } | null>(null);

  const currentSpecies: SpeciesParams = SPECIES[species] || SPECIES.orbium;

  // ── Auto-start: place Orbium at center and run on first load ──
  useEffect(() => {
    if (hasBooted) return;
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.clear();
        const pattern = generateCreaturePattern('orbium', 64);
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
      // Place 3 creatures of the current species at random positions
      canvasRef.current.clear();
      for (let i = 0; i < 3; i++) {
        const pattern = generateCreaturePattern(species, 64);
        const uvX = 0.2 + Math.random() * 0.6;
        const uvY = 0.2 + Math.random() * 0.6;
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

    // Pick 4-6 random species and place at random positions
    const count = 4 + Math.floor(Math.random() * 3);
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
      const uvX = 0.15 + Math.random() * 0.7;
      const uvY = 0.15 + Math.random() * 0.7;
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

  // Validate growth params — clamp to safe ranges
  const safeSetGrowthMu = useCallback((v: number) => {
    const clamped = Math.max(0.01, Math.min(0.5, isNaN(v) ? 0.15 : v));
    setGrowthMu(clamped);
  }, []);

  const safeSetGrowthSigma = useCallback((v: number) => {
    const clamped = Math.max(0.001, Math.min(0.1, isNaN(v) ? 0.015 : v));
    setGrowthSigma(clamped);
  }, []);

  const safeSetDt = useCallback((v: number) => {
    const clamped = Math.max(0.01, Math.min(0.5, isNaN(v) ? 0.1 : v));
    setDt(clamped);
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
            />

            {/* Instructions bar */}
            <div className="instructions-bar" aria-hidden="true">
              <span><kbd>Space</kbd> Play/Pause</span>
              <span><kbd>E</kbd> Petri Dish</span>
              <span><kbd>A</kbd> Cinematic</span>
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
