import { useState, useCallback, useRef, useEffect } from 'react';
import { LeniaCanvas, type LeniaCanvasHandle } from './components/LeniaCanvas';
import { Controls } from './components/Controls';
import { CreatureGallery } from './components/CreatureGallery';
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>
            <span className="logo-icon">🧬</span>
            Lenia Lab
          </h1>
          <span className="subtitle">Continuous Artificial Life</span>
        </div>
        <div className="header-right">
          <span className="stat">Step: {stepCount}</span>
          <span className="stat">{fps} FPS</span>
          <span className="stat">{gridSize}×{gridSize}</span>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
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
            onToggleRun={() => setIsRunning(r => !r)}
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
            onDtChange={setDt}
            onGrowthMuChange={setGrowthMu}
            onGrowthSigmaChange={setGrowthSigma}
          />
        </aside>

        <main className="canvas-area">
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
        </main>
      </div>

      <footer className="app-footer">
        <span>
          Lenia — a continuous generalization of Conway's Game of Life by Bert Wang-Chak Chan
        </span>
        <a href="https://github.com/c-goro" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}

export default App;
