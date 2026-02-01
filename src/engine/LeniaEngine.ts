import type { SpeciesParams } from '../types.ts';

// ─── Shader Sources ───────────────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const STEP_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform sampler2D u_kernel;
uniform vec2 u_resolution;
uniform int u_R;
uniform float u_kernelNorm;
uniform float u_growthMu;
uniform float u_growthSigma;
uniform float u_dt;

#define MAX_R 20

float growth(float u) {
  return 2.0 * exp(-0.5 * pow((u - u_growthMu) / u_growthSigma, 2.0)) - 1.0;
}

void main() {
  vec2 texel = 1.0 / u_resolution;
  float total = 0.0;
  int kernelSize = 2 * u_R + 1;

  for (int dy = -MAX_R; dy <= MAX_R; dy++) {
    if (dy < -u_R || dy > u_R) continue;
    for (int dx = -MAX_R; dx <= MAX_R; dx++) {
      if (dx < -u_R || dx > u_R) continue;

      float k = texelFetch(u_kernel, ivec2(dx + u_R, dy + u_R), 0).r;
      if (k < 0.00001) continue;

      vec2 sampleUV = v_uv + vec2(float(dx), float(dy)) * texel;
      float val = texture(u_state, sampleUV).r;
      total += val * k;
    }
  }

  float potential = total / max(u_kernelNorm, 0.001);
  float g = growth(potential);
  float current = texture(u_state, v_uv).r;
  float next = clamp(current + u_dt * g, 0.0, 1.0);

  fragColor = vec4(next, 0.0, 0.0, 1.0);
}`;

const DRAW_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform vec2 u_brushPos;
uniform float u_brushSize;
uniform float u_brushIntensity;
uniform int u_eraser;
uniform vec2 u_resolution;

void main() {
  float current = texture(u_state, v_uv).r;
  vec2 pixelPos = v_uv * u_resolution;
  vec2 brushPixel = u_brushPos * u_resolution;
  float dist = length(pixelPos - brushPixel);

  float brush = smoothstep(u_brushSize, u_brushSize * 0.3, dist);
  float result;

  if (u_eraser == 1) {
    result = current * (1.0 - brush * u_brushIntensity);
  } else {
    result = clamp(current + brush * u_brushIntensity, 0.0, 1.0);
  }

  fragColor = vec4(result, 0.0, 0.0, 1.0);
}`;

const RENDER_FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_state;
uniform int u_colormap;
uniform int u_showGrid;
uniform vec2 u_resolution;

// ── Colormap polynomials (Matt Zucker fits) ──

vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777273272, 0.0054856958, 0.3340998053);
  const vec3 c1 = vec3(0.1050930431, 1.4045711462, -0.0197648665);
  const vec3 c2 = vec3(-0.3308618287, 0.2148273698, 1.5686771002);
  const vec3 c3 = vec3(-4.6342849918, -5.7991378880, -19.3324127197);
  const vec3 c4 = vec3(6.2282095816, 14.1799758979, 56.6905032568);
  const vec3 c5 = vec3(4.7763805684, -13.7451089791, -65.3530451975);
  const vec3 c6 = vec3(-5.4354096510, 4.6458755553, 26.3124352495);
  return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}

vec3 magma(float t) {
  const vec3 c0 = vec3(-0.0023226960, -0.0001606900, 0.0137006370);
  const vec3 c1 = vec3(0.1013519380, 0.0228513230, 0.9864507430);
  const vec3 c2 = vec3(4.1547152380, 0.1050323610, 5.0617797760);
  const vec3 c3 = vec3(-28.0975168000, 4.0037001040, -36.7104571380);
  const vec3 c4 = vec3(75.3384199800, -14.4632023390, 97.1408413370);
  const vec3 c5 = vec3(-91.9021642100, 23.7020908750, -120.7956419400);
  const vec3 c6 = vec3(42.2186700280, -11.1477437010, 57.0572766940);
  return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}

vec3 inferno(float t) {
  const vec3 c0 = vec3(0.0002189403, 0.0001671040, -0.0009497110);
  const vec3 c1 = vec3(0.1065134194, 0.0563783830, 0.9680199390);
  const vec3 c2 = vec3(5.5624481980, -1.0490445320, -2.1121265900);
  const vec3 c3 = vec3(-33.2688524540, 3.2541809800, -0.8429603960);
  const vec3 c4 = vec3(78.8591813400, 2.6178536570, 24.0112753510);
  const vec3 c5 = vec3(-82.0089261760, -8.6938984570, -36.5348671480);
  const vec3 c6 = vec3(31.0022667370, 4.6410092960, 15.2892816400);
  return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}

