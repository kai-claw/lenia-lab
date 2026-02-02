// ─── Lenia Lab Constants ──────────────────────────────────────────
import { SPECIES } from './gl/kernels';

/** All species IDs derived from SPECIES record */
export const SPECIES_IDS = Object.keys(SPECIES);

/** Duration for cinematic autoplay per species (ms) */
export const CINEMATIC_INTERVAL = 10000;

/** Duration for smooth species morphing transitions (ms) */
export const MORPH_DURATION = 800;

/** Default grid resolution */
export const DEFAULT_GRID_SIZE = 256;

/** Default color map index (1 = Magma) */
export const DEFAULT_COLOR_MAP = 1;

/** Default species on launch */
export const DEFAULT_SPECIES = 'orbium';

/** Number of creatures placed on randomize */
export const RANDOMIZE_COUNT = 3;

/** Petri dish creature count range [min, min+range) */
export const PETRI_DISH_MIN = 4;
export const PETRI_DISH_RANGE = 3;

/** Edge avoidance margin for creature placement (0-1 UV) */
export const PLACEMENT_MARGIN = 0.15;

/** Default brush size (UV fraction) */
export const DEFAULT_BRUSH_SIZE = 0.03;

/** Mutation mode: random walk interval (ms) and step sizes */
export const MUTATION_INTERVAL = 500;
export const MUTATION_MU_STEP = 0.003;
export const MUTATION_SIGMA_STEP = 0.001;
export const MUTATION_DT_STEP = 0.005;

/** Population tracker: ring buffer size and sample interval (ms) */
export const POP_CHART_SAMPLES = 200;
export const POP_SAMPLE_INTERVAL = 100;

/** Growth param safe ranges */
export const GROWTH_MU_RANGE = { min: 0.01, max: 0.5, fallback: 0.15 } as const;
export const GROWTH_SIGMA_RANGE = { min: 0.001, max: 0.1, fallback: 0.015 } as const;
export const DT_RANGE = { min: 0.01, max: 0.5, fallback: 0.1 } as const;
