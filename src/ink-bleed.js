/**
 * ink-bleed.js — WebGL2 post-processing filter that simulates printed sheet
 * music: ink bleed, paper grain, letterpress edge pooling, and micro-spatter.
 *
 * Usage:
 *   const ib = new InkBleedRenderer(scoreCanvas)
 *   ib.setEnabled(true)
 *   // after every quickDraw():
 *   ib.render()
 *
 * The renderer creates a WebGL2 overlay canvas that sits on top of the score
 * canvas.  When enabled it reads the 2D canvas content, runs the shader
 * pipeline, and displays the result.  When disabled the overlay is hidden.
 */

// ── GLSL Shaders ──────────────────────────────────────────────────────────

const VERT_QUAD = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uRadius;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float sigma = max(uRadius * 0.33, 0.5);
  float total = 0.0;
  vec4 acc = vec4(0.0);
  int r = int(ceil(uRadius));
  for (int i = -r; i <= r; i++) {
    float fi = float(i);
    float w = exp(-0.5 * (fi * fi) / (sigma * sigma));
    acc += texture(uTex, vUv + uDir * fi) * w;
    total += w;
  }
  fragColor = acc / total;
}`

const FRAG_INK = `#version 300 es
precision highp float;

uniform sampler2D uOriginal;
uniform sampler2D uBlurred;
uniform vec2 uResolution;
uniform float uScale;        // score-space units-per-pixel (for scale-independent noise)
uniform vec2 uScroll;        // scroll offset in CSS pixels (scrollLeft, scrollTop)
uniform float uZoom;         // zoom level (1.0 = no zoom)

uniform float uBleed;
uniform float uRoughness;
uniform float uInkDensity;
uniform float uPaperGrain;
uniform float uEdgePool;
uniform vec3 uPaperColor;    // paper base color (RGB, 0-1)

in vec2 vUv;
out vec4 fragColor;

vec2 hash22(vec2 p) {
  vec3 a = fract(p.xyx * vec3(213.897, 415.312, 127.453));
  a += dot(a, a.yzx + 19.19);
  return fract(vec2((a.x + a.y) * a.z, (a.x + a.z) * a.y));
}

float hash21(vec2 p) {
  vec3 a = fract(p.xyx * vec3(213.897, 415.312, 127.453));
  a += dot(a, a.yzx + 19.19);
  return fract((a.x + a.y) * a.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float val = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    val += amp * vnoise(p * freq);
    freq *= 2.17;
    amp *= 0.48;
  }
  return val;
}

float cellNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash22(i + neighbor);
      vec2 diff = neighbor + point - f;
      minDist = min(minDist, dot(diff, diff));
    }
  }
  return sqrt(minDist);
}

