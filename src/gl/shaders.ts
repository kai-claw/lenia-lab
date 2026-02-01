// ─── Vertex shader (shared) ───────────────────────────────────────
export const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// ─── Lenia update shader ─────────────────────────────────────────
// Performs convolution with kernel texture + growth function in one pass
export const UPDATE_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_state;        // current state
  uniform sampler2D u_kernel;       // precomputed kernel weights (R²×R² texture)
  uniform float u_dt;               // time step
  uniform float u_growthMu;         // growth function center
  uniform float u_growthSigma;      // growth function width
  uniform int u_kernelRadius;       // kernel radius in pixels
  uniform vec2 u_resolution;        // grid resolution
  
  float bell(float x, float mu, float sigma) {
    float d = (x - mu) / sigma;
    return exp(-d * d / 2.0);
  }
  
  void main() {
    vec2 texel = 1.0 / u_resolution;
    float potential = 0.0;
    float kernelSum = 0.0;
    
    // Convolution: sample all kernel offsets
    for (int dy = -50; dy <= 50; dy++) {
      for (int dx = -50; dx <= 50; dx++) {
        if (abs(dx) > u_kernelRadius || abs(dy) > u_kernelRadius) continue;
        
        // Get kernel weight from kernel texture
        vec2 kernelUV = (vec2(float(dx), float(dy)) / float(u_kernelRadius) + 1.0) * 0.5;
        float weight = texture2D(u_kernel, kernelUV).r;
        
        if (weight < 0.001) continue;
        
        // Sample state with wrapping (toroidal boundary)
        vec2 sampleUV = fract(v_uv + vec2(float(dx), float(dy)) * texel);
        float state = texture2D(u_state, sampleUV).r;
        
        potential += state * weight;
        kernelSum += weight;
      }
    }
    
    // Normalize the convolution
    if (kernelSum > 0.0) {
      potential /= kernelSum;
    }
    
    // Growth function: maps potential to growth rate [-1, 1]
    float growth = 2.0 * bell(potential, u_growthMu, u_growthSigma) - 1.0;
    
    // Update state
    float currentState = texture2D(u_state, v_uv).r;
    float newState = currentState + u_dt * growth;
    newState = clamp(newState, 0.0, 1.0);
    
    gl_FragColor = vec4(newState, newState, newState, 1.0);
  }
