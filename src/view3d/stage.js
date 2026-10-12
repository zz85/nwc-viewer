/**
 * stage.js — three.js scene for the 3D notation view (from midiviz
 * experiment #025, Notation 3D).
 *
 * Look (after the "animated sheet music" reference renders): thin printed ink
 * on a textured surface, a light per *voice* — every notehead of a chord gets
 * its own lane, lanes hop note-to-note on low arcs as notehead-shaped glows
 * with hairline comet tails — played notes stay lit and pool coloured light
 * on the paper, grazing spotlight, depth of field, bloom and vignette.
 *
 * Score space: x right, y up the page, z out of the page (1 unit = 1 staff space).
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Reflector } from 'three/addons/objects/Reflector.js'

const TITLE_FONT = new URL('../../vendor/three-0.170.0/examples/fonts/droid/droid_serif_bold.typeface.json', import.meta.url).href

export const STAFF_COLORS = ['#ff8a2a', '#2f86ff', '#ff4f8b', '#3ee0b0', '#ffd23f', '#b06bff', '#7cff4f', '#4fd8ff']

/*
 * surface: 'paper' | 'marble'
 * keyMode: 'spot' = narrow grazing spotlight following the playhead (cinematic)
 * playedGlow > 0: played noteheads stay lit (emissive, feeds bloom)
 */
export const THEMES = {
	cinema: {
		surface: 'paperFine', keyMode: 'spot', palette: ['#ffb347', '#59b8ff', '#ff6f91', '#7cffb0', '#ffe066', '#c58bff'],
		bgTop: '#0b0a09', bgBottom: '#000000', paper: '#a9a294', ink: '#0a0907', staff: '#16130f', text: '#141210',
		fog: '#050403', fogNear: 1.6, fogFar: 4.5, hemi: 0.06, key: 0.12, spot: 4.2, spotColor: '#ffe2b8', env: 0.1,
		bloom: 1.1, threshold: 0.92, playedMix: 1, playedGlow: 2.4, poolGain: 1.5, vignette: 1.1,
		title: '#ffcf8a', titleGlow: 0.9, roughness: 0.82, bump: 1.0,
	},
	marble: {
		surface: 'marble', keyMode: 'dir', bgTop: '#3a4148', bgBottom: '#15181b', ink: '#0b0c0e', staff: '#121417', text: '#0d0e10',
		fog: '#1f2428', fogNear: 2.2, fogFar: 7, hemi: 0.5, key: 1.2, spot: 0, env: 0.3, bloom: 1.15, threshold: 0.95,
		playedMix: 1, playedGlow: 2.2, poolGain: 1, vignette: 1.0, title: '#1fae8a', titleGlow: 0.55, roughness: 0.55, bump: 0.6,
	},
	night: {
		surface: 'paper', keyMode: 'dir', bgTop: '#2a2219', bgBottom: '#0d0b08', paper: '#211c15', ink: '#e2d2ae', staff: '#9a876a', text: '#cdb991',
		fog: '#120f0b', fogNear: 2.2, fogFar: 7, hemi: 0.45, key: 2.0, spot: 0, env: 0.3, bloom: 0.8, threshold: 1.05, playedMix: 0.75,
		poolGain: 0.8, vignette: 0.8, title: '#d4a056', titleGlow: 0.5, roughness: 0.92,
	},
	paper: {
		surface: 'paper', keyMode: 'dir', bgTop: '#d9ccb0', bgBottom: '#8f826a', paper: '#e6dbc3', ink: '#120d08', staff: '#2e261c', text: '#1c160f',
		fog: '#c9bc9f', fogNear: 2.2, fogFar: 7, hemi: 0.45, key: 1.5, spot: 0, env: 0.25, bloom: 0.45, threshold: 1.15, playedMix: 0.85,
		poolGain: 0.5, vignette: 0.5, title: '#7a1f2b', titleGlow: 0, roughness: 0.92,
	},
}

// Camera offsets in score space as multiples of the framing distance.
// hop = axis the lights arc along; zoom = per-view framing multiplier.
export const VIEWS = {
	cinema: { offset: [-0.3, -0.9, 0.27], lead: 0.05, hop: 'z', fov: 30, up: [0, 0, 1], zoom: 1.7 },
	bounce: { offset: [-0.42, -0.78, 0.5], lead: 0.1, hop: 'z', fov: 40, up: [0, 0, 1] },
	flat: { offset: [0, 0, 1], lead: 0.18, hop: 'y', fov: 30 },
	tilt: { offset: [-0.12, -0.32, 0.94], lead: 0.2, hop: 'y', fov: 34 },
	table: { offset: [0, -0.95, 0.62], lead: 0.12, hop: 'z', fov: 38, up: [0, 0, 1] },
	low: { offset: [-0.5, -0.9, 0.3], lead: 0.12, hop: 'z', fov: 42, up: [0, 0, 1] },
	// free: camera orbits the playhead following the mouse position (hover, no click)
	free: { orbit: true, lead: 0.05, hop: 'z', fov: 38, up: [0, 0, 1] },
}

const QUALITY_TIERS = [
	{ pr: 1, msaa: true, dof: true },
	{ pr: 1, dof: true },
	{ pr: 0.85, dof: true },
	{ pr: 0.85 },
	{ pr: 0.7, noShadow: true },
	{ pr: 0.55, noShadow: true },
]
// Notehead surface finishes (own material + explicit envMap so reflections
// don't depend on the theme's global environment intensity)
export const HEAD_FINISHES = {
	matte: { roughness: 0.75, metalness: 0, env: 0.1 },
	satin: { roughness: 0.38, metalness: 0.05, env: 0.35 },
	gloss: { roughness: 0.07, metalness: 0, env: 0.45 },
	chrome: { roughness: 0.1, metalness: 1, env: 0.9, ink: '#c8cbd2' },
	gold: { roughness: 0.16, metalness: 1, env: 0.9, ink: '#d9a650' },
}

// Paper surface finishes. 'mirror' adds a planar reflection of bright things
// (glowing notes, streaks, title) — an extra scene render at half resolution.
export const PAPER_FINISHES = {
	matte: {},
	satin: { roughness: 0.5, env: 0.25 },
	glossy: { roughness: 0.55, specular: 0.5, env: 0.3 },
	mirror: { roughness: 0.55, specular: 0.5, env: 0.25, mirror: 0.6 },
}

/** Additive reflection shader: only light brighter than a threshold reflects (no grey haze). */
const MirrorShader = {
	name: 'AdditiveMirror',
	uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, strength: { value: 0.5 } },
	vertexShader: Reflector.ReflectorShader.vertexShader,
	fragmentShader: /* glsl */`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		uniform float strength;
		varying vec4 vUv;
		#include <logdepthbuf_pars_fragment>
		void main() {
			#include <logdepthbuf_fragment>
			vec3 base = texture2DProj( tDiffuse, vUv ).rgb;
			gl_FragColor = vec4( max( base - 0.12, 0.0 ) * strength, 1.0 );
			#include <tonemapping_fragment>
			#include <colorspace_fragment>
		}`,
}

// lanes vanish during silences longer than LANE_GAP: linger LANE_HOLD, fade over
// LANE_FADE, then reappear on the next note itself, fading in over the LANE_ENTER s before it
const LANE_GAP = 2.5, LANE_HOLD = 0.35, LANE_FADE = 0.5, LANE_ENTER = 0.4
const MAX_LANES_PER_STAFF = 6
const STREAK_N = 32
const MAX_POOLS = 160
const HEAD_RX = 0.6, HEAD_RY = 0.44 // notehead-ish ellipse (staff spaces)

// ── textures ────────────────────────────────────────────────────────────────

function gradientTexture(top, bottom) {
	const c = document.createElement('canvas')
	c.width = 2; c.height = 256
	const g = c.getContext('2d')
	const grd = g.createLinearGradient(0, 0, 0, 256)
	grd.addColorStop(0, top); grd.addColorStop(1, bottom)
	g.fillStyle = grd; g.fillRect(0, 0, 2, 256)
	const t = new THREE.CanvasTexture(c)
	t.colorSpace = THREE.SRGBColorSpace
	return t
}

