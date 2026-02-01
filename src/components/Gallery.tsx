import { useSimStore } from '../store/useStore.ts';
import { CREATURES } from '../species.ts';
import { loadCreature } from './SimCanvas.tsx';

export default function Gallery() {
  const showGallery = useSimStore((s) => s.showGallery);
  const toggleGallery = useSimStore((s) => s.toggleGallery);
  const speciesIndex = useSimStore((s) => s.speciesIndex);
  const setSpecies = useSimStore((s) => s.setSpecies);

  const handleLoad = (idx: number) => {
    setSpecies(idx);
    loadCreature(idx);
  };

  return (
    <div className={`gallery-panel ${showGallery ? 'gallery-open' : ''}`}>
      <button className="gallery-toggle" onClick={toggleGallery}>
        {showGallery ? '▼ Creature Gallery' : '▲ Creature Gallery'}
      </button>

      {showGallery && (
        <div className="gallery-grid">
          {CREATURES.map((creature, idx) => (
            <div
              key={creature.name}
              className={`gallery-card ${speciesIndex === idx ? 'gallery-active' : ''}`}
              onClick={() => handleLoad(idx)}
            >
              <div className="gallery-icon">{creature.emoji}</div>
              <div className="gallery-info">
                <h4 className="gallery-name">{creature.name}</h4>
                <p className="gallery-desc">{creature.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
