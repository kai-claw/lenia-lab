// ─── Lenia Lab Utility Functions ──────────────────────────────────

/** Smoothstep interpolation — maps [0,1] with smooth ease in/out */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Linear interpolation between a and b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a value to a safe range with NaN fallback */
export function safeClamp(
  value: number,
  min: number,
  max: number,
  fallback: number
): number {
  return Math.max(min, Math.min(max, isNaN(value) ? fallback : value));
}
