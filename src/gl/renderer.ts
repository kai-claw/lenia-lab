// ─── WebGL Lenia Renderer ─────────────────────────────────────────
// Handles all GPU operations: simulation update, display, drawing

import { VERTEX_SHADER, UPDATE_SHADER, DISPLAY_SHADER, BRUSH_SHADER, STAMP_SHADER } from './shaders';
import { generateKernelTexture, type KernelParams, type GrowthParams } from './kernels';

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export class LeniaRenderer {
  private gl: WebGLRenderingContext;
  private ext: OES_texture_float | null;
  
  // Framebuffers for ping-pong
  private fbA: WebGLFramebuffer | null = null;
  private fbB: WebGLFramebuffer | null = null;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private currentTex: 'A' | 'B' = 'A';
  
  // Kernel texture
  private kernelTex: WebGLTexture | null = null;
  
  // Shader programs
  private updateProgram: ShaderProgram | null = null;
  private displayProgram: ShaderProgram | null = null;
  private brushProgram: ShaderProgram | null = null;
  private stampProgram: ShaderProgram | null = null;
  
  // Geometry buffer
  private quadBuffer: WebGLBuffer | null = null;
  
  // Simulation parameters
  private _gridWidth: number;
  private _gridHeight: number;
  private _kernelRadius: number = 13;
  
  // Stamp texture for creatures
  private stampTex: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement, gridWidth: number = 256, gridHeight: number = 256) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL not supported');
    
    this.gl = gl;
    this._gridWidth = gridWidth;
    this._gridHeight = gridHeight;
    
    // Required extension for float textures
    this.ext = gl.getExtension('OES_texture_float');
    if (!this.ext) {
      // Try half float as fallback
      const halfFloat = gl.getExtension('OES_texture_half_float');
      if (!halfFloat) {
        throw new Error('Float textures not supported');
      }
    }
    // Needed for float texture rendering
    gl.getExtension('OES_texture_float_linear');
    
    this.init();
  }

  get gridWidth() { return this._gridWidth; }
  get gridHeight() { return this._gridHeight; }

  private init() {
    const gl = this.gl;
    
    // Create fullscreen quad
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);
    
    // Compile shader programs
    this.updateProgram = this.createProgram(VERTEX_SHADER, UPDATE_SHADER, [
      'u_state', 'u_kernel', 'u_dt', 'u_growthMu', 'u_growthSigma',
      'u_kernelRadius', 'u_resolution'
    ]);
    
    this.displayProgram = this.createProgram(VERTEX_SHADER, DISPLAY_SHADER, [
      'u_state', 'u_colorMap'
    ]);
    
    this.brushProgram = this.createProgram(VERTEX_SHADER, BRUSH_SHADER, [
      'u_state', 'u_brushPos', 'u_brushRadius', 'u_brushValue', 'u_brushStrength'
    ]);
    
    this.stampProgram = this.createProgram(VERTEX_SHADER, STAMP_SHADER, [
      'u_state', 'u_stamp', 'u_stampPos', 'u_stampSize'
    ]);
    
    // Create framebuffers and textures
    this.createFramebuffers();
  }

  private createProgram(vertSrc: string, fragSrc: string, uniformNames: string[]): ShaderProgram {
    const gl = this.gl;
    
    const vert = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vert));
    }
    
    const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(frag));
    }
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    
    return { program, uniforms };
  }

  private createFramebuffers() {
    const gl = this.gl;
    const w = this._gridWidth;
    const h = this._gridHeight;
    
    // Cleanup old
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    if (this.fbA) gl.deleteFramebuffer(this.fbA);
    if (this.fbB) gl.deleteFramebuffer(this.fbB);
    
    // Create texture A
    this.texA = this.createStateTexture(w, h);
    this.fbA = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texA, 0);
    
    // Create texture B
    this.texB = this.createStateTexture(w, h);
    this.fbB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texB, 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.currentTex = 'A';
  }

  private createStateTexture(w: number, h: number, data?: Float32Array): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    if (data) {
      const rgba = new Float32Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = data[i];
        rgba[i * 4 + 1] = data[i];
        rgba[i * 4 + 2] = data[i];
        rgba[i * 4 + 3] = 1;
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, rgba);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);
    }
    
    return tex;
  }

  /**
   * Set the kernel for the simulation
   */
  setKernel(params: KernelParams) {
    const gl = this.gl;
    const { data, size } = generateKernelTexture(params);
    this._kernelRadius = params.radius;
    
    if (this.kernelTex) gl.deleteTexture(this.kernelTex);
    
    this.kernelTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.FLOAT, data);
  }

  /**
   * Set the initial state of the simulation
   */
  setState(data: Float32Array) {
    const gl = this.gl;
    const tex = this.currentTex === 'A' ? this.texA! : this.texB!;
    
    const rgba = new Float32Array(this._gridWidth * this._gridHeight * 4);
    for (let i = 0; i < this._gridWidth * this._gridHeight; i++) {
      rgba[i * 4] = data[i];
      rgba[i * 4 + 1] = data[i];
      rgba[i * 4 + 2] = data[i];
      rgba[i * 4 + 3] = 1;
    }
    
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this._gridWidth, this._gridHeight, gl.RGBA, gl.FLOAT, rgba);
  }

  /**
   * Read current state back from GPU
   */
  readState(): Float32Array {
    const gl = this.gl;
    const fb = this.currentTex === 'A' ? this.fbA! : this.fbB!;
    const pixels = new Float32Array(this._gridWidth * this._gridHeight * 4);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.readPixels(0, 0, this._gridWidth, this._gridHeight, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    const state = new Float32Array(this._gridWidth * this._gridHeight);
    for (let i = 0; i < state.length; i++) {
      state[i] = pixels[i * 4];
    }
    return state;
  }

  /**
   * Run one simulation step
   */
  step(growth: GrowthParams, dt: number) {
    const gl = this.gl;
    if (!this.updateProgram || !this.kernelTex) return;
    
    const srcTex = this.currentTex === 'A' ? this.texA! : this.texB!;
    const dstFB = this.currentTex === 'A' ? this.fbB! : this.fbA!;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
    gl.viewport(0, 0, this._gridWidth, this._gridHeight);
    
    gl.useProgram(this.updateProgram.program);
    
    // Bind state texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.updateProgram.uniforms['u_state'], 0);
    
    // Bind kernel texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
    gl.uniform1i(this.updateProgram.uniforms['u_kernel'], 1);
    
    // Set uniforms
    gl.uniform1f(this.updateProgram.uniforms['u_dt'], dt);
    gl.uniform1f(this.updateProgram.uniforms['u_growthMu'], growth.mu);
    gl.uniform1f(this.updateProgram.uniforms['u_growthSigma'], growth.sigma);
    gl.uniform1i(this.updateProgram.uniforms['u_kernelRadius'], this._kernelRadius);
    gl.uniform2f(this.updateProgram.uniforms['u_resolution'], this._gridWidth, this._gridHeight);
    
    this.drawQuad(this.updateProgram.program);
    
    // Swap
    this.currentTex = this.currentTex === 'A' ? 'B' : 'A';
  }

  /**
   * Render current state to the canvas with color mapping
   */
  display(colorMap: number) {
    const gl = this.gl;
    if (!this.displayProgram) return;
    
    const srcTex = this.currentTex === 'A' ? this.texA! : this.texB!;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.useProgram(this.displayProgram.program);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.displayProgram.uniforms['u_state'], 0);
    gl.uniform1i(this.displayProgram.uniforms['u_colorMap'], colorMap);
    
    this.drawQuad(this.displayProgram.program);
  }

  /**
   * Apply brush stroke (draw/erase)
   */
  brush(uvX: number, uvY: number, radius: number, value: number, strength: number = 0.5) {
    const gl = this.gl;
    if (!this.brushProgram) return;
    
    const srcTex = this.currentTex === 'A' ? this.texA! : this.texB!;
    const dstFB = this.currentTex === 'A' ? this.fbB! : this.fbA!;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
    gl.viewport(0, 0, this._gridWidth, this._gridHeight);
    
    gl.useProgram(this.brushProgram.program);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.brushProgram.uniforms['u_state'], 0);
    
    gl.uniform2f(this.brushProgram.uniforms['u_brushPos'], uvX, uvY);
    gl.uniform1f(this.brushProgram.uniforms['u_brushRadius'], radius);
    gl.uniform1f(this.brushProgram.uniforms['u_brushValue'], value);
    gl.uniform1f(this.brushProgram.uniforms['u_brushStrength'], strength);
    
    this.drawQuad(this.brushProgram.program);
    
    this.currentTex = this.currentTex === 'A' ? 'B' : 'A';
  }

  /**
   * Stamp a creature pattern at a position
   */
  stamp(pattern: Float32Array, patternSize: number, uvX: number, uvY: number, scale: number = 0.15) {
    const gl = this.gl;
    if (!this.stampProgram) return;
    
    // Create stamp texture
    if (this.stampTex) gl.deleteTexture(this.stampTex);
    this.stampTex = this.createStateTexture(patternSize, patternSize, pattern);
    
    const srcTex = this.currentTex === 'A' ? this.texA! : this.texB!;
    const dstFB = this.currentTex === 'A' ? this.fbB! : this.fbA!;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
    gl.viewport(0, 0, this._gridWidth, this._gridHeight);
    
    gl.useProgram(this.stampProgram.program);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.stampProgram.uniforms['u_state'], 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.stampTex);
    gl.uniform1i(this.stampProgram.uniforms['u_stamp'], 1);
    
    gl.uniform2f(this.stampProgram.uniforms['u_stampPos'], uvX, uvY);
    gl.uniform2f(this.stampProgram.uniforms['u_stampSize'], scale, scale);
    
    this.drawQuad(this.stampProgram.program);
    
    this.currentTex = this.currentTex === 'A' ? 'B' : 'A';
  }

  /**
   * Resize the simulation grid
   */
  resize(width: number, height: number) {
    this._gridWidth = width;
    this._gridHeight = height;
    this.createFramebuffers();
  }

  /**
   * Clear the simulation state
   */
  clear() {
    const gl = this.gl;
    const data = new Float32Array(this._gridWidth * this._gridHeight);
    this.setState(data);
  }

  private drawQuad(program: WebGLProgram) {
    const gl = this.gl;
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Read average cell density from current state (for population tracking)
   */
  readAverageDensity(): number {
    const gl = this.gl;
    const fb = this.currentTex === 'A' ? this.fbA! : this.fbB!;
    const w = this._gridWidth;
    const h = this._gridHeight;
    const pixels = new Float32Array(w * h * 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    let sum = 0;
    const total = w * h;
    for (let i = 0; i < total; i++) {
      sum += pixels[i * 4]; // R channel = state value
    }
    return sum / total;
  }

  destroy() {
    const gl = this.gl;
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    if (this.fbA) gl.deleteFramebuffer(this.fbA);
    if (this.fbB) gl.deleteFramebuffer(this.fbB);
    if (this.kernelTex) gl.deleteTexture(this.kernelTex);
    if (this.stampTex) gl.deleteTexture(this.stampTex);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
  }
}