// Periodic value noise / fbm for tileable procedural textures
const hash = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v) }
function noise(x, y, period, s) {
	const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
	const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
	const w = i => ((i % period) + period) % period
	const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s)
	const c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s)
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x, y, s, oct = 6, P = 4) { let f = 0, amp = 0.5; for (let o = 0; o < oct; o++) { f += amp * noise(x, y, P, s); x *= 2; y *= 2; P *= 2; amp *= 0.5 } return f }

function makeTextures(size, fn) {
	const col = document.createElement('canvas'), bmp = document.createElement('canvas')
	col.width = col.height = bmp.width = bmp.height = size
	const ci = col.getContext('2d').createImageData(size, size), bi = bmp.getContext('2d').createImageData(size, size)
	for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
		const [r, g, b, h] = fn(px / size * 4, py / size * 4)
		const k = (py * size + px) * 4
		ci.data[k] = r; ci.data[k + 1] = g; ci.data[k + 2] = b; ci.data[k + 3] = 255
		bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = h; bi.data[k + 3] = 255
	}
	col.getContext('2d').putImageData(ci, 0, 0)
	bmp.getContext('2d').putImageData(bi, 0, 0)
	const map = new THREE.CanvasTexture(col), bump = new THREE.CanvasTexture(bmp)
	for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8 }
	map.colorSpace = THREE.SRGBColorSpace
	return { map, bump }
}

/** Tileable marble: dark slate with pale and warm veins. */
function marbleTextures() {
	return makeTextures(512, (x, y) => {
		const n = fbm(x, y, 1), n2 = fbm(x + 7.3, y + 2.1, 2)
		const v1 = Math.pow(1 - Math.abs(Math.sin((x * 0.5 + y * 0.5 + n * 3.2) * Math.PI)), 18)
		const v2 = Math.pow(1 - Math.abs(Math.sin((x * 1.5 - y * 0.5 + n2 * 4.0) * Math.PI)), 30)
		const m = n * 0.6 + n2 * 0.4
		return [
			Math.min(255, 30 + m * 26 + v1 * 30 + v2 * 48), Math.min(255, 36 + m * 28 + v1 * 33 + v2 * 32),
			Math.min(255, 41 + m * 30 + v1 * 36 + v2 * 12), Math.max(0, Math.min(255, 160 + m * 60 - v1 * 50 - v2 * 70)),
		]
	})
}

/** Tileable heavy watercolour-ish paper: soft mottling + crinkled bump (grazing light reveals it). */
function paperTextures() {
	return makeTextures(512, (x, y) => {
		const m = fbm(x * 0.5, y * 0.5, 3, 4, 2)
		const crinkle = 1 - Math.abs(fbm(x * 1.5, y * 1.5, 4, 5, 6) * 2 - 1)      // ridged noise
		const grain = noise(x * 64, y * 64, 256, 5)
		const v = 228 + m * 22 + grain * 6
		return [Math.min(255, v), Math.min(255, v - 4), Math.min(255, v - 12), Math.min(255, 80 + crinkle * 140 + grain * 30)]
	})
}

function oldPaperTexture() {
	const c = document.createElement('canvas')
	c.width = c.height = 256
	const g = c.getContext('2d')
	const img = g.createImageData(256, 256)
	for (let i = 0; i < img.data.length; i += 4) {
		const v = 236 + Math.random() * 19
		img.data[i] = img.data[i + 1] = img.data[i + 2] = v
		img.data[i + 3] = 255
	}
	g.putImageData(img, 0, 0)
	const t = new THREE.CanvasTexture(c)
	t.wrapS = t.wrapT = THREE.RepeatWrapping
	t.colorSpace = THREE.SRGBColorSpace
	return t
}

/**
 * Dark studio environment for reflective noteheads: a z-up dome that is black
 * below the page, softly lit above, with a warm horizon band and a key spot,
 * so glossy ink stays black with a sheen (RoomEnvironment would wash it grey).
 */
function studioEnvironment(renderer) {
	// Score space is z-up. A dome that is black below the page, softly lit
	// above, with a bright warm horizon band ahead (+y) — the direction a
	// grazing camera sees mirrored in flat noteheads — and a key "softbox".
	const env = new THREE.Scene()
	const geo = new THREE.SphereGeometry(10, 64, 32)
	const pos = geo.attributes.position, col = []
	const d = new THREE.Vector3(), warm = new THREE.Color('#ffdcae'), cool = new THREE.Color('#bcd2ff')
	for (let i = 0; i < pos.count; i++) {
		d.fromBufferAttribute(pos, i).normalize()
		const up = Math.max(0, d.z)
		const band = Math.exp(-(((d.z - 0.22) / 0.12) ** 2)) * Math.max(0, d.y) ** 0.7
		const key = Math.exp(-(((d.x + 0.45) ** 2 + (d.y - 0.35) ** 2 + (d.z - 0.8) ** 2) / 0.05))
		const w = 0.25 * Math.pow(up, 0.8) + 2.2 * band + 6 * key
		const k = 0.8 * Math.exp(-(((d.x - 0.9) ** 2 + d.z ** 2) / 0.04))
		col.push(warm.r * w + cool.r * k, warm.g * w + cool.g * k, warm.b * w + cool.b * k)
	}
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
	env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })))
	const pm = new THREE.PMREMGenerator(renderer)
	const tex = pm.fromScene(env, 0).texture
	pm.dispose()
	return tex
}

function dotTexture() {
	const c = document.createElement('canvas')
	c.width = c.height = 64
	const g = c.getContext('2d')
	const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
	grd.addColorStop(0, 'rgba(255,255,255,1)')
	grd.addColorStop(0.3, 'rgba(255,255,255,0.55)')
	grd.addColorStop(1, 'rgba(255,255,255,0)')
	g.fillStyle = grd; g.fillRect(0, 0, 64, 64)
	return new THREE.CanvasTexture(c)
}

/** MeshStandardMaterial where instance colours > 1.0 become emission (for glow). */
function makeGlyphMaterial() {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 })
	m.onBeforeCompile = sh => {
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <color_fragment>', `
				vec3 instGlow = vec3(0.0);
				#if defined( USE_COLOR )
					instGlow = max(vColor - vec3(1.0), vec3(0.0));
					diffuseColor.rgb *= min(vColor, vec3(1.0));
				#endif`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				totalEmissiveRadiance += instGlow;`)
	}
	m.customProgramCacheKey = () => 'glyph-hdr-instance'
	return m
}

// ── particles (optional FX) ─────────────────────────────────────────────────

class Particles {
	constructor(max, { size, texture, gravity = 14, drag = 0.985, floor = true, opacity = 1 }) {
		this.max = max
		this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3)
		this.col = new Float32Array(max * 3); this.base = new Float32Array(max * 3)
		this.life = new Float32Array(max); this.life0 = new Float32Array(max)
		this.next = 0; this.gravity = gravity; this.drag = drag; this.floor = floor; this.alive = false
		const geo = new THREE.BufferGeometry()
		geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
		geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage))
		this.points = new THREE.Points(geo, new THREE.PointsMaterial({
			size, map: texture, vertexColors: true, transparent: true, depthWrite: false,
			blending: THREE.AdditiveBlending, toneMapped: false, opacity,
		}))
		this.points.frustumCulled = false
	}
	spawn(x, y, z, vx, vy, vz, life, r, g, b) {
		const k = this.next++ % this.max, i = k * 3
		this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z
		this.vel[i] = vx; this.vel[i + 1] = vy; this.vel[i + 2] = vz
		this.base[i] = r; this.base[i + 1] = g; this.base[i + 2] = b
		this.life[k] = this.life0[k] = life
	}
	update(dt, upAxis) {
		if (!this.alive && !this._pending) return
		let alive = false
		const { pos, vel, col, base, life, life0, drag } = this
		for (let k = 0; k < this.max; k++) {
			const i = k * 3
			if (life[k] <= 0) { if (col[i] || col[i + 1] || col[i + 2]) col[i] = col[i + 1] = col[i + 2] = 0; continue }
			alive = true
			life[k] -= dt
			vel[i + upAxis] -= this.gravity * dt
			vel[i] *= drag; vel[i + 1] *= drag; vel[i + 2] *= drag
			pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt
			if (this.floor && upAxis === 2 && pos[i + 2] < 0.05) { pos[i + 2] = 0.05; vel[i + 2] *= -0.45 }
			const f = Math.max(0, life[k] / life0[k])
			const a = f * f * (3 - 2 * f)
			col[i] = base[i] * a; col[i + 1] = base[i + 1] * a; col[i + 2] = base[i + 2] * a
		}
		this.points.geometry.attributes.position.needsUpdate = true
		this.points.geometry.attributes.color.needsUpdate = true
		this.alive = alive
		this._pending = false
	}
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function upperBound(arr, t, key) {
	let lo = 0, hi = arr.length
	while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid][key] <= t) lo = mid + 1; else hi = mid }
	return lo
}

