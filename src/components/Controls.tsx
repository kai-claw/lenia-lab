import { SPECIES } from '../gl/kernels';

interface ControlsProps {
  species: string;
  isRunning: boolean;
  speed: number;
  colorMap: number;
  gridSize: number;
  brushSize: number;
  tool: 'draw' | 'erase' | 'stamp';
  showAdvanced: boolean;
  dt: number;
  growthMu: number;
  growthSigma: number;
  onSpeciesChange: (id: string) => void;
  onToggleRun: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
  onColorMapChange: (colorMap: number) => void;
  onGridResize: (size: number) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (tool: 'draw' | 'erase' | 'stamp') => void;
  onRandomize: () => void;
  onClear: () => void;
  onToggleGallery: () => void;
  onToggleAdvanced: () => void;
  onDtChange: (dt: number) => void;
  onGrowthMuChange: (mu: number) => void;
  onGrowthSigmaChange: (sigma: number) => void;
}

const COLOR_MAP_NAMES = ['Viridis', 'Magma', 'Inferno', 'Plasma', 'Ocean', 'Neon'];
const GRID_SIZES = [128, 256, 512];

const SPECIES_EMOJIS: Record<string, string> = {
  orbium: '🔵',
  geminium: '♊',
  scutium: '🛡',
  gyrium: '🌀',
  pentium: '⬡',
  bubbles: '🫧',
  worms: '🐛',
  genesis: '✨',
  amoeba: '🦠',
  coral: '🪸',
};

export function Controls({
  species, isRunning, speed, colorMap, gridSize, brushSize, tool,
  showAdvanced, dt, growthMu, growthSigma,
  onSpeciesChange, onToggleRun, onStep, onSpeedChange,
  onColorMapChange, onGridResize, onBrushSizeChange, onToolChange,
  onRandomize, onClear, onToggleGallery, onToggleAdvanced,
  onDtChange, onGrowthMuChange, onGrowthSigmaChange,
}: ControlsProps) {
  return (
    <div className="controls-panel">
      {/* ── Simulation ── */}
      <section className="control-section">
        <h3 className="section-title">⚡ Simulation</h3>
        <div className="button-row">
          <button
            className={`btn ${isRunning ? 'btn-active' : ''}`}
            onClick={onToggleRun}
          >
            {isRunning ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn" onClick={onStep}>⏭ Step</button>
        </div>
        <div className="button-row">
          <button className="btn" onClick={onRandomize}>🎲 Random</button>
          <button className="btn btn-danger" onClick={onClear}>🗑️ Clear</button>
        </div>

        <label className="slider-label">
          Speed: ×{speed}
          <input
            type="range" min="1" max="10" step="1"
            value={speed}
            onChange={(e) => onSpeedChange(parseInt(e.target.value))}
          />
        </label>
      </section>

      {/* ── Species ── */}
      <section className="control-section">
        <h3 className="section-title">🧬 Species</h3>
        <div className="species-grid">
          {Object.entries(SPECIES).map(([id, sp]) => (
            <button
              key={id}
              className={`species-btn ${species === id ? 'species-active' : ''}`}
              onClick={() => onSpeciesChange(id)}
              title={sp.description}
            >
              <span className="species-emoji">{SPECIES_EMOJIS[id] || '🧬'}</span>
              <span className="species-name">{sp.name}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-full btn-accent" onClick={onToggleGallery}>
          🦠 Creature Gallery
        </button>
      </section>

      {/* ── Drawing ── */}
      <section className="control-section">
        <h3 className="section-title">🖌️ Drawing</h3>
        <div className="button-row">
          {(['draw', 'erase', 'stamp'] as const).map((t) => (
            <button
              key={t}
              className={`btn ${tool === t ? 'btn-active' : ''}`}
              onClick={() => onToolChange(t)}
            >
              {t === 'draw' ? '🖌️' : t === 'erase' ? '🧹' : '🔖'} {t}
            </button>
          ))}
        </div>
        <label className="slider-label">
          Brush Size: {brushSize.toFixed(2)}
          <input
            type="range" min="0.01" max="0.15" step="0.005"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(parseFloat(e.target.value))}
          />
        </label>
      </section>

      {/* ── Visual ── */}
      <section className="control-section">
        <h3 className="section-title">🎨 Visual</h3>
        <label className="slider-label">
          Color Map:
          <select
            className="select-input"
            value={colorMap}
            onChange={(e) => onColorMapChange(parseInt(e.target.value))}
          >
            {COLOR_MAP_NAMES.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
        </label>
        <label className="slider-label">
          Grid Size:
          <div className="button-row">
            {GRID_SIZES.map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${gridSize === s ? 'btn-active' : ''}`}
                onClick={() => onGridResize(s)}
              >
                {s}²
              </button>
            ))}
          </div>
        </label>
      </section>

      {/* ── Advanced ── */}
      <section className="control-section">
        <button className="btn btn-full" onClick={onToggleAdvanced}>
          {showAdvanced ? '▾ Advanced' : '▸ Advanced'}
        </button>
        {showAdvanced && (
          <div className="advanced-params">
            <label className="slider-label">
              dt: {dt.toFixed(3)}
              <input
                type="range" min="0.01" max="0.5" step="0.005"
                value={dt}
                onChange={(e) => onDtChange(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label">
              Growth μ: {growthMu.toFixed(4)}
              <input
                type="range" min="0.01" max="0.5" step="0.001"
                value={growthMu}
                onChange={(e) => onGrowthMuChange(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label">
              Growth σ: {growthSigma.toFixed(4)}
              <input
                type="range" min="0.001" max="0.1" step="0.001"
                value={growthSigma}
                onChange={(e) => onGrowthSigmaChange(parseFloat(e.target.value))}
              />
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
