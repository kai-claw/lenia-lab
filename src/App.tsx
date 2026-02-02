import { useState, useCallback, useRef, useEffect } from 'react';
import { LeniaCanvas, type LeniaCanvasHandle } from './components/LeniaCanvas';
import { Controls } from './components/Controls';
import { CreatureGallery } from './components/CreatureGallery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SPECIES, generateRandomState, generateCreaturePattern, type SpeciesParams } from './gl/kernels';
import './App.css';

function App() {
  const canvasRef = useRef<LeniaCanvasHandle>(null);
  
  // Simulation state
  const [species, setSpecies] = useState<string>('orbium');
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [colorMap, setColorMap] = useState(0);
  const [gridSize, setGridSize] = useState(256);
  const [brushSize, setBrushSize] = useState(0.03);
  const [tool, setTool] = useState<'draw' | 'erase' | 'stamp'>('draw');
  const [showGallery, setShowGallery] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fps, setFps] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  
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
            />
          </aside>

          <main className="canvas-area" role="main" aria-label="Simulation display">
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