// ── stage ───────────────────────────────────────────────────────────────────

export class NotationStage {
	constructor(container) {
		this.container = container
		this.opts = {
			bloom: true, dof: true, fx: false, shadows: true, trail: true, bounce: 1, zoom: 1, view: 'cinema', theme: 'cinema',
			arcMode: 'distance',  // 'distance' (low, leaps go high) | 'classic' (time-based, bouncy)
			restMode: 'glide',    // 'glide' (one long arc over the rest) | 'leap' (wait on the note, leap in at the end)
			litMode: 'fade',      // 'stay' | 'fade' | 'off' — what played notes do after the flash
			litFade: 4,           // seconds (music time) to fade back to ink
			headFinish: 'satin',
			paperFinish: 'matte',
			transition: 'glide',  // view changes: 'glide' (camera flies) | 'crossfade' (dissolve) | 'cut'
			fadeDur: 1.2,         // crossfade seconds
		}

		// No canvas MSAA: everything renders offscreen through the composer.
		const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
		this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
		this.pixelRatio = this.maxPixelRatio
		renderer.setPixelRatio(this.pixelRatio)
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFShadowMap
		renderer.toneMapping = THREE.ACESFilmicToneMapping
		container.appendChild(renderer.domElement)

		const scene = this.scene = new THREE.Scene()
		this.envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
		this.studioEnv = studioEnvironment(renderer)
		scene.environment = this.envTex

		this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1500)
		// Pointer: click cycles views; in free view, hovering steers the orbit
		// (no buttons needed, so a click always means "next view").
		this.viewOrder = ['cinema', 'bounce', 'tilt', 'flat', 'table', 'low', 'free']
		this.onViewChange = null
		this._mouse = { x: -0.25, y: 0.35 }   // normalised [-1,1], y up
		this._freeDist = 1
		const el = renderer.domElement
		el.style.cursor = 'pointer'
		el.addEventListener('pointermove', e => {
			if (this._offline || this.tour) return // the tour steers the orbit
			const r = el.getBoundingClientRect()
			this._mouse.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1)
			this._mouse.y = clamp(1 - ((e.clientY - r.top) / r.height) * 2, -1, 1)
		})
		el.addEventListener('click', () => { if (!this._offline) this.cycleView() })
		el.addEventListener('wheel', e => {
			if (!this.view.orbit) return
			e.preventDefault()
			this._freeDist = clamp(this._freeDist * Math.exp(e.deltaY * 0.001), 0.35, 3)
		}, { passive: false })

		// Lights: hemi fill, directional key (non-cinematic themes), grazing spot (cinematic)
		this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x403020, 0.5)
		const key = this.keyLight = new THREE.DirectionalLight(0xfff0d8, 2)
		key.shadow.mapSize.set(1024, 1024)
		key.shadow.bias = -0.0004
		key.shadow.normalBias = 0.03
		const spot = this.spot = new THREE.SpotLight(0xffe7c4, 0, 0, 0.42, 0.95, 0)
		spot.shadow.mapSize.set(1024, 1024)
		spot.shadow.bias = -0.0002
		spot.shadow.normalBias = 0.02
		scene.add(this.hemi, key, key.target, spot, spot.target)

		this.inkColor = new THREE.Color()
		this.headInk = new THREE.Color()
		this.materials = {
			staff: new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 }),
			ink: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }),
			glyph: makeGlyphMaterial(),
			head: makeGlyphMaterial(),
			text: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
			inkColor: this.inkColor,
		}
		this.surfaces = {
			paper: { map: oldPaperTexture(), tile: 24 },
			paperFine: { ...paperTextures(), tile: 26 },
			marble: { ...marbleTextures(), tile: 120 },
		}
		this.paperMat = new THREE.MeshPhysicalMaterial({ roughness: 0.92, metalness: 0 })
		this._surfaceSize = [100, 100]

		// Shared FX resources
		this.fxGroup = new THREE.Group()
		scene.add(this.fxGroup)
		const dot = this.dotTex = dotTexture()
		this.sparks = new Particles(2400, { size: 0.22, texture: dot, gravity: 6, drag: 0.97 })
		this.dust = new Particles(500, { size: 2.4, texture: dot, gravity: -0.6, drag: 0.94, floor: false, opacity: 0.5 })
		this.fxGroup.add(this.dust.points, this.sparks.points)
		this._initRipples()

		// Light pools on the paper (instanced additive decals — cheap stand-in for real lights)
		this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
			map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
		}), MAX_POOLS)
		this.pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
		this.pools.setColorAt(0, new THREE.Color())
		this.pools.instanceColor.setUsage(THREE.DynamicDrawUsage)
		this.pools.frustumCulled = false
		this.pools.renderOrder = 1
		this.pools.count = 0
		scene.add(this.pools)

		// Post: render → DOF → bloom → vignette → output
		const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 })
		this.composer = new EffectComposer(renderer, rt)
		this.renderPass = new RenderPass(scene, this.camera)
		this.composer.addPass(this.renderPass)
		this.bokehPass = new BokehPass(scene, this.camera, { focus: 40, aperture: 0.0003, maxblur: 0.008 })
		this.composer.addPass(this.bokehPass)
		const bokehRender = this.bokehPass.render.bind(this.bokehPass)
		this.bokehPass.render = (...a) => {
			const mv = this.mirror?.visible
			if (this.mirror) this.mirror.visible = false
			bokehRender(...a)
			if (this.mirror) this.mirror.visible = mv
		}
		this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.55, 0.9)
		this.composer.addPass(this.bloomPass)
		this.composer.addPass(new OutputPass())
		// Vignette after tone mapping (on display-referred colour) so it only darkens
		this.vignettePass = new ShaderPass(VignetteShader)
		this.vignettePass.uniforms.offset.value = 1.0
		this.composer.addPass(this.vignettePass)

		// Crossfade: the outgoing view is rendered live by a second camera into
		// fadeRT, then dissolved over the incoming view.
		this.fadeCam = new THREE.PerspectiveCamera(34, 1, 0.5, 1500)
		this.fadeRT = new THREE.WebGLRenderTarget(2, 2)
		this._copyQuad = new FullScreenQuad(new THREE.ShaderMaterial({
			uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
			vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
			fragmentShader: 'uniform sampler2D tDiffuse; uniform float opacity; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, opacity); }',
			depthTest: false, depthWrite: false, transparent: true,
		}))
		this._xfade = null
		this._pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() }
		this._fadePose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() }
		this._lastFx = 0

		this.lanes = []
		this.score = null
		this.tour = null
		this._camPos = new THREE.Vector3()
		this._camTarget = new THREE.Vector3()
		this._lookAt = new THREE.Vector3()
		this._lastT = 0
		this._lastFocusX = null
		this._snapCamera = true
		this._tmpM = new THREE.Matrix4()
		this._tmpM2 = new THREE.Matrix4()
		this._tmpC = new THREE.Color()
		this._tmpC2 = new THREE.Color()
		this._v = Array.from({ length: 8 }, () => new THREE.Vector3())
		this._frameEMA = 16
		this._qualityTimer = 0
		this.tier = 1
		this._msaaOff = true

		this.setTheme(this.opts.theme)
		this.setHeadFinish(this.opts.headFinish)
		this.setView(this.opts.view)
		this.resize()
		new ResizeObserver(() => this.resize()).observe(container)
	}

	_initRipples() {
		this.ripples = []
		const geo = new THREE.RingGeometry(0.62, 0.74, 48)
		for (let i = 0; i < 32; i++) {
			const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
				transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
			}))
			m.visible = false
			m.userData.start = -1
			this.fxGroup.add(m)
			this.ripples.push(m)
		}
		this.rippleNext = 0
	}

	// ── public API ──
	resize(snap = true) {
		const cw = this.container.clientWidth || 1, ch = this.container.clientHeight || 1
		const off = this._offline
		// Offline export renders at an exact pixel size; the canvas is just scaled to fit on screen.
		const w = off ? off.w : cw, h = off ? off.h : ch
		if (off) this.pixelRatio = 1
		this.renderer.setPixelRatio(this.pixelRatio)
		this.renderer.setSize(w, h, false)
		const fit = off ? Math.min(cw / w, ch / h) : 1
		const el = this.renderer.domElement
		el.style.width = Math.round(w * fit) + 'px'
		el.style.height = Math.round(h * fit) + 'px'
		el.style.margin = off ? '0 auto' : ''
		// MSAA only at low pixel ratios; adaptive quality drops it first when slow.
		const samples = this.pixelRatio < 1.25 && !this._msaaOff ? 4 : 0
		for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
			if (target.samples !== samples) { target.samples = samples; target.dispose() }
		}
		this.composer.setPixelRatio(this.pixelRatio)
		this.composer.setSize(w, h)
		this.bloomPass.resolution.set(w * this.pixelRatio / 3, h * this.pixelRatio / 3)
		this.mirror?.getRenderTarget().setSize(Math.max(2, (w * this.pixelRatio) >> 1), Math.max(2, (h * this.pixelRatio) >> 1))
		this.camera.aspect = w / h
		this.camera.updateProjectionMatrix()
		if (snap) this._snapCamera = true
	}

	get palette() { return this.theme.palette || STAFF_COLORS }

	setTheme(name) {
		const th = this.theme = THEMES[name] || THEMES.cinema
		this.opts.theme = name
		this.scene.background = gradientTexture(th.bgTop, th.bgBottom)
		this.scene.fog = new THREE.Fog(th.fog, 60, 400)
		this.scene.environmentIntensity = th.env
		this.hemi.intensity = th.hemi
		this.keyLight.intensity = th.key
		this.spot.intensity = th.spot
		this.spot.visible = th.keyMode === 'spot'
		if (th.spotColor) this.spot.color.set(th.spotColor)
		this._applyShadowCaster()
		this.inkColor.set(th.ink)
		this.headInk.set(HEAD_FINISHES[this.opts.headFinish]?.ink || th.ink)
		this.materials.ink.color.set(th.ink)
		this.materials.staff.color.set(th.staff)
		const surf = this.surfaces[th.surface] || this.surfaces.paper
		this.paperMat.map = surf.map
		this.paperMat.bumpMap = surf.bump || null
		this.paperMat.bumpScale = th.bump ?? 0.6
		this.paperMat.roughness = th.roughness ?? 0.92
		this.paperMat.color.set(th.surface === 'marble' ? '#ffffff' : th.paper)
		this._applyPaperFinish()
		this._updateSurfaceRepeat()
		this.bloomPass.strength = th.bloom
		this.bloomPass.threshold = th.threshold
		this.vignettePass.uniforms.darkness.value = th.vignette ?? 1
		this._textColor = th.text
		if (this.titleMesh) this._styleTitle()
		if (this.score) {
			this.score.built.group.traverse(o => { if (o.userData.isText) o.material.color.set(th.text) })
			this._recolorLanes()
			this._recolorAll(this._lastT)
		}
	}

	_applyShadowCaster() {
		const on = this.opts.shadows && !QUALITY_TIERS[this.tier ?? 1].noShadow
		const spotMode = this.theme.keyMode === 'spot'
		this.keyLight.castShadow = on && !spotMode
		this.spot.castShadow = on && spotMode
	}

	_updateSurfaceRepeat() {
		const surf = this.surfaces[this.theme.surface] || this.surfaces.paper
		const [w, h] = this._surfaceSize
		surf.map.repeat.set(w / surf.tile, h / surf.tile)
		if (surf.bump) surf.bump.repeat.copy(surf.map.repeat)
	}

	_styleTitle() {
		const th = this.theme, m = this.titleMesh.material
		m.color.set(th.title)
		m.emissive.set(th.title)
		m.emissiveIntensity = th.titleGlow
	}

	/** 3D extruded song title lying on the table above the first system. */
	async setTitle(text) {
		const seq = (this._titleSeq = (this._titleSeq || 0) + 1)
		this.titleText = text || ''
		if (this.titleMesh) { this.titleMesh.removeFromParent(); this.titleMesh.geometry.dispose(); this.titleMesh = null }
		if (!text || !this.score) return
		try {
			this._font ||= new FontLoader().loadAsync(TITLE_FONT)
			const font = await this._font
			if (seq !== this._titleSeq || !this.score) return
			const geo = new TextGeometry(text.slice(0, 60), {
				font, size: 2.4, depth: 0.25, curveSegments: 4,
				bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2,
			})
			const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }))
			const s = this.score
			mesh.position.set(s.minX + 2, s.centerY + s.height / 2 + 5, 0)
			mesh.castShadow = true
			geo.computeBoundingBox()
			this.titleMesh = mesh
			this._styleTitle()
			s.root.add(mesh)
		} catch (e) { console.warn('title font failed', e) }
	}

	/**
	 * 3D title intro shot. k = 0..1 through the intro; null clears it.
	 * The camera starts low and close on the extruded title, dollies across it,
	 * then (last ~40%) eases into the normal view at the opening of the music.
	 */
	setIntroShot(k) {
		this._introShot = k == null || !this.titleMesh ? null : clamp(k, 0, 1)
		if (this.titleMesh) this.titleMesh.material.emissiveIntensity = this.theme.titleGlow * (this._introShot == null ? 1 : 0.45)
		if (k == null) this._snapCamera = true
	}

	_introPose(k, out) {
		const m = this.titleMesh
		const bb = m.geometry.boundingBox
		const w = Math.max(6, bb.max.x - bb.min.x), h = bb.max.y - bb.min.y
		const cx = m.position.x + (bb.min.x + bb.max.x) / 2, cy = m.position.y + (bb.min.y + bb.max.y) / 2
		// frame the whole word: distance from the title width and the camera fov
		const D = (w * 0.62) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / Math.max(1, this.camera.aspect) + 8
		const u = 1 - (1 - k) * (1 - k) // ease-out dolly
		out.target.set(cx + lerp(-w * 0.06, w * 0.06, u), cy, 0.3)
		out.pos.set(cx + lerp(-w * 0.3, w * 0.12, u), cy - D * lerp(0.92, 0.8, u), D * lerp(0.28, 0.4, u))
		out.up.set(0, 0, 1)
	}

	setView(name) {
		const prev = this.view
		this.opts.view = VIEWS[name] ? name : 'cinema'
		const v = this.view = VIEWS[this.opts.view]
		this.camera.fov = v.fov
		this.camera.updateProjectionMatrix()
		this.renderer.domElement.style.cursor = v.orbit ? 'crosshair' : 'pointer'
		const mode = this.opts.transition
		if (mode === 'crossfade' && prev && prev !== v && this.score) {
			// dissolve from the outgoing view (frozen orbit mouse) into a snapped new view
			this._xfade = { from: prev, mouse: { ...this._mouse }, start: null }
			this._snapCamera = true
		} else if (mode === 'cut') {
			this._xfade = null
			this._snapCamera = true
		} else {
			this._xfade = null
			this._snapCamera = false // glide between views
		}
	}

	/**
	 * Camera tour: rotate through views every `segment` seconds of music time.
	 * In orbit views the virtual mouse circles, sweeping azimuth and elevation.
	 * @param {{views:string[], segment:number, t0?:number}|null} spec
	 */
	setTour(spec) {
		this.tour = spec && spec.views?.length ? { t0: 0, seed: (Math.random() * 1e9) | 0, ...spec } : null
		this._tourIdx = null
		this._tourOrders = new Map()
	}

	/** View for tour segment idx; random order = seeded reshuffle per cycle, no repeats across cycles. */
	_tourView(idx) {
		const { views, random, seed } = this.tour
		const n = views.length
		if (!random || n < 2) return views[idx % n]
		const order = c => {
			if (this._tourOrders.has(c)) return this._tourOrders.get(c)
			let x = (seed + c * 2654435761) >>> 0
			const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 }
			const o = views.slice()
			for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] }
			if (c > 0) { const prev = order(c - 1); if (o[0] === prev[n - 1]) [o[0], o[1]] = [o[1], o[0]] }
			this._tourOrders.set(c, o)
			return o
		}
		return order(Math.floor(idx / n))[idx % n]
	}

	_applyTour(t) {
		const { segment, t0 } = this.tour
		const rel = Math.max(0, t - t0)
		const idx = Math.floor(rel / segment)
		if (idx !== this._tourIdx) {
			const first = this._tourIdx == null
			this._tourIdx = idx
			const name = this._tourView(idx)
			if (name !== this.opts.view) { this.setView(name); this.onViewChange?.(name) }
			if (first) { this._snapCamera = true; this._xfade = null }
		}
		if (this.view.orbit) {
			// one full circle per segment (at least 8 s, so short scenes sway rather than spin)
			const period = Math.max(segment, 8)
			const u = ((rel - idx * segment) % period) / period, a = u * Math.PI * 2
			this._mouse.x = 0.85 * Math.sin(a)
			this._mouse.y = -0.25 + 0.6 * Math.cos(a)
		}
	}

	/** Advance to the next camera view (canvas click). */
	cycleView() {
		const order = this.viewOrder
		const next = order[(order.indexOf(this.opts.view) + 1) % order.length]
		this.setView(next)
		this.onViewChange?.(next)
	}

	setPaperFinish(name) {
		this.opts.paperFinish = PAPER_FINISHES[name] ? name : 'matte'
		this._applyPaperFinish()
	}

	_applyPaperFinish() {
		const f = PAPER_FINISHES[this.opts.paperFinish] || PAPER_FINISHES.matte
		const m = this.paperMat
		m.roughness = f.roughness ?? this.theme.roughness ?? 0.92
		// No clearcoat: a sharp coat turns the grazing spotlight into a big glare
		// blob; glossiness comes from reflections (env + optional planar mirror).
		m.clearcoat = f.clearcoat || 0
		m.specularIntensity = f.specular ?? 1
		m.clearcoatRoughness = f.clearcoatRoughness ?? 0.1
		m.envMap = f.env ? this.studioEnv : null
		m.envMapIntensity = f.env ?? 1
		m.needsUpdate = true
		this._updateMirror()
	}

	/** Planar mirror over the paper (created lazily, only for the 'mirror' finish). */
	_updateMirror() {
		const f = PAPER_FINISHES[this.opts.paperFinish] || {}
		const want = !!f.mirror && !QUALITY_TIERS[this.tier ?? 1].noShadow
		if (want && !this.mirror) {
			const r = this.renderer.getDrawingBufferSize(new THREE.Vector2())
			this.mirror = new Reflector(new THREE.PlaneGeometry(1, 1), {
				shader: MirrorShader, textureWidth: Math.max(2, r.x >> 1), textureHeight: Math.max(2, r.y >> 1), clipBias: 0.002,
			})
			Object.assign(this.mirror.material, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
			this.mirror.renderOrder = 0.5
			this.scene.add(this.mirror)
		}
		if (!this.mirror) return
		this.mirror.visible = want
		this.mirror.material.uniforms.strength.value = f.mirror || 0
		const [w, h] = this._surfaceSize
		this.mirror.scale.set(w, h, 1)
		this.mirror.position.set(this._surfaceCenter?.[0] || 0, this._surfaceCenter?.[1] || 0, 0.004)
	}

	setHeadFinish(name) {
		const f = HEAD_FINISHES[name] || HEAD_FINISHES.satin
		this.opts.headFinish = HEAD_FINISHES[name] ? name : 'satin'
		const m = this.materials.head
		m.roughness = f.roughness
		m.metalness = f.metalness
		m.envMap = this.studioEnv
		m.envMapIntensity = f.env
		m.needsUpdate = true
		this.headInk.set(f.ink || this.theme.ink)
		if (this.score) this._recolorAll(this._lastT)
	}

	setOption(key, value) {
		this.opts[key] = value
		if (key === 'headFinish') return this.setHeadFinish(value)
		if (key === 'paperFinish') return this.setPaperFinish(value)
		if (key === 'litMode' || key === 'litFade') this._recolorAll(this._lastT)
		if (key === 'shadows') this._applyShadowCaster()
		if (key === 'trail' && this.streak) this.streak.visible = value
		if (key === 'zoom') this._snapCamera = false
	}

	clear() {
		if (this.score) {
			this.score.root.removeFromParent()
			this.score.root.traverse(o => {
				if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose()
				if (o.userData.isText) { o.material.map?.dispose(); o.material.dispose() }
			})
		}
		this.lanes = []
		this.score = null
		this.streak = null
		this.titleMesh = null
	}

	/**
	 * @param {object} built - from buildScoreMeshes
	 * @param {Array<Array<{time, heads}>>} perStaff - onsets per staff, time-sorted
	 */
	setScore(built, perStaff) {
		this.clear()
		const root = new THREE.Group()
		root.add(built.group)

		const b = built.bounds
		const width = b.max.x - b.min.x
		const height = b.max.y - b.min.y
		const paper = new THREE.Mesh(new THREE.PlaneGeometry(width + 400, height + 3000), this.paperMat)
		paper.position.set((b.min.x + b.max.x) / 2 + 150, (b.min.y + b.max.y) / 2, -0.01)
		paper.receiveShadow = true
		this._surfaceSize = [width + 400, height + 3000]
		this._surfaceCenter = [paper.position.x, paper.position.y]
		this._updateSurfaceRepeat()
		this._updateMirror()
		root.add(paper)
		this.scene.add(root)
		built.group.traverse(o => { if (o.userData.isText) o.material.color.set(this._textColor) })

		// Heads: first-hit time + staff. Chord heads sorted bottom → top for lane ranks.
		const headState = new Map()
		perStaff.forEach((onsets, si) => {
			for (const o of onsets) {
				o.heads.sort((p, q) => p.y - q.y || p.x - q.x)
				for (const h of o.heads) if (!headState.has(h)) headState.set(h, { h, time: o.time, staff: si, color: onsets.color ?? si, glowStart: -1 })
			}
		})

		// Camera timeline: leftmost head per distinct time
		const pts = []
		for (const onsets of perStaff) for (const o of onsets) pts.push({ time: o.time, x: o.heads[0].x })
		pts.sort((p, q) => p.time - q.time || p.x - q.x)
		const timeline = []
		for (const p of pts) {
			const last = timeline[timeline.length - 1]
			if (!last || Math.abs(last.time - p.time) > 1e-4) timeline.push(p)
		}

		this.score = {
			built, root, perStaff, headState, timeline,
			centerY: (b.min.y + b.max.y) / 2, height: Math.max(height, 8), minX: b.min.x, maxX: b.max.x,
			active: new Set(), staffIdx: perStaff.map(() => -2),
		}

		// Voice lanes: lane k of a staff follows the k-th notehead (bottom-up) of each
		// onset, clamped to the top note — so lanes split out of / merge into the
		// top voice when chord sizes change.
		this.lanes = []
		perStaff.forEach((onsets, si) => {
			if (!onsets.length) return
			const L = Math.min(MAX_LANES_PER_STAFF, onsets.reduce((m, o) => Math.max(m, o.heads.length), 1))
			for (let k = 0; k < L; k++) this.lanes.push({ staff: si, colorIdx: onsets.color ?? si, k, onsets, color: new THREE.Color(), pos: new THREE.Vector3(), vis: false, idx: -1 })
		})
		this._recolorLanes()

		// Glowing heads: one InstancedMesh for every lane
		const headGeo = new THREE.SphereGeometry(1, 20, 12)
		headGeo.scale(HEAD_RX, HEAD_RY, 0.22)
		this.heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, this.lanes.length))
		this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
		this.heads.frustumCulled = false
		this.heads.castShadow = false
		root.add(this.heads)

		// Streaks: all lanes in one dynamic ribbon geometry
		const n = this.lanes.length * STREAK_N * 2
		const sg = new THREE.BufferGeometry()
		sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
		sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
		const idx = []
		for (let l = 0; l < this.lanes.length; l++) {
			const base = l * STREAK_N * 2
			for (let k = 0; k < STREAK_N - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
		}
		sg.setIndex(idx)
		this.streak = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({
			vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
		}))
		this.streak.frustumCulled = false
		this.streak.visible = this.opts.trail
		this.streak.renderOrder = 2
		root.add(this.streak)

		this._snapCamera = true
		this._recolorAll(0)
		this._lastT = 0
	}

	_recolorLanes() {
		const pal = this.palette
		for (const l of this.lanes) l.color.set(pal[l.colorIdx % pal.length])
		if (this.heads) {
			const c = this._tmpC
			this.lanes.forEach((l, i) => this.heads.setColorAt(i, c.copy(l.color).lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(2.6)))
			if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true
		}
	}

	/** Recompute every notehead's colour for time t (after load / seek / theme). */
	_recolorAll(t) {
		const s = this.score
		if (!s) return
		s.built.setInkColor(this.inkColor)
		s.active.clear()
		for (const st of s.headState.values()) {
			st.glowStart = -Infinity
			const level = this._litLevel(st, t)
			this._applyHead(st, level, 0)
			if (level > 0 && level < 1) s.active.add(st) // still fading
		}
		s.staffIdx = s.perStaff.map(on => upperBound(on, t, 'time') - 1)
	}

	/** How lit a played notehead is at music time t (0 = ink, 1 = fully lit). */
	_litLevel(st, t) {
		if (st.time > t + 1e-4) return 0
		const mode = this.opts.litMode
		if (mode === 'stay') return 1
		if (mode === 'off') return 0
		const x = clamp((t - st.time) / Math.max(0.1, this.opts.litFade), 0, 1)
		return 1 - x * x * (3 - 2 * x)
	}

	/** level: 0..1 lit amount; glow: 0..1 impact flash on top. */
	_applyHead(st, level, glow) {
		const { mesh, index, matrix, x, y } = st.h
		const c = this._tmpC
		c.copy(this.headInk)
		if (level > 0 || glow > 0) {
			const pal = this.palette
			const base = this._tmpC2.set(pal[st.color % pal.length])
			const lit = this._tmpC3 || (this._tmpC3 = new THREE.Color())
			lit.lerpColors(this.headInk, base, this.theme.playedMix)
			if (this.theme.playedGlow) lit.multiplyScalar(this.theme.playedGlow)
			c.lerp(lit, level)
			if (glow > 0) c.lerp(base.multiplyScalar(5), glow)
		}
		mesh.setColorAt(index, c)
		mesh.instanceColor.needsUpdate = true
		if (glow > 0) {
			const s = 1 + 0.3 * glow
			const M = this._tmpM.makeTranslation(-x, -y, 0)
			M.premultiply(this._tmpM2.makeScale(s, s, 1 + glow))
			M.premultiply(this._tmpM2.makeTranslation(x, y, 0))
			M.multiply(matrix)
			mesh.setMatrixAt(index, M)
		} else mesh.setMatrixAt(index, matrix)
		mesh.instanceMatrix.needsUpdate = true
	}

	_impact(si, onset, wall) {
		for (const h of onset.heads) {
			const st = this.score.headState.get(h)
			if (!st) continue
			st.glowStart = wall
			this.score.active.add(st)
		}
		if (!this.opts.fx) return
		const pal = this.palette, ci = this.score.perStaff[si]?.color ?? si, c = this._tmpC2.set(pal[ci % pal.length])
		const hop = this.view.hop
		for (const h of onset.heads) {
			const r = this.ripples[this.rippleNext++ % this.ripples.length]
			r.visible = true
			r.userData.start = wall
			r.position.set(h.x, h.y, h.depth + 0.02)
			r.material.color.copy(c).multiplyScalar(2)
			for (let i = 0; i < 6; i++) {
				const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5, w = Math.random() * 0.5
				const [vx, vy, vz] = hop === 'y' ? [Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp, (Math.random() - 0.3) * 3] : [Math.cos(a) * sp, Math.sin(a) * sp, 1.5 + Math.random() * 3]
				this.sparks.spawn(h.x, h.y, h.depth + 0.1, vx, vy, vz, 0.5 + Math.random() * 0.6, lerp(c.r, 1, w) * 3, lerp(c.g, 1, w) * 3, lerp(c.b, 1, w) * 3)
			}
			this.sparks._pending = true
		}
	}

	// ── lane motion ──
	_land(o, k, out) {
		const h = o.heads[Math.min(k, o.heads.length - 1)]
		if (this.view.hop === 'y') return out.set(h.x, h.top + HEAD_RY * 0.6, h.depth + 0.05)
		return out.set(h.x, h.y, h.depth + 0.12)
	}

	/**
	 * Lane position at time t. Returns visibility; out receives the position.
	 * Low arcs: height grows with horizontal distance (leaps go higher).
	 */
	_laneAt(lane, t, out) {
		const on = lane.onsets, k = lane.k
		const idx = upperBound(on, t, 'time') - 1
		lane._i = idx
		lane._fade = 1
		lane._park = true // parked/fading on a note (not in flight)
		if (idx < 0) {
			// fade in just before a voice's first note
			if (!on.length) return false
			this._land(on[0], k, out)
			const until = on[0].time - t
			if (until > LANE_ENTER) return false
			lane._fade = 1 - (on[0].time - t) / LANE_ENTER
			return k < on[0].heads.length
		}
		if (idx >= on.length - 1) {
			// voice has ended: linger on the last note, then fade away
			const o = on[on.length - 1], held = t - o.time
			this._land(o, k, out)
			if (held > LANE_HOLD + LANE_FADE) return false
			lane._fade = clamp(1 - (held - LANE_HOLD) / LANE_FADE, 0, 1)
			return k < o.heads.length
		}
		const o0 = on[idx], o1 = on[idx + 1]
		const A = this._land(o0, k, this._v[6]), B = this._land(o1, k, this._v[7])
		const dt = o1.time - o0.time
		lane._park = false
		// long silence in this voice (e.g. a track whose notes moved to the other staff):
		// park on the last note, fade out, and fade back in on the next note instead of
		// hovering for the whole gap
		if (dt > LANE_GAP) {
			const since = t - o0.time, until = o1.time - t
			lane._park = true
			// re-entry: the light simply appears on its next note (no flight from elsewhere)
			if (until < LANE_ENTER) {
				out.copy(B)
				lane._fade = 1 - until / LANE_ENTER
				return k < o1.heads.length
			}
			out.copy(A)
			if (since > LANE_HOLD + LANE_FADE) return false
			lane._fade = clamp(1 - (since - LANE_HOLD) / LANE_FADE, 0, 1)
			return k < o0.heads.length
		}
		const u = clamp((t - o0.time) / dt, 0, 1)
		const dx = Math.hypot(B.x - A.x, B.y - A.y)
		const h = (this.opts.arcMode === 'classic'
			? Math.min(8, 0.35 + dt * 4.5 + dx * 0.12)                  // time-based: long notes bounce high
			: clamp(0.24 * dx + 0.5 * Math.min(dt, 1.5), 0.45, 5)        // distance-based: low steps, high leaps
		) * this.opts.bounce
		out.lerpVectors(A, B, u)
		out[this.view.hop] += h * 4 * u * (1 - u)
		// long gaps (rests): wait on the source note, then leap in during the last 0.6s
		if (this.opts.restMode === 'leap' && dt > 1.2) {
			const fly = Math.min(0.6, dt * 0.5), t0 = o1.time - fly
			if (t < t0) { out.copy(A) } else {
				const v = (t - t0) / fly
				out.lerpVectors(A, B, v)
				out[this.view.hop] += h * 4 * v * (1 - v)
			}
		}
		return k < Math.max(o0.heads.length, o1.heads.length)
	}

	_updateLanes(t, wall, playing) {
		const P = this._v[0], Q = this._v[1], V = this._v[2], X = this._v[3], Y = this._v[4], Z = this._v[5]
		const M = this._tmpM
		const cam = this.camera.position
		const pos = this.streak.geometry.attributes.position.array
		const col = this.streak.geometry.attributes.color.array
		const hopAxis = this.view.hop
		let pools = 0
		const poolC = this._tmpC
		const gain = this.theme.poolGain ?? 1

		this.lanes.forEach((lane, li) => {
			const vis = this._laneAt(lane, t, P)
			const laneFade = lane._fade
			lane.vis = vis && laneFade > 0.01
			lane.pos.copy(P)
			// velocity for motion stretch
			const parked = lane._park
			this._laneAt(lane, t - 1 / 120, Q)
			// no velocity across a park/fade (a light reappearing on its next note is not a jump)
			if (parked || lane._park) V.set(0, 0, 0)
			else V.subVectors(P, Q).multiplyScalar(120)
			const speed = V.length()
			// glowing head: rest pose = flat notehead; in flight = stretched along velocity
			const fade = vis ? laneFade : 0
			if (!vis || fade <= 0.01) M.makeScale(0, 0, 0)
			else if (speed < 2) {
				M.makeRotationZ(0.35).scale(this._v[6].set(fade, fade, fade)).setPosition(P)
			} else {
				X.copy(V).normalize()
				Z.set(0, 0, 1)
				if (hopAxis === 'y' || Math.abs(X.z) > 0.95) Z.set(0, 1, 0).cross(X).normalize()
				Y.crossVectors(Z, X).normalize(); Z.crossVectors(X, Y)
				const st = 1 + Math.min(2.2, speed * 0.035)
				M.makeBasis(X.multiplyScalar(st * fade), Y.multiplyScalar(fade / Math.sqrt(st)), Z.multiplyScalar(fade)).setPosition(P)
			}
			this.heads.setMatrixAt(li, M)

			// light pool under the head
			if (vis && fade > 0.01 && pools < MAX_POOLS) {
				const lift = hopAxis === 'y' ? 0.6 : Math.max(0, P.z - 0.2)
				const s = 3.4 + lift * 0.9
				M.makeScale(s, s, 1).setPosition(P.x, hopAxis === 'y' ? P.y - 0.4 : P.y, 0.012)
				this.pools.setMatrixAt(pools, M)
				this.pools.setColorAt(pools, poolC.copy(lane.color).multiplyScalar(0.75 * gain * fade / (1 + lift * 0.4)))
				pools++
			}

			// streak: hairline comet tail over ~one hop
			if (this.opts.trail) {
				const on = lane.onsets, i = lane._i
				const hopDur = i >= 0 && i < on.length - 1 ? on[i + 1].time - on[i].time : (i > 0 ? on[i].time - on[i - 1].time : 0.3)
				const span = clamp(hopDur * 1.05, 0.12, 0.7)
				const base = li * STREAK_N * 6
				const p = this._sp || (this._sp = Array.from({ length: STREAK_N }, () => new THREE.Vector3()))
				p[0].copy(P); p[0]._vis = vis && laneFade > 0.01
				for (let k = 1; k < STREAK_N; k++) {
					p[k]._vis = this._laneAt(lane, t - (k / (STREAK_N - 1)) * span, p[k]) && lane._fade > 0.01
					// the tail stops where the light was hidden: collapse the rest onto the last visible
					// point so no ribbon quad bridges to a stale or parked position
					if (!p[k]._vis || !p[k - 1]._vis) { p[k]._vis = false; p[k].copy(p[k - 1]) }
				}
				lane._fade = laneFade
				const moving = vis && p[0].distanceToSquared(p[STREAK_N - 1]) > 0.02
				for (let k = 0; k < STREAK_N; k++) {
					const f = 1 - k / (STREAK_N - 1)
					X.subVectors(p[Math.max(0, k - 1)], p[Math.min(STREAK_N - 1, k + 1)])
					Y.subVectors(cam, p[k])
					Z.crossVectors(X, Y)
					const len = Z.length()
					const w = moving && p[k]._vis && len > 1e-6 ? laneFade * (0.012 + 0.2 * Math.pow(f, 1.6)) / len : 0
					Z.multiplyScalar(w)
					const o = base + k * 6
					pos[o] = p[k].x + Z.x; pos[o + 1] = p[k].y + Z.y; pos[o + 2] = p[k].z + Z.z
					pos[o + 3] = p[k].x - Z.x; pos[o + 4] = p[k].y - Z.y; pos[o + 5] = p[k].z - Z.z
					const hot = Math.max(0, 1 - k / (STREAK_N * 0.12)) * 0.6
					const br = 2.2 * Math.pow(f, 0.9)
					const c = lane.color
					col[o] = col[o + 3] = lerp(c.r, 1, hot * 0.8) * br
					col[o + 1] = col[o + 4] = lerp(c.g, 1, hot * 0.8) * br
					col[o + 2] = col[o + 5] = lerp(c.b, 1, hot * 0.8) * br
				}
			}

			// optional FX: sparkles shed by moving heads
			if (this.opts.fx && playing && vis && speed > 2 && Math.random() < 0.5) {
				const c = lane.color, w = Math.random() * 0.6
				const j = () => (Math.random() - 0.5) * 0.6
				this.sparks.spawn(P.x, P.y, P.z, j(), j(), j() + 0.3, 0.4 + Math.random() * 0.6, lerp(c.r, 1, w) * 2.2, lerp(c.g, 1, w) * 2.2, lerp(c.b, 1, w) * 2.2)
				this.sparks._pending = true
				if (Math.random() < 0.15) { this.dust.spawn(P.x, P.y, P.z, j(), j(), j() + 0.2, 1.2 + Math.random(), c.r * 0.22, c.g * 0.22, c.b * 0.22); this.dust._pending = true }
			}
		})
		this.heads.instanceMatrix.needsUpdate = true
		if (this.opts.trail) {
			this.streak.geometry.attributes.position.needsUpdate = true
			this.streak.geometry.attributes.color.needsUpdate = true
		}

		// pools under recently lit noteheads (the notes "light the paper")
		for (const st of this.score.active) {
			if (pools >= MAX_POOLS) break
			const age = wall - st.glowStart
			const g = Math.exp(-age / 0.45)
			if (g < 0.05) continue
			const s = 2.6 + 1.6 * g
			M.makeScale(s, s, 1).setPosition(st.h.x, st.h.y, 0.012)
			this.pools.setMatrixAt(pools, M)
			const pal = this.palette
			this.pools.setColorAt(pools, poolC.set(pal[st.color % pal.length]).multiplyScalar(0.9 * g * gain))
			pools++
		}
		this.pools.count = pools
		this.pools.instanceMatrix.needsUpdate = true
		if (this.pools.instanceColor) this.pools.instanceColor.needsUpdate = true
	}

	_timelineX(t) {
		const tl = this.score.timeline
		if (!tl.length) return 0
		const i = upperBound(tl, t, 'time')
		if (i <= 0) return tl[0].x - 4 * clamp(tl[0].time - t, 0, 1)
		if (i >= tl.length) return tl[tl.length - 1].x
		const a = tl[i - 1], b = tl[i]
		return lerp(a.x, b.x, clamp((t - a.time) / (b.time - a.time), 0, 1))
	}

	/**
	 * Advance the scene to music time t.
	 * @param {number} t - seconds
	 * @param {number} dt - wall-clock delta seconds
	 * @param {boolean} playing
	 */
	update(t, dt, playing, wallTime) {
		if (this._offline && wallTime === undefined) return // exporter owns the stage
		const s = this.score
		// wallTime lets offline export drive flash/ripple timing from music time
		const wall = wallTime ?? performance.now() / 1000
		if (s) {
			const jumped = Math.abs(t - this._lastT) > 0.6 || t < this._lastT - 1e-3
			if (jumped) this._recolorAll(t)

			// Impacts per staff (lights the landed noteheads)
			s.perStaff.forEach((on, si) => {
				if (!on.length) return
				const idx = upperBound(on, t, 'time') - 1
				if (!jumped && idx > s.staffIdx[si]) {
					for (let i = Math.max(s.staffIdx[si] + 1, idx - 3); i <= idx; i++) if (i >= 0) this._impact(si, on[i], wall)
				}
				s.staffIdx[si] = idx
			})

			if (this.tour) this._applyTour(t)
			this._updateCamera(t, dt)
			this._updateLanes(t, wall, playing)

			// Notehead flash decay
			for (const st of s.active) {
				const age = wall - st.glowStart
				const g = Math.exp(-age / 0.3) * (age < 0.05 ? age / 0.05 : 1)
				const level = this._litLevel(st, t)
				const settled = age > 1.5 && (level === 0 || level === 1)
				this._applyHead(st, level, settled ? 0 : g)
				if (settled) s.active.delete(st)
			}
		}

		this._updateFx(wall, dt)
		this._adaptQuality(dt)
		this._lastT = t

		// DOF focus on the lookAt point (the playhead)
		const dofOn = this.opts.dof && QUALITY_TIERS[this.tier].dof
		this.bokehPass.enabled = dofOn
		if (dofOn) {
			const D = this.camera.position.distanceTo(this._lookAt)
			this.bokehPass.uniforms.focus.value = D
			this.bokehPass.uniforms.aperture.value = 0.0095 / D
			this.bokehPass.uniforms.maxblur.value = 0.009
		}
		this.bloomPass.enabled = this.opts.bloom

		const xf = this._xfade
		if (xf && s) {
			if (xf.start == null) xf.start = wall
			const u = (wall - xf.start) / Math.max(0.05, this.opts.fadeDur)
			if (u >= 1) this._xfade = null
			else {
				this._renderOutgoing(xf)
				this.composer.render()
				// dissolve outgoing (smoothstep) over the incoming frame
				const r = this.renderer, q = this._copyQuad
				q.material.uniforms.tDiffuse.value = this.fadeRT.texture
				q.material.uniforms.opacity.value = 1 - u * u * (3 - 2 * u)
				q.material.blending = THREE.NormalBlending
				const ac = r.autoClear
				r.autoClear = false
				r.setRenderTarget(null)
				q.render(r)
				r.autoClear = ac
				return
			}
		}
		this.composer.render()
	}

	/** Render the outgoing view (live, own camera) through the full post chain into fadeRT. */
	_renderOutgoing(xf) {
		const cam = this.fadeCam, P = this._fadePose
		cam.fov = xf.from.fov
		cam.aspect = this.camera.aspect
		cam.near = this.camera.near; cam.far = this.camera.far
		cam.updateProjectionMatrix()
		this._poseFor(xf.from, this._lastFx, P, xf.mouse)
		cam.position.copy(P.pos)
		cam.up.copy(P.up)
		cam.lookAt(P.target)
		const size = this.renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2()))
		if (this.fadeRT.width !== size.x || this.fadeRT.height !== size.y) this.fadeRT.setSize(size.x, size.y)
		const main = this.camera
		this.renderPass.camera = cam
		this.bokehPass.camera = cam
		this.composer.renderToScreen = false
		this.composer.render()
		this.composer.renderToScreen = true
		this.renderPass.camera = main
		this.bokehPass.camera = main
		const q = this._copyQuad
		q.material.uniforms.tDiffuse.value = this.composer.readBuffer.texture
		q.material.uniforms.opacity.value = 1
		q.material.blending = THREE.NoBlending
		this.renderer.setRenderTarget(this.fadeRT)
		q.render(this.renderer)
		this.renderer.setRenderTarget(null)
	}

	/** Adaptive quality tiers (MSAA → resolution → DOF → shadows) keep frames under ~20ms. */
	/** Enter fixed-size, fixed-quality rendering for video export. */
	beginOffline(w, h) {
		this._offline = { w, h, tier: this.tier, pr: this.pixelRatio }
		this.tier = h <= 1200 ? 0 : 1 // MSAA up to ~1080p; at higher res the pixels antialias themselves
		this._snapCamera = true
		this._applyTier()
	}

	endOffline() {
		const off = this._offline
		if (!off) return
		this._offline = null
		this.tier = off.tier
		this._snapCamera = true
		this._applyTier()
	}

	_applyTier() {
		const T = QUALITY_TIERS[this.tier]
		this.pixelRatio = Math.max(0.6, this.maxPixelRatio * T.pr)
		this._msaaOff = !T.msaa
		this._applyShadowCaster()
		this._updateMirror()
		this.resize(false)
	}

	_adaptQuality(dt) {
		if (this._offline || !(dt > 0) || dt > 0.5) return
		this._frameEMA += (dt * 1000 - this._frameEMA) * 0.05
		this._qualityTimer += dt
		const slow = this._frameEMA > 21, fast = this._frameEMA < (this.tier === 1 ? 10 : 13)
		if (slow && this._qualityTimer > 1.5 && this.tier < QUALITY_TIERS.length - 1) this.tier++
		else if (fast && this._qualityTimer > 4 && this.tier > 0) this.tier--
		else return
		this._qualityTimer = 0
		this._applyTier()
	}

	/** Camera pose for view v around focus x (fx). Writes out.{pos,target,up}; returns {D, viewW}. */
	_poseFor(v, fx, out, mouse) {
		const s = this.score
		const fovR = THREE.MathUtils.degToRad(v.fov)
		const D = ((s.height / 2 + 7) / Math.tan(fovR / 2)) / (this.opts.zoom * (v.zoom || 1))
		const viewW = 2 * D * Math.tan(fovR / 2) * this.camera.aspect
		const target = out.target.set(fx + viewW * v.lead, s.centerY, 0)
		if (v.orbit) {
			// mouse x → azimuth around the playhead (±50°), mouse y → elevation (6°…80°)
			const az = mouse.x * 0.9
			const el = THREE.MathUtils.degToRad(lerp(6, 80, (mouse.y + 1) / 2))
			const R = D * this._freeDist
			out.pos.set(target.x + Math.sin(az) * Math.cos(el) * R, target.y - Math.cos(az) * Math.cos(el) * R, Math.sin(el) * R)
			// near top-down, z-up is degenerate: blend toward "up the page" (+y) so the score stays upright
			const e = clamp((mouse.y + 1) / 2, 0, 1)
			out.up.set(0, e * e, 1 - e * e).normalize()
		} else {
			out.pos.set(target.x + v.offset[0] * D, target.y + v.offset[1] * D, v.offset[2] * D)
			out.up.set(...(v.up || [0, 1, 0]))
		}
		return { D, viewW }
	}

	_updateCamera(t, dt) {
		const s = this.score
		const v = this.view
		const vis = this.lanes.filter(l => l.vis)
		const laneX = vis.length ? vis.reduce((a, l) => a + l.pos.x, 0) / vis.length : this._timelineX(t)
		const fx = this._lastFx = laneX * 0.35 + this._timelineX(t) * 0.65
		const { D, viewW } = this._poseFor(v, fx, this._pose, this._mouse)
		if (this._introShot != null) {
			// title shot, then blend into the normal pose over the last 40%
			const ip = this._introP || (this._introP = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3() })
			this._introPose(this._introShot, ip)
			const b = clamp((this._introShot - 0.6) / 0.4, 0, 1), e = b * b * (3 - 2 * b)
			this._pose.pos.lerpVectors(ip.pos, this._pose.pos, e)
			this._pose.target.lerpVectors(ip.target, this._pose.target, e)
			this._pose.up.lerpVectors(ip.up, this._pose.up, e).normalize()
			this._snapCamera = true // pose is fully scripted
		}
		const target = this._camTarget.copy(this._pose.target)
		const k = this._snapCamera ? 1 : 1 - Math.exp(-dt * (v.orbit ? 4 : 6))
		this.camera.position.lerp(this._pose.pos, k)
		if (this._snapCamera) this._lookAt.copy(target)
		else this._lookAt.lerp(target, k)
		this.camera.up.copy(this._pose.up)
		this.camera.lookAt(this._lookAt)
		this._lastFocusX = target.x
		this._snapCamera = false

		this.scene.fog.near = D * (this.theme.fogNear ?? 2.2)
		this.scene.fog.far = D * (this.theme.fogFar ?? 7)

		// Directional key + shadow frustum follow the focus
		const key = this.keyLight
		key.position.set(target.x - 14, target.y + 22, 34)
		key.target.position.set(target.x, target.y, 0)
		const sc = key.shadow.camera
		const half = viewW * 0.75 + 10
		sc.left = -half; sc.right = half; sc.top = s.height + 20; sc.bottom = -s.height - 20
		sc.near = 1; sc.far = 120
		sc.updateProjectionMatrix()

		// Grazing spotlight: from behind-left, low, pooling on the playhead
		const spot = this.spot
		spot.position.set(target.x - viewW * 0.25 - 6, target.y + s.height * 0.9 + 14, 16 + s.height * 0.4)
		spot.target.position.set(target.x + viewW * 0.08, target.y, 0)
		spot.angle = clamp(Math.atan((viewW * 0.55) / spot.position.distanceTo(spot.target.position)), 0.25, 0.9)
		spot.shadow.camera.near = 2
		spot.shadow.camera.far = 200
	}

	_updateFx(wall, dt) {
		dt = Math.min(dt, 0.05)
		for (const r of this.ripples) {
			if (!r.visible) continue
			const a = (wall - r.userData.start) / 0.6
			if (a >= 1) { r.visible = false; continue }
			const sc = 1 + a * 2.6
			r.scale.set(sc, sc, sc)
			r.material.opacity = (1 - a) * (1 - a)
		}
		const up = this.view.hop === 'y' ? 1 : 2
		this.sparks.update(dt, up)
		this.dust.update(dt, up)
	}
}