`;

// ─── Display shader with color mapping ────────────────────────────
export const DISPLAY_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_state;
  uniform int u_colorMap;   // 0=viridis, 1=magma, 2=inferno, 3=plasma, 4=ocean, 5=neon
  
  // Viridis-inspired color map
  vec3 viridis(float t) {
    vec3 c0 = vec3(0.267, 0.004, 0.329);
    vec3 c1 = vec3(0.282, 0.140, 0.458);
    vec3 c2 = vec3(0.253, 0.265, 0.530);
    vec3 c3 = vec3(0.191, 0.407, 0.556);
    vec3 c4 = vec3(0.127, 0.566, 0.551);
    vec3 c5 = vec3(0.267, 0.679, 0.440);
    vec3 c6 = vec3(0.478, 0.821, 0.318);
    vec3 c7 = vec3(0.741, 0.873, 0.150);
    vec3 c8 = vec3(0.993, 0.906, 0.144);
    
    float idx = t * 8.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 8) return c8;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    if (i == 5) return mix(c5, c6, f);
    if (i == 6) return mix(c6, c7, f);
    return mix(c7, c8, f);
  }
  
  // Magma-inspired
  vec3 magma(float t) {
    vec3 c0 = vec3(0.001, 0.0, 0.014);
    vec3 c1 = vec3(0.191, 0.049, 0.361);
    vec3 c2 = vec3(0.467, 0.068, 0.459);
    vec3 c3 = vec3(0.718, 0.168, 0.391);
    vec3 c4 = vec3(0.929, 0.357, 0.278);
    vec3 c5 = vec3(0.993, 0.651, 0.298);
    vec3 c6 = vec3(0.987, 0.991, 0.749);
    
    float idx = t * 6.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 6) return c6;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    return mix(c5, c6, f);
  }
  
  // Inferno-inspired
  vec3 inferno(float t) {
    vec3 c0 = vec3(0.001, 0.0, 0.014);
    vec3 c1 = vec3(0.192, 0.035, 0.388);
    vec3 c2 = vec3(0.471, 0.045, 0.462);
    vec3 c3 = vec3(0.729, 0.213, 0.333);
    vec3 c4 = vec3(0.928, 0.440, 0.150);
    vec3 c5 = vec3(0.987, 0.722, 0.145);
    vec3 c6 = vec3(0.988, 0.998, 0.645);
    
    float idx = t * 6.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 6) return c6;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    return mix(c5, c6, f);
  }
  
  // Plasma-inspired
  vec3 plasma(float t) {
    vec3 c0 = vec3(0.050, 0.030, 0.528);
    vec3 c1 = vec3(0.376, 0.010, 0.632);
    vec3 c2 = vec3(0.618, 0.090, 0.551);
    vec3 c3 = vec3(0.812, 0.249, 0.430);
    vec3 c4 = vec3(0.940, 0.448, 0.290);
    vec3 c5 = vec3(0.992, 0.690, 0.193);
    vec3 c6 = vec3(0.940, 0.975, 0.131);
    
    float idx = t * 6.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 6) return c6;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    return mix(c5, c6, f);
  }
  
  // Ocean theme
  vec3 ocean(float t) {
    vec3 c0 = vec3(0.0, 0.0, 0.05);
    vec3 c1 = vec3(0.0, 0.05, 0.2);
    vec3 c2 = vec3(0.0, 0.2, 0.4);
    vec3 c3 = vec3(0.0, 0.5, 0.6);
    vec3 c4 = vec3(0.2, 0.8, 0.7);
    vec3 c5 = vec3(0.6, 0.95, 0.8);
    vec3 c6 = vec3(1.0, 1.0, 1.0);
    
    float idx = t * 6.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 6) return c6;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    return mix(c5, c6, f);
  }
  
  // Neon theme
  vec3 neon(float t) {
    vec3 c0 = vec3(0.0, 0.0, 0.0);
    vec3 c1 = vec3(0.1, 0.0, 0.3);
    vec3 c2 = vec3(0.4, 0.0, 0.6);
    vec3 c3 = vec3(0.8, 0.0, 0.8);
    vec3 c4 = vec3(1.0, 0.2, 0.6);
    vec3 c5 = vec3(1.0, 0.6, 0.2);
    vec3 c6 = vec3(1.0, 1.0, 0.4);
    
    float idx = t * 6.0;
    int i = int(floor(idx));
    float f = fract(idx);
    
    if (i >= 6) return c6;
    if (i <= 0) return mix(c0, c1, f);
    if (i == 1) return mix(c1, c2, f);
    if (i == 2) return mix(c2, c3, f);
    if (i == 3) return mix(c3, c4, f);
    if (i == 4) return mix(c4, c5, f);
    return mix(c5, c6, f);
  }
  
  void main() {
    float state = texture2D(u_state, v_uv).r;
    
    vec3 color;
    if (u_colorMap == 0) color = viridis(state);
    else if (u_colorMap == 1) color = magma(state);
    else if (u_colorMap == 2) color = inferno(state);
    else if (u_colorMap == 3) color = plasma(state);
    else if (u_colorMap == 4) color = ocean(state);
    else color = neon(state);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Brush shader for drawing ─────────────────────────────────────
export const BRUSH_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_state;
  uniform vec2 u_brushPos;      // brush center in UV coords
  uniform float u_brushRadius;  // brush radius in UV coords
  uniform float u_brushValue;   // 1.0 to add, -1.0 to erase
  uniform float u_brushStrength;
  
  void main() {
    float currentState = texture2D(u_state, v_uv).r;
    
    float dist = distance(v_uv, u_brushPos);
    float brush = smoothstep(u_brushRadius, u_brushRadius * 0.3, dist);
    
    float newState = currentState + brush * u_brushValue * u_brushStrength;
    newState = clamp(newState, 0.0, 1.0);
    
    gl_FragColor = vec4(newState, newState, newState, 1.0);
  }
`;

// ─── Stamp shader for placing creatures ───────────────────────────
export const STAMP_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_state;
  uniform sampler2D u_stamp;     // creature pattern to stamp
  uniform vec2 u_stampPos;       // stamp center in UV coords
  uniform vec2 u_stampSize;      // stamp size in UV coords
  
  void main() {
    float currentState = texture2D(u_state, v_uv).r;
    
    vec2 stampUV = (v_uv - u_stampPos) / u_stampSize + 0.5;
    
    if (stampUV.x >= 0.0 && stampUV.x <= 1.0 && stampUV.y >= 0.0 && stampUV.y <= 1.0) {
      float stampVal = texture2D(u_stamp, stampUV).r;
      currentState = max(currentState, stampVal);
    }
    
    gl_FragColor = vec4(currentState, currentState, currentState, 1.0);
  }
`;
