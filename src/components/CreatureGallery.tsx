import { SPECIES } from '../gl/kernels';

interface GalleryProps {
  onSelect: (speciesId: string) => void;
  onPlace: (speciesId: string, x?: number, y?: number) => void;
  onClose: () => void;
}

const CREATURE_EMOJIS: Record<string, string> = {
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

export function CreatureGallery({ onSelect, onPlace, onClose }: GalleryProps) {
  return (
    <div className="gallery-overlay" onClick={onClose} role="dialog" aria-label="Creature Gallery" aria-modal="true">
      <div className="gallery-panel" onClick={e => e.stopPropagation()}>
        <div className="gallery-header">
          <h2>🦠 Creature Gallery</h2>
          <button className="btn btn-close" onClick={onClose} aria-label="Close gallery">✕</button>
        </div>
        <p className="gallery-intro">
          Select a species to load its rules and place a seed organism.
          Each species has unique kernel and growth parameters that produce
          different life-like behaviors.
        </p>
        <div className="gallery-grid">
          {Object.entries(SPECIES).map(([id, sp]) => (
            <div key={id} className="creature-card" onClick={() => onSelect(id)}>
              <div className="creature-icon">{CREATURE_EMOJIS[id] || '🧬'}</div>
              <h3>{sp.name}</h3>
              <p>{sp.description}</p>
              <div className="creature-params">
                <span title="Kernel radius">R={sp.kernel.radius}</span>
                <span title="Growth center">μ={sp.growth.mu}</span>
                <span title="Growth width">σ={sp.growth.sigma}</span>
                <span title="Time step">dt={sp.dt}</span>
              </div>
              <div className="creature-actions">
                <button
                  className="btn btn-small btn-primary"
                  onClick={(e) => { e.stopPropagation(); onSelect(id); }}
                >
                  Load Rules
                </button>
                <button
                  className="btn btn-small btn-accent"
                  onClick={(e) => { e.stopPropagation(); onPlace(id); }}
                >
                  Place
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