void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / uResolution;

  // Score-pinned noise coordinate: convert screen pixel to score-space position
  // so the paper texture is attached to the score, not the viewport.
  vec2 screenPx = uv * uResolution;                    // pixel position on canvas
  vec2 scorePx = (screenPx + uScroll) / uZoom;         // position in score-space
  vec2 baseCoord = scorePx * uScale;

  // Domain warp for organic bleed shape
  float warpNoise1x = fbm(baseCoord * 18.0 + vec2(0.0, 77.7), 4);
  float warpNoise1y = fbm(baseCoord * 18.0 + vec2(33.3, 0.0), 4);
  float warpNoise2x = vnoise(baseCoord * 80.0 + vec2(11.1, 55.5));
  float warpNoise2y = vnoise(baseCoord * 80.0 + vec2(88.8, 22.2));

  float warpStrength = uBleed * uRoughness * 0.025;
  vec2 warp = vec2(
    (warpNoise1x - 0.5) * 1.4 + (warpNoise2x - 0.5) * 0.5,
    (warpNoise1y - 0.5) * 1.0 + (warpNoise2y - 0.5) * 0.4
  ) * warpStrength;

  // Sample textures
  float orig = 1.0 - texture(uOriginal, uv).r;
  float blurred = 1.0 - texture(uBlurred, uv + warp).r;
  float blurStraight = 1.0 - texture(uBlurred, uv).r;

  // Noise layers
  float bleedLow = fbm(baseCoord * 12.0 + 300.0, 3);
  float bleedMid = fbm(baseCoord * 36.0, 5);
  float bleedFine = vnoise(baseCoord * 100.0 + 42.0);
  float fiber = cellNoise(baseCoord * 64.0);
  float fineGrain = vnoise(baseCoord * 150.0 + 100.0);

  // Ink bleed threshold
  float noiseOffset = (bleedLow - 0.5) * uRoughness * 0.35
                    + (bleedMid - 0.5) * uRoughness * 0.45
                    + (bleedFine - 0.5) * uRoughness * 0.25;
  float threshold = 0.10 + (1.0 - uBleed) * 0.38;
  float edgeSoftness = 0.02 + uBleed * 0.04;
  float bleedMask = smoothstep(
    threshold + noiseOffset - edgeSoftness,
    threshold + noiseOffset + edgeSoftness,
    blurred
  );
  float inkMask = max(orig, bleedMask);

  // Sobel edge detection for letterpress pooling
  float tl = 1.0 - texture(uOriginal, uv + vec2(-px.x, -px.y)).r;
  float tr = 1.0 - texture(uOriginal, uv + vec2( px.x, -px.y)).r;
  float bl = 1.0 - texture(uOriginal, uv + vec2(-px.x,  px.y)).r;
  float br = 1.0 - texture(uOriginal, uv + vec2( px.x,  px.y)).r;
  float l  = 1.0 - texture(uOriginal, uv + vec2(-px.x,  0.0 )).r;
  float r  = 1.0 - texture(uOriginal, uv + vec2( px.x,  0.0 )).r;
  float t  = 1.0 - texture(uOriginal, uv + vec2( 0.0,  -px.y)).r;
  float b  = 1.0 - texture(uOriginal, uv + vec2( 0.0,   px.y)).r;
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float edgeMag = length(vec2(gx, gy));

  float bl2 = 1.0 - texture(uBlurred, uv + vec2(-px.x, 0.0)).r;
  float br2 = 1.0 - texture(uBlurred, uv + vec2( px.x, 0.0)).r;
  float bt2 = 1.0 - texture(uBlurred, uv + vec2(0.0, -px.y)).r;
  float bb2 = 1.0 - texture(uBlurred, uv + vec2(0.0,  px.y)).r;
  float blurEdge = length(vec2(br2 - bl2, bb2 - bt2));
  float edge = max(edgeMag, blurEdge * 0.6);

  // Ink density
  float inkStrength = uInkDensity * 0.85 + 0.15;
  float pooling = edge * uEdgePool * 1.8;
  float centerLightening = orig * (1.0 - edge) * (1.0 - uInkDensity * 0.2) * 0.12;
  float paperMod = mix(1.0, fiber * 0.6 + fineGrain * 0.4, uPaperGrain * 0.3);
  float inkAlpha = clamp(inkMask * (inkStrength + pooling - centerLightening) * paperMod, 0.0, 1.0);

  // Micro-spatter
  float spatter = vnoise(baseCoord * 144.0 + 200.0);
  float spatterMask = smoothstep(0.02, 0.10, blurStraight) * (1.0 - smoothstep(0.10, 0.25, blurStraight));
  float spatterDots = step(0.72 - uBleed * 0.15, spatter) * spatterMask * uRoughness;
  inkAlpha = max(inkAlpha, spatterDots * 0.5);

  // Paper color (from uniform)
  vec3 paperColor = uPaperColor;
  float paperTex = fbm(baseCoord * 30.0 + 500.0, 3);
  paperColor *= 0.96 + paperTex * 0.08;
  paperColor *= mix(1.0, 0.92 + fiber * 0.12, uPaperGrain * 0.6);

  // Ink color (not pure black)
  vec3 inkColor = vec3(0.04, 0.035, 0.05) + (bleedMid - 0.5) * 0.02;

  // Composite
  vec3 color = mix(paperColor, inkColor, inkAlpha);
  fragColor = vec4(color, 1.0);
}`

// ── WebGL Helpers ─────────────────────────────────────────────────────────

function compileShader(gl, type, src) {
	const s = gl.createShader(type)
	gl.shaderSource(s, src)
	gl.compileShader(s)
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		console.error('Ink bleed shader error:', gl.getShaderInfoLog(s))
		gl.deleteShader(s)
		return null
	}
	return s
}

function linkProgram(gl, vSrc, fSrc) {
	const v = compileShader(gl, gl.VERTEX_SHADER, vSrc)
	const f = compileShader(gl, gl.FRAGMENT_SHADER, fSrc)
	if (!v || !f) return null
	const p = gl.createProgram()
	gl.attachShader(p, v)
	gl.attachShader(p, f)
	gl.linkProgram(p)
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		console.error('Ink bleed link error:', gl.getProgramInfoLog(p))
		return null
	}
	return p
}

function uniforms(gl, prog, names) {
	const u = {}
	for (const n of names) u[n] = gl.getUniformLocation(prog, n)
	return u
}

function makeFBO(gl, w, h) {
	const tex = gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D, tex)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	const fbo = gl.createFramebuffer()
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
	gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	return { fbo, tex, w, h }
}

// ── InkBleedRenderer ──────────────────────────────────────────────────────

// Default preset: subtle vintage printed score
const DEFAULT_PARAMS = {
	bleed: 0.14,
	roughness: 0.58,
	inkDensity: 1.0,
	paperGrain: 0.13,
	edgePool: 0.02,
	paperColor: [0.945, 0.925, 0.890],  // warm aged paper (RGB, 0-1)
}

export class InkBleedRenderer {
	/**
	 * @param {HTMLCanvasElement} scoreCanvas - The 2D score canvas to post-process
	 */
	constructor(scoreCanvas) {
		this._scoreCanvas = scoreCanvas
		this._enabled = false
		this._params = { ...DEFAULT_PARAMS }

		// Create the WebGL overlay canvas
		this._glCanvas = document.createElement('canvas')
		this._glCanvas.id = 'ink-bleed-canvas'
		this._glCanvas.style.cssText = scoreCanvas.style.cssText
		this._glCanvas.style.position = 'fixed'
		this._glCanvas.style.pointerEvents = 'none'
		this._glCanvas.style.display = 'none'
		this._glCanvas.style.zIndex = '1'

		// Insert after the score canvas
		if (scoreCanvas.parentNode) {
			scoreCanvas.parentNode.insertBefore(this._glCanvas, scoreCanvas.nextSibling)
		}

		// Init WebGL2
		this._gl = this._glCanvas.getContext('webgl2', { antialias: false, alpha: false })
		if (!this._gl) {
			console.warn('InkBleedRenderer: WebGL2 not available')
			return
		}

		this._initGL()
	}

	_initGL() {
		const gl = this._gl

		// Compile shaders
		this._blurProg = linkProgram(gl, VERT_QUAD, FRAG_BLUR)
		this._blurU = uniforms(gl, this._blurProg, ['uTex', 'uDir', 'uRadius'])

		this._inkProg = linkProgram(gl, VERT_QUAD, FRAG_INK)
		this._inkU = uniforms(gl, this._inkProg, [
			'uOriginal', 'uBlurred', 'uResolution', 'uScale', 'uScroll', 'uZoom',
			'uBleed', 'uRoughness', 'uInkDensity', 'uPaperGrain', 'uEdgePool', 'uPaperColor',
		])

		// Fullscreen quad
		this._quadVAO = gl.createVertexArray()
		gl.bindVertexArray(this._quadVAO)
		const buf = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buf)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(0)
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
		gl.bindVertexArray(null)

		// Source texture (score canvas content)
		this._srcTex = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, this._srcTex)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

		this._fboA = null
		this._fboB = null
		this._lastW = 0
		this._lastH = 0
	}

	// ── Public API ────────────────────────────────────────────────────

	get enabled() { return this._enabled }

	setEnabled(on) {
		this._enabled = !!on
		if (this._glCanvas) {
			this._glCanvas.style.display = on ? 'block' : 'none'
		}
	}

	toggle() {
		this.setEnabled(!this._enabled)
		return this._enabled
	}

	/**
	 * Set ink bleed parameters.
	 * @param {object} params - { bleed, roughness, inkDensity, paperGrain, edgePool } (0-1 each)
	 */
	setParams(params) {
		Object.assign(this._params, params)
	}

	get params() { return { ...this._params } }

	/**
	 * Post-process the score canvas through the ink bleed shader.
	 * Call this after every quickDraw().
	 *
	 * @param {number} [scrollX=0] - Score container scrollLeft (CSS px)
	 * @param {number} [scrollY=0] - Score container scrollTop (CSS px)
	 * @param {number} [zoom=1] - Current zoom level
	 */
	render(scrollX, scrollY, zoom) {
		if (!this._enabled || !this._gl) return

		const gl = this._gl
		const src = this._scoreCanvas
		const W = src.width
		const H = src.height

		if (W === 0 || H === 0) return

		// Resize GL canvas if needed
		if (W !== this._lastW || H !== this._lastH) {
			this._glCanvas.width = W
			this._glCanvas.height = H
			this._glCanvas.style.width = src.style.width
			this._glCanvas.style.height = src.style.height

			// Recreate FBOs
			if (this._fboA) { gl.deleteFramebuffer(this._fboA.fbo); gl.deleteTexture(this._fboA.tex) }
			if (this._fboB) { gl.deleteFramebuffer(this._fboB.fbo); gl.deleteTexture(this._fboB.tex) }
			this._fboA = makeFBO(gl, W, H)
			this._fboB = makeFBO(gl, W, H)

			this._lastW = W
			this._lastH = H
		}

		gl.viewport(0, 0, W, H)

		// Upload score canvas to source texture
		gl.bindTexture(gl.TEXTURE_2D, this._srcTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)

		const p = this._params
		// Scale factor for noise: pixels-per-staff-space → keeps grain consistent across zoom
		var noiseScale = 1.0 / Math.max(W, 1000)

		// Blur radius: proportional to bleed, scaled to canvas size
		var blurRadius = p.bleed * Math.min(W, H) * 0.006 + 1.0

		// Pass 1-2: Gaussian blur (separable, multi-pass for large radii)
		var blurredTex = this._blurPass(blurRadius)

		// Pass 3: Ink composite → screen
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
		gl.viewport(0, 0, W, H)
		gl.useProgram(this._inkProg)

		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, this._srcTex)
		gl.uniform1i(this._inkU.uOriginal, 0)

		gl.activeTexture(gl.TEXTURE1)
		gl.bindTexture(gl.TEXTURE_2D, blurredTex)
		gl.uniform1i(this._inkU.uBlurred, 1)

		gl.uniform2f(this._inkU.uResolution, W, H)
		gl.uniform1f(this._inkU.uScale, noiseScale)
		gl.uniform2f(this._inkU.uScroll, scrollX || 0, scrollY || 0)
		gl.uniform1f(this._inkU.uZoom, zoom || 1)
		gl.uniform1f(this._inkU.uBleed, p.bleed)
		gl.uniform1f(this._inkU.uRoughness, p.roughness)
		gl.uniform1f(this._inkU.uInkDensity, p.inkDensity)
		gl.uniform1f(this._inkU.uPaperGrain, p.paperGrain)
		gl.uniform1f(this._inkU.uEdgePool, p.edgePool)
		var pc = p.paperColor || [0.945, 0.925, 0.890]
		gl.uniform3f(this._inkU.uPaperColor, pc[0], pc[1], pc[2])

		this._drawQuad()
	}

	// ── Internal ──────────────────────────────────────────────────────

	_drawQuad() {
		const gl = this._gl
		gl.bindVertexArray(this._quadVAO)
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
	}

	_blurPass(radius) {
		const gl = this._gl
		const W = this._lastW
		const H = this._lastH
		const maxKernel = 40
		var iterations = Math.ceil(radius / maxKernel)
		var perPass = radius / iterations
		var readTex = this._srcTex

		gl.useProgram(this._blurProg)

		for (var iter = 0; iter < iterations; iter++) {
			// Horizontal
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._fboA.fbo)
			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, readTex)
			gl.uniform1i(this._blurU.uTex, 0)
			gl.uniform2f(this._blurU.uDir, 1.0 / W, 0.0)
			gl.uniform1f(this._blurU.uRadius, perPass)
			this._drawQuad()

			// Vertical
			gl.bindFramebuffer(gl.FRAMEBUFFER, this._fboB.fbo)
			gl.activeTexture(gl.TEXTURE0)
			gl.bindTexture(gl.TEXTURE_2D, this._fboA.tex)
			gl.uniform1i(this._blurU.uTex, 0)
			gl.uniform2f(this._blurU.uDir, 0.0, 1.0 / H)
			gl.uniform1f(this._blurU.uRadius, perPass)
			this._drawQuad()

			readTex = this._fboB.tex
		}

		return this._fboB.tex
	}

	dispose() {
		if (this._glCanvas && this._glCanvas.parentNode) {
			this._glCanvas.parentNode.removeChild(this._glCanvas)
		}
		// GL resources cleaned up when context is lost
		this._gl = null
	}
}
