import { useState, useCallback, useRef, useEffect } from 'react';
import { LeniaCanvas, type LeniaCanvasHandle } from './components/LeniaCanvas';
import { Controls } from './components/Controls';
import { CreatureGallery } from './components/CreatureGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SPECIES, generateRandomState, generateCreaturePattern, type SpeciesParams } from './gl/kernels';
import './App.css';

const SPECIES_IDS = Object.keys(SPECIES);
const CINEMATIC_INTERVAL = 10000; // 10s per species

function App() {
  const canvasRef = useRef<LeniaCanvasHandle>(null);
  
  // Simulation state
  const [species, setSpecies] = useState<string>('orbium');
  const [isRunning, setIsRunning] = useState(true);  // Auto-start for instant wow
  const [speed, setSpeed] = useState(1);
  const [colorMap, setColorMap] = useState(1);  // Magma — most striking first impression
  const [gridSize, setGridSize] = useState(256);
  const [brushSize, setBrushSize] = useState(0.03);
  const [tool, setTool] = useState<'draw' | 'erase' | 'stamp'>('draw');
  const [showGallery, setShowGallery] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fps, setFps] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  
  // Cinematic autoplay state
  const [cinematic, setCinematic] = useState(false);
  const cinematicIdxRef = useRef(0);
  const [cinematicSpecies, setCinematicSpecies] = useState<string | null>(null);
  
  // Advanced params
  const [dt, setDt] = useState(SPECIES.orbium.dt);
  const [growthMu, setGrowthMu] = useState(SPECIES.orbium.growth.mu);
  const [growthSigma, setGrowthSigma] = useState(SPECIES.orbium.growth.sigma);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentSpecies: SpeciesParams = SPECIES[species] || SPECIES.orbium;

  const handleSpeciesChange = useCallback((id: string) => {
    const sp = SPECIES[id];
    if (!sp) return;
    setSpecies(id);
    setDt(sp.dt);
    setGrowthMu(sp.growth.mu);
    setGrowthSigma(sp.growth.sigma);
    
    if (canvasRef.current) {
      canvasRef.current.setKernel(sp.kernel);
      canvasRef.current.setGrowth(sp.growth);
      canvasRef.current.setDt(sp.dt);
    }
  }, []);

  const handleRandomize = useCallback(() => {
    if (canvasRef.current) {
      const state = generateRandomState(gridSize, gridSize, 0.5);
      canvasRef.current.setState(state);
      setStepCount(0);
    }
  }, [gridSize]);

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
        // Starting cinematic — begin from current index
        return true;
      }
      setCinematicSpecies(null);
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
            <span className="stat" aria-label={`Step count: ${stepCount}`}>Step: {stepCount}</span>
            <span className="stat" aria-label={`Frames per second: ${fps}`}>{fps} FPS</span>
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
            {/* Cinematic species badge */}
            {cinematic && cinematicSpecies && SPECIES[cinematicSpecies] && (
              <div className="cinematic-badge" aria-live="polite" key={cinematicSpecies}>
                <div className="cinematic-badge-indicator" />
                <div className="cinematic-badge-content">
                  <span className="cinematic-badge-name">{SPECIES[cinematicSpecies].name}</span>
                  <span className="cinematic-badge-desc">{SPECIES[cinematicSpecies].description}</span>
                </div>
                <div className="cinematic-badge-progress">
                  <div className="cinematic-badge-progress-fill" />
                </div>
              </div>
            )}
            {/* Instructions bar */}
            {!cinematic && (
              <div className="instructions-bar" aria-hidden="true">
                <span><kbd>Space</kbd> Play/Pause</span>
                <span><kbd>E</kbd> Petri Dish</span>
                <span><kbd>A</kbd> Cinematic</span>
                <span><kbd>H</kbd> Help</span>
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
                    <div className="help-row"><kbd>R</kbd><span>Randomize</span></div>
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
