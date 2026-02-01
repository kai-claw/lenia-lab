import { useRef, useEffect, useCallback } from 'react';
import { LeniaEngine } from '../engine/LeniaEngine.ts';
import { useSimStore } from '../store/useStore.ts';
import { CREATURES, generateRandom } from '../species.ts';

export default function SimCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LeniaEngine | null>(null);
  const drawingRef = useRef(false);
  const animFrameRef = useRef(0);

  const resolution = useSimStore((s) => s.resolution);
  const speciesIndex = useSimStore((s) => s.speciesIndex);

  // ── Initialize engine ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = resolution;
    canvas.height = resolution;

    const creature = CREATURES[speciesIndex];
    try {
      const engine = new LeniaEngine(canvas, resolution, creature.species);
      engine.loadPattern(creature.init);
      engineRef.current = engine;
    } catch (err) {
      console.error('WebGL init failed:', err);
      return;
    }

    // ── Animation loop ──
    const animate = () => {
      const eng = engineRef.current;
      if (!eng) return;

      const state = useSimStore.getState();

      if (state.playing) {
        eng.step();
        useSimStore.getState().incrementGeneration();
      }

      eng.render(state.colormapIndex, state.showGrid);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [resolution, speciesIndex]);

  // ── Sync dt changes to engine ──
  const dt = useSimStore((s) => s.dt);
  useEffect(() => {
    engineRef.current?.setDt(dt);
  }, [dt]);

  // ── Drawing handlers ──
  const getUV = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { u: 0, v: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      u: (e.clientX - rect.left) / rect.width,
      v: 1 - (e.clientY - rect.top) / rect.height, // flip Y
    };
  }, []);

  const handleDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { u, v } = getUV(e);
    const state = useSimStore.getState();
    engine.draw(u, v, state.brushSize, state.brushIntensity, state.eraser);
  }, [getUV]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    handleDraw(e);
  }, [handleDraw]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    handleDraw(e);
  }, [handleDraw]);

  const onMouseUp = useCallback(() => {
    drawingRef.current = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sim-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// ── Imperative actions (called from Controls) ──

export function useEngineActions(engineRef: React.RefObject<LeniaEngine | null>) {
  return {
    engineRef,
  };
}

// We expose the engine via a global for control panel actions
export function getEngine(): LeniaEngine | null {
  return (window as unknown as { __leniaEngine?: LeniaEngine }).__leniaEngine ?? null;
}

// Actually, let's use a simpler approach with a shared ref
export const engineHolder: { current: LeniaEngine | null } = { current: null };

// Patch SimCanvas to expose engine
export function SimCanvasWithRef() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const animFrameRef = useRef(0);

  const resolution = useSimStore((s) => s.resolution);
  const speciesIndex = useSimStore((s) => s.speciesIndex);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = resolution;
    canvas.height = resolution;

    const creature = CREATURES[speciesIndex];
    try {
      const engine = new LeniaEngine(canvas, resolution, creature.species);
      engine.loadPattern(creature.init);
      engineHolder.current = engine;
    } catch (err) {
      console.error('WebGL init failed:', err);
      return;
    }

    const animate = () => {
      const eng = engineHolder.current;
      if (!eng) return;
      const state = useSimStore.getState();
      if (state.playing) {
        eng.step();
        useSimStore.getState().incrementGeneration();
      }
      eng.render(state.colormapIndex, state.showGrid);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      engineHolder.current?.destroy();
      engineHolder.current = null;
    };
  }, [resolution, speciesIndex]);

  const dt = useSimStore((s) => s.dt);
  useEffect(() => {
    engineHolder.current?.setDt(dt);
  }, [dt]);

  const getUV = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { u: 0, v: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      u: (e.clientX - rect.left) / rect.width,
      v: 1 - (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineHolder.current;
    if (!engine) return;
    const { u, v } = getUV(e);
    const state = useSimStore.getState();
    engine.draw(u, v, state.brushSize, state.brushIntensity, state.eraser);
  }, [getUV]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    handleDraw(e);
  }, [handleDraw]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    handleDraw(e);
  }, [handleDraw]);

  const onMouseUp = useCallback(() => {
    drawingRef.current = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sim-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// Convenience: load creature into running engine
export function loadCreature(idx: number): void {
  const engine = engineHolder.current;
  if (!engine) return;
  const creature = CREATURES[idx];
  engine.setParams(creature.species);
  engine.clear();
  engine.loadPattern(creature.init);
  useSimStore.getState().resetGeneration();
}

export function clearGrid(): void {
  engineHolder.current?.clear();
  useSimStore.getState().resetGeneration();
}

export function randomSeed(): void {
  const engine = engineHolder.current;
  if (!engine) return;
  engine.loadPattern(generateRandom);
  useSimStore.getState().resetGeneration();
}