vec3 plasma(float t) {
  const vec3 c0 = vec3(0.0504950790, 0.0298271200, 0.5280796680);
  const vec3 c1 = vec3(1.7489502990, -0.0175081030, -1.0360504220);
  const vec3 c2 = vec3(-3.4200091000, 0.2612965630, 3.6307178760);
  const vec3 c3 = vec3(7.1500458880, 2.2044998460, -12.5792423760);
  const vec3 c4 = vec3(-2.5699247780, -7.5683202400, 23.3369751260);
  const vec3 c5 = vec3(-5.8310998400, 7.8524698080, -20.2432686400);
  const vec3 c6 = vec3(3.3711403660, -2.4756519800, 6.8677365380);
  return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}

void main() {
  float val = texture(u_state, v_uv).r;

  vec3 color;
  if (u_colormap == 0) color = viridis(val);
  else if (u_colormap == 1) color = magma(val);
  else if (u_colormap == 2) color = plasma(val);
  else if (u_colormap == 3) color = inferno(val);
  else color = vec3(val);

  // Glow: boost bright regions
  color *= 1.0 + val * val * 0.6;

  // Grid lines
  if (u_showGrid == 1) {
    vec2 gridPos = v_uv * u_resolution;
    vec2 g = fract(gridPos);
    float line = 1.0 - smoothstep(0.0, 0.08,
      min(min(g.x, g.y), min(1.0 - g.x, 1.0 - g.y)));
    color = mix(color, vec3(0.15, 0.15, 0.2), line * 0.4);
  }

  fragColor = vec4(color, 1.0);
}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: WebGLShader, frag: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link failed:\n${log}`);
  }
  return prog;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  return linkProgram(gl, vert, frag);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class LeniaEngine {
  private gl: WebGL2RenderingContext;
  private gridW: number;
  private gridH: number;

  // Ping-pong state
  private texA: WebGLTexture;
  private texB: WebGLTexture;
  private fbA: WebGLFramebuffer;
  private fbB: WebGLFramebuffer;
  private current: 0 | 1 = 0; // 0 = A is read, 1 = B is read

  // Kernel texture
  private kernelTex: WebGLTexture;
  private kernelNorm: number = 1;

  // Programs
  private stepProg: WebGLProgram;
  private renderProg: WebGLProgram;
  private drawProg: WebGLProgram;

  // Fullscreen quad
  private quadVAO: WebGLVertexArrayObject;

  // Parameters
  private params: SpeciesParams;

  constructor(canvas: HTMLCanvasElement, gridSize: number, params: SpeciesParams) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 not supported');

    // Required for rendering to float textures
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not supported');

    // Optional: linear filtering for float textures
    gl.getExtension('OES_texture_float_linear');

    this.gl = gl;
    this.gridW = gridSize;
    this.gridH = gridSize;
    this.params = params;

    // ── Compile programs ──
    this.stepProg = createProgram(gl, VERT_SRC, STEP_FRAG_SRC);
    this.renderProg = createProgram(gl, VERT_SRC, RENDER_FRAG_SRC);
    this.drawProg = createProgram(gl, VERT_SRC, DRAW_FRAG_SRC);

    // ── Create fullscreen quad ──
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.stepProg, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // ── Create state textures & framebuffers ──
    this.texA = this.createStateTexture();
    this.texB = this.createStateTexture();
    this.fbA = this.createFramebuffer(this.texA);
    this.fbB = this.createFramebuffer(this.texB);

    // ── Create kernel texture ──
    this.kernelTex = gl.createTexture()!;
    this.updateKernel();
  }

  // ── State texture creation ──

  private createStateTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R32F,
      this.gridW, this.gridH, 0,
      gl.RED, gl.FLOAT, null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  private createFramebuffer(tex: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }

  // ── Kernel texture ──

  private updateKernel(): void {
    const gl = this.gl;
    const R = this.params.R;
    const size = 2 * R + 1;
    const data = new Float32Array(size * size);
    let norm = 0;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const ox = dx - R;
        const oy = dy - R;
        const dist = Math.sqrt(ox * ox + oy * oy);
        if (dist > R + 0.5) {
          data[dy * size + dx] = 0;
          continue;
        }
        const r = dist / R; // normalized [0, 1]
        let k = 0;
        for (const ring of this.params.rings) {
          const d = (r - ring.mu) / ring.sigma;
          k += ring.weight * Math.exp(-0.5 * d * d);
        }
        data[dy * size + dx] = k;
        norm += k;
      }
    }

    this.kernelNorm = norm;

    gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R32F,
      size, size, 0,
      gl.RED, gl.FLOAT, data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // ── Read/write helpers ──

  private get readTex(): WebGLTexture {
    return this.current === 0 ? this.texA : this.texB;
  }
  private get writeFB(): WebGLFramebuffer {
    return this.current === 0 ? this.fbB : this.fbA;
  }
  private swap(): void {
    this.current = this.current === 0 ? 1 : 0;
  }

  // ── Public API ──

  step(): void {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeFB);
    gl.viewport(0, 0, this.gridW, this.gridH);
    gl.useProgram(this.stepProg);

    // Bind state texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readTex);
    gl.uniform1i(gl.getUniformLocation(this.stepProg, 'u_state'), 0);

    // Bind kernel texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.kernelTex);
    gl.uniform1i(gl.getUniformLocation(this.stepProg, 'u_kernel'), 1);

    // Uniforms
    gl.uniform2f(
      gl.getUniformLocation(this.stepProg, 'u_resolution'),
      this.gridW, this.gridH
    );
    gl.uniform1i(gl.getUniformLocation(this.stepProg, 'u_R'), this.params.R);
    gl.uniform1f(gl.getUniformLocation(this.stepProg, 'u_kernelNorm'), this.kernelNorm);
    gl.uniform1f(gl.getUniformLocation(this.stepProg, 'u_growthMu'), this.params.growthMu);
    gl.uniform1f(gl.getUniformLocation(this.stepProg, 'u_growthSigma'), this.params.growthSigma);
    gl.uniform1f(gl.getUniformLocation(this.stepProg, 'u_dt'), this.params.dt);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.swap();
  }

  render(colormapIdx: number, showGrid: boolean): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(this.renderProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readTex);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_state'), 0);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_colormap'), colormapIdx);
    gl.uniform1i(gl.getUniformLocation(this.renderProg, 'u_showGrid'), showGrid ? 1 : 0);
    gl.uniform2f(
      gl.getUniformLocation(this.renderProg, 'u_resolution'),
      this.gridW, this.gridH
    );

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  draw(uvX: number, uvY: number, size: number, intensity: number, eraser: boolean): void {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeFB);
    gl.viewport(0, 0, this.gridW, this.gridH);
    gl.useProgram(this.drawProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.readTex);
    gl.uniform1i(gl.getUniformLocation(this.drawProg, 'u_state'), 0);

    gl.uniform2f(gl.getUniformLocation(this.drawProg, 'u_brushPos'), uvX, uvY);
    gl.uniform1f(gl.getUniformLocation(this.drawProg, 'u_brushSize'), size);
    gl.uniform1f(gl.getUniformLocation(this.drawProg, 'u_brushIntensity'), intensity);
    gl.uniform1i(gl.getUniformLocation(this.drawProg, 'u_eraser'), eraser ? 1 : 0);
    gl.uniform2f(
      gl.getUniformLocation(this.drawProg, 'u_resolution'),
      this.gridW, this.gridH
    );

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.swap();
  }

  setParams(params: SpeciesParams): void {
    this.params = params;
    this.updateKernel();
  }

  setDt(dt: number): void {
    this.params = { ...this.params, dt };
  }

  loadPattern(generator: (x: number, y: number, w: number, h: number) => number): void {
    const gl = this.gl;
    const data = new Float32Array(this.gridW * this.gridH);

    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        data[y * this.gridW + x] = Math.max(0, Math.min(1,
          generator(x, y, this.gridW, this.gridH)
        ));
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.readTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      this.gridW, this.gridH,
      gl.RED, gl.FLOAT, data
    );
  }

  clear(): void {
    const gl = this.gl;
    const data = new Float32Array(this.gridW * this.gridH);
    gl.bindTexture(gl.TEXTURE_2D, this.readTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      this.gridW, this.gridH,
      gl.RED, gl.FLOAT, data
    );
  }

  getGridSize(): number {
    return this.gridW;
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texA);
    gl.deleteTexture(this.texB);
    gl.deleteTexture(this.kernelTex);
    gl.deleteFramebuffer(this.fbA);
    gl.deleteFramebuffer(this.fbB);
    gl.deleteProgram(this.stepProg);
    gl.deleteProgram(this.renderProg);
    gl.deleteProgram(this.drawProg);
  }
}
