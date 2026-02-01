import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { LeniaRenderer } from '../gl/renderer';
import { generateRandomState, type SpeciesParams, type GrowthParams } from '../gl/kernels';

export interface LeniaCanvasHandle {
  setState: (data: Float32Array) => void;
  clear: () => void;
  singleStep: () => void;
  setKernel: (params: SpeciesParams['kernel']) => void;
  setGrowth: (params: GrowthParams) => void;
  setDt: (dt: number) => void;
  stampCreature: (pattern: Float32Array, size: number, uvX: number, uvY: number) => void;
  resize: (w: number, h: number) => void;
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
}

export const LeniaCanvas = forwardRef<LeniaCanvasHandle, Props>(({
  gridWidth, gridHeight, isRunning, speed, colorMap, species,
  brushSize, tool, onFpsUpdate, onStepUpdate
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LeniaRenderer | null>(null);
  const animRef = useRef<number>(0);
  const stepRef = useRef(0);
  const fpsCountRef = useRef({ frames: 0, lastTime: performance.now() });
  
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
    
    try {
      const renderer = new LeniaRenderer(canvas, gridWidth, gridHeight);
      rendererRef.current = renderer;
      
      // Set initial kernel and state
      renderer.setKernel(species.kernel);
      growthRef.current = species.growth;
      dtRef.current = species.dt;
      
      // Generate initial random state
      const state = generateRandomState(gridWidth, gridHeight, 0.5);
      renderer.setState(state);
      
      // Initial display
      renderer.display(colorMapRef.current);
      
    } catch (e) {
      console.error('Failed to initialize WebGL renderer:', e);
    }
    
    return () => {
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
    let lastFrame = performance.now();
    
    const animate = (time: number) => {
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
      
      lastFrame = time;
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
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDrawingRef.current = true;
    const uv = getUV(e);
    applyBrush(uv.x, uv.y);
  }, [getUV, applyBrush]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;
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
  }), [onStepUpdate]);

  return (
    <canvas
      ref={canvasRef}
      className="lenia-canvas"
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
