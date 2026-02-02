import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { LeniaRenderer } from '../gl/renderer';
import { generateRandomState, generateCreaturePattern, type SpeciesParams, type GrowthParams } from '../gl/kernels';

export interface LeniaCanvasHandle {
  setState: (data: Float32Array) => void;
  clear: () => void;
  singleStep: () => void;
  setKernel: (params: SpeciesParams['kernel']) => void;
  setGrowth: (params: GrowthParams) => void;
  setDt: (dt: number) => void;
  stampCreature: (pattern: Float32Array, size: number, uvX: number, uvY: number) => void;
  resize: (w: number, h: number) => void;
  readDensity: () => number;
}

interface Props {
  gridWidth: number;
  gridHeight: number;
  isRunning: boolean;
  speed: number;
  colorMap: number;
  species: SpeciesParams;
  brushSize: number;
  tool: 'draw' | 'erase' | 'stamp';
  onFpsUpdate: (fps: number) => void;
  onStepUpdate: (step: number) => void;
  onToggleRun: () => void;
  onRandomize: () => void;
  onClear: () => void;
  onToggleHelp: () => void;
  onPetriDish?: () => void;
  onCinematicToggle?: () => void;
  onMutationToggle?: () => void;
  onPopChartToggle?: () => void;
}

export const LeniaCanvas = forwardRef<LeniaCanvasHandle, Props>(({
  gridWidth, gridHeight, isRunning, speed, colorMap, species,
  brushSize, tool, onFpsUpdate, onStepUpdate,
  onToggleRun, onRandomize, onClear, onToggleHelp, onPetriDish, onCinematicToggle,
  onMutationToggle, onPopChartToggle,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LeniaRenderer | null>(null);
  const animRef = useRef<number>(0);
  const stepRef = useRef(0);
  const fpsCountRef = useRef({ frames: 0, lastTime: performance.now() });
  const contextLostRef = useRef(false);
  
  // Mutable refs for animation loop access
  const isRunningRef = useRef(isRunning);
  const speedRef = useRef(speed);
  const colorMapRef = useRef(colorMap);
  const speciesRef = useRef(species);
  const growthRef = useRef(species.growth);
  const dtRef = useRef(species.dt);
  
  isRunningRef.current = isRunning;
  speedRef.current = speed;
  colorMapRef.current = colorMap;
  speciesRef.current = species;
  
  // Mouse state
  const isDrawingRef = useRef(false);
  const brushSizeRef = useRef(brushSize);
  const toolRef = useRef(tool);
  brushSizeRef.current = brushSize;
  toolRef.current = tool;

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Size canvas for display
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    
    // WebGL context loss/restore handlers
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      cancelAnimationFrame(animRef.current);
      console.warn('[Lenia Lab] WebGL context lost');
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      console.info('[Lenia Lab] WebGL context restored, reinitializing...');
      try {
        const renderer = new LeniaRenderer(canvas, gridWidth, gridHeight);
        rendererRef.current = renderer;
        renderer.setKernel(speciesRef.current.kernel);
        growthRef.current = speciesRef.current.growth;
        dtRef.current = speciesRef.current.dt;
        const state = generateRandomState(gridWidth, gridHeight, 0.5);
        renderer.setState(state);
        renderer.display(colorMapRef.current);
      } catch (e) {
        console.error('[Lenia Lab] Failed to restore WebGL context:', e);
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    try {
      const renderer = new LeniaRenderer(canvas, gridWidth, gridHeight);
      rendererRef.current = renderer;
      
      // Set initial kernel and state
      renderer.setKernel(species.kernel);
      growthRef.current = species.growth;
      dtRef.current = species.dt;
      
      // Place creature at center for immediate visual impact (not random noise)
      renderer.clear();
      const pattern = generateCreaturePattern('orbium', 64);
      renderer.stamp(pattern, 64, 0.5, 0.5);
      
      // Initial display
      renderer.display(colorMapRef.current);
      
    } catch (e) {
      console.error('Failed to initialize WebGL renderer:', e);
    }
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
    // Only re-init on grid size change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridWidth, gridHeight]);

  // Animation loop
  useEffect(() => {
    const animate = (time: number) => {
      if (contextLostRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const renderer = rendererRef.current;
      if (!renderer) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      
      if (isRunningRef.current) {
        // Run multiple steps per frame based on speed
        const stepsPerFrame = Math.max(1, Math.round(speedRef.current));
        for (let i = 0; i < stepsPerFrame; i++) {
          renderer.step(growthRef.current, dtRef.current);
          stepRef.current++;
        }
        onStepUpdate(stepRef.current);
      }
      
      renderer.display(colorMapRef.current);
      
      // FPS counter
      fpsCountRef.current.frames++;
      const elapsed = time - fpsCountRef.current.lastTime;
      if (elapsed >= 1000) {
        onFpsUpdate(Math.round(fpsCountRef.current.frames * 1000 / elapsed));
        fpsCountRef.current.frames = 0;
        fpsCountRef.current.lastTime = time;
      }
      
      animRef.current = requestAnimationFrame(animate);
    };
    
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [onFpsUpdate, onStepUpdate]);

  // Handle canvas resize on window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          onToggleRun();
          break;
        case 'r':
        case 'R':
          onRandomize();
          break;
        case 'c':
        case 'C':
          onClear();
          break;
        case 'h':
        case 'H':
        case '?':
          onToggleHelp();
          break;
        case 'e':
        case 'E':
          onPetriDish?.();
          break;
        case 'a':
        case 'A':
          onCinematicToggle?.();
          break;
        case 'm':
        case 'M':
          onMutationToggle?.();
          break;
        case 'p':
        case 'P':
          onPopChartToggle?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleRun, onRandomize, onClear, onToggleHelp, onPetriDish, onCinematicToggle, onMutationToggle, onPopChartToggle]);

  // Mouse/touch drawing handlers
  const getUV = useCallback((e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height, // Flip Y for WebGL
    };
  }, []);

  const applyBrush = useCallback((uvX: number, uvY: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    
    const t = toolRef.current;
    if (t === 'draw') {
      renderer.brush(uvX, uvY, brushSizeRef.current, 1.0, 0.4);
    } else if (t === 'erase') {
      renderer.brush(uvX, uvY, brushSizeRef.current, -1.0, 0.6);
    } else if (t === 'stamp') {
      // Stamp current species creature at click position
      const sp = speciesRef.current;
      const speciesId = Object.entries(
        // Find the id from the species params
        {} as Record<string, SpeciesParams>
      ).find(([, v]) => v === sp)?.[0];
      const pattern = generateCreaturePattern(speciesId ?? 'orbium', 64);
      renderer.stamp(pattern, 64, uvX, uvY);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDrawingRef.current = true;
    const uv = getUV(e);
    applyBrush(uv.x, uv.y);
  }, [getUV, applyBrush]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    // Don't continuously stamp — stamp is single-click
    if (toolRef.current === 'stamp') return;
    const uv = getUV(e);
    applyBrush(uv.x, uv.y);
  }, [getUV, applyBrush]);

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const uv = getUV(e.touches[0]);
    applyBrush(uv.x, uv.y);
  }, [getUV, applyBrush]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    if (toolRef.current === 'stamp') return;
    const uv = getUV(e.touches[0]);
    applyBrush(uv.x, uv.y);
  }, [getUV, applyBrush]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    setState(data: Float32Array) {
      rendererRef.current?.setState(data);
    },
    clear() {
      rendererRef.current?.clear();
      stepRef.current = 0;
      onStepUpdate(0);
    },
    singleStep() {
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.step(growthRef.current, dtRef.current);
        stepRef.current++;
        onStepUpdate(stepRef.current);
      }
    },
    setKernel(params) {
      rendererRef.current?.setKernel(params);
    },
    setGrowth(params) {
      growthRef.current = params;
    },
    setDt(newDt) {
      dtRef.current = newDt;
    },
    stampCreature(pattern, size, uvX, uvY) {
      rendererRef.current?.stamp(pattern, size, uvX, uvY);
    },
    resize(w, h) {
      if (rendererRef.current) {
        rendererRef.current.resize(w, h);
        const state = generateRandomState(w, h, 0.5);
        rendererRef.current.setState(state);
        rendererRef.current.setKernel(speciesRef.current.kernel);
        stepRef.current = 0;
        onStepUpdate(0);
      }
    },
    readDensity() {
      return rendererRef.current?.readAverageDensity() ?? 0;
    },
  }), [onStepUpdate]);

  return (
    <canvas
      ref={canvasRef}
      className="lenia-canvas"
      role="img"
      aria-label="Lenia simulation canvas — continuous artificial life visualization. Use draw/erase tools or click to interact."
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    />
  );
});

LeniaCanvas.displayName = 'LeniaCanvas';
