/**
 * vector-recorder.js — Turns nwc-viewer's Canvas2D drawing calls into
 * three.js geometry. (From midiviz experiment #025, Notation 3D.)
 *
 * nwc-viewer draws every element through a CanvasRenderingContext2D. Instead
 * of rasterising, we hand its drawing objects a RecorderContext that captures
 * the vector paths (with the current transform applied) and then:
 *   - SMuFL glyphs (opentype Path objects, cached per glyph by nwc-viewer)
 *     become one extruded geometry each, drawn as InstancedMesh — so every
 *     notehead is an instance whose colour/scale we can animate cheaply,
 *   - other fills (beams, ties, slurs) and strokes (staff lines, stems,
 *     barlines, ledgers) are extruded and merged per x-chunk,
 *   - text becomes small canvas-textured quads.
 *
 * World units: 1 = one staff space (fontSize / 4 canvas px), +y up, the page
 * at z = 0 with ink extruded toward +z.
 */
import * as THREE from 'three'

const IDENTITY = [1, 0, 0, 1, 0, 0]

export class RecorderContext {
	constructor(measureCtx) {
		this.__recorder = this
		this.records = []
		this.currentElement = null
		this._measure = measureCtx
		this._stack = []
		this._state = {
			m: IDENTITY.slice(), fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
			font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter',
		}
		this._subs = []
		this._sub = null
		this.canvas = { width: 1e6, height: 1e6, style: {} }
	}

	// ── state ──
	get fillStyle() { return this._state.fillStyle } set fillStyle(v) { this._state.fillStyle = v }
	get strokeStyle() { return this._state.strokeStyle } set strokeStyle(v) { this._state.strokeStyle = v }
	get lineWidth() { return this._state.lineWidth } set lineWidth(v) { this._state.lineWidth = v }
	get globalAlpha() { return this._state.globalAlpha } set globalAlpha(v) { this._state.globalAlpha = v }
	get font() { return this._state.font } set font(v) { this._state.font = v }
	get textAlign() { return this._state.textAlign } set textAlign(v) { this._state.textAlign = v }
	get textBaseline() { return this._state.textBaseline } set textBaseline(v) { this._state.textBaseline = v }
	get lineCap() { return this._state.lineCap } set lineCap(v) { this._state.lineCap = v }
	get lineJoin() { return this._state.lineJoin } set lineJoin(v) { this._state.lineJoin = v }

	save() { this._stack.push({ ...this._state, m: this._state.m.slice() }) }
	restore() { if (this._stack.length) this._state = this._stack.pop() }

	// ── transforms (canvas convention: x' = a x + c y + e, y' = b x + d y + f) ──
	transform(a2, b2, c2, d2, e2, f2) {
		const [a, b, c, d, e, f] = this._state.m
		this._state.m = [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f]
	}
	translate(x, y) { this.transform(1, 0, 0, 1, x, y) }
	scale(x, y) { this.transform(x, 0, 0, y, 0, 0) }
	rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0) }
	setTransform(a, b, c, d, e, f) { this._state.m = typeof a === 'object' ? [a.a, a.b, a.c, a.d, a.e, a.f] : [a, b, c, d, e, f] }
	resetTransform() { this._state.m = IDENTITY.slice() }
	getTransform() { const [a, b, c, d, e, f] = this._state.m; return { a, b, c, d, e, f } }

	_t(x, y) {
		const [a, b, c, d, e, f] = this._state.m
		return [a * x + c * y + e, b * x + d * y + f]
	}

	// ── paths ──
	beginPath() { this._subs = []; this._sub = null }
	moveTo(x, y) { this._sub = { ops: [{ t: 'M', p: this._t(x, y) }], closed: false }; this._subs.push(this._sub) }
	lineTo(x, y) {
		if (!this._sub || this._sub.closed) return this.moveTo(x, y)
		this._sub.ops.push({ t: 'L', p: this._t(x, y) })
	}
	bezierCurveTo(x1, y1, x2, y2, x, y) {
		if (!this._sub) this.moveTo(x1, y1)
		this._sub.ops.push({ t: 'C', c1: this._t(x1, y1), c2: this._t(x2, y2), p: this._t(x, y) })
	}
	quadraticCurveTo(x1, y1, x, y) {
		if (!this._sub) this.moveTo(x1, y1)
		this._sub.ops.push({ t: 'Q', c: this._t(x1, y1), p: this._t(x, y) })
	}
	closePath() {
		if (!this._sub) return
		this._sub.closed = true
		const start = this._sub.ops[0].p
		// Subsequent ops continue from the start point in a new subpath
		this._sub = { ops: [{ t: 'M', p: start }], closed: false }
		this._subs.push(this._sub)
	}
	rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath() }
	arc(x, y, r, a0, a1, ccw = false) { this.ellipse(x, y, r, r, 0, a0, a1, ccw) }
	ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) {
		let sweep = a1 - a0
		if (!ccw && sweep < 0) sweep += Math.PI * 2
		if (ccw && sweep > 0) sweep -= Math.PI * 2
		if (Math.abs(sweep) > Math.PI * 2) sweep = Math.sign(sweep) * Math.PI * 2
		const n = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
		const cr = Math.cos(rot), sr = Math.sin(rot)
		for (let i = 0; i <= n; i++) {
			const a = a0 + sweep * i / n
			const px = Math.cos(a) * rx, py = Math.sin(a) * ry
			const X = x + px * cr - py * sr, Y = y + px * sr + py * cr
			if (i === 0 && (!this._sub || this._sub.closed)) this.moveTo(X, Y)
			else this.lineTo(X, Y)
		}
	}

	_snapshot() {
		return this._subs.filter(s => s.ops.length > 1).map(s => ({ ops: s.ops, closed: s.closed }))
	}
	_scaleFactor() { const [a, b, c, d] = this._state.m; return Math.sqrt(Math.abs(a * d - b * c)) }

	fill() {
		const subs = this._snapshot()
		if (subs.length) this.records.push({ kind: 'fill', subs, el: this.currentElement, color: this._state.fillStyle })
	}
	stroke() {
		const subs = this._snapshot()
		if (subs.length) this.records.push({ kind: 'stroke', subs, width: this._state.lineWidth * this._scaleFactor(), el: this.currentElement, cap: this._state.lineCap })
	}
	fillRect(x, y, w, h) {
		const saved = [this._subs, this._sub]
		this.beginPath(); this.rect(x, y, w, h); this.fill()
		;[this._subs, this._sub] = saved
	}
	strokeRect(x, y, w, h) {
		const saved = [this._subs, this._sub]
		this.beginPath(); this.rect(x, y, w, h); this.stroke()
		;[this._subs, this._sub] = saved
	}
	clearRect() {}
	clip() {}
	setLineDash() {}
	getLineDash() { return [] }
	drawImage() {}
	createLinearGradient() { return { addColorStop() {} } }
	createRadialGradient() { return { addColorStop() {} } }

	fillText(text, x, y) {
		if (text == null || text === '') return
		const s = this._state
		this.records.push({ kind: 'text', text: String(text), x, y, m: s.m.slice(), font: s.font, align: s.textAlign, baseline: s.textBaseline, el: this.currentElement })
	}
	strokeText() {}
	measureText(t) { this._measure.font = this._state.font; return this._measure.measureText(t) }

	/** Called by the patched opentype Path.draw */
	glyph(path) {
		this.records.push({ kind: 'glyph', path, m: this._state.m.slice(), el: this.currentElement })
	}
}

/** Route opentype glyph drawing into the recorder (once). */
export function patchOpentype(opentype) {
	const P = opentype.Path.prototype
	if (P.__recorderPatched) return
	const orig = P.draw
	P.draw = function (ctx) {
		if (ctx && ctx.__recorder) return ctx.__recorder.glyph(this)
		return orig.call(this, ctx)
	}
	P.__recorderPatched = true
}

/**
 * Replays nwc-viewer drawing elements into a recorder.
 * Mirrors Drawing._draw (translate by x/y + offsetX/offsetY, then draw).
 * `font` is the default context font Drawing.draw sets before a pass.
 */
export function recordElements(elements, measureCtx, { font } = {}) {
	const rec = new RecorderContext(measureCtx)
	if (font) rec.font = font
	for (const el of elements) {
		rec.currentElement = el
		rec.save()
		rec.translate(el.x || 0, el.y || 0)
		rec.translate(el.offsetX || 0, el.offsetY || 0)
		try { el.draw(rec) } catch (e) { console.warn('draw failed for', el?.constructor?.name, e) }
		rec.restore()
	}
	return rec.records
}

// ── geometry building ───────────────────────────────────────────────────────

function opsToShapePath(subs, S, transform) {
	const sp = new THREE.ShapePath()
	const P = p => transform ? transform(p) : [p[0] * S, -p[1] * S]
	for (const sub of subs) {
		for (const op of sub.ops) {
			const [x, y] = P(op.p)
			if (op.t === 'M') sp.moveTo(x, y)
			else if (op.t === 'L') sp.lineTo(x, y)
			else if (op.t === 'C') { const a = P(op.c1), b = P(op.c2); sp.bezierCurveTo(a[0], a[1], b[0], b[1], x, y) }
			else if (op.t === 'Q') { const a = P(op.c); sp.quadraticCurveTo(a[0], a[1], x, y) }
		}
	}
	return sp
}

/** Shapes with holes, choosing the winding of the largest contour as "solid". */
function shapePathToShapes(sp) {
	const paths = sp.subPaths.filter(p => p.curves.length)
	if (!paths.length) return []
	let largest = null, area = 0
	for (const p of paths) {
		const a = Math.abs(THREE.ShapeUtils.area(p.getPoints()))
		if (a > area) { area = a; largest = p }
	}
	if (!largest || area < 1e-8) return []
	sp.subPaths = paths
	const cw = THREE.ShapeUtils.isClockWise(largest.getPoints())
	return sp.toShapes(!cw)
}

function glyphOpsFromPath(path) {
	// opentype Path commands → our op format, in glyph-local canvas coords
	const subs = []
	let sub = null
	for (const c of path.commands) {
		if (c.type === 'M') { sub = { ops: [{ t: 'M', p: [c.x, c.y] }] }; subs.push(sub) }
		else if (c.type === 'L') sub?.ops.push({ t: 'L', p: [c.x, c.y] })
		else if (c.type === 'C') sub?.ops.push({ t: 'C', c1: [c.x1, c.y1], c2: [c.x2, c.y2], p: [c.x, c.y] })
		else if (c.type === 'Q') sub?.ops.push({ t: 'Q', c: [c.x1, c.y1], p: [c.x, c.y] })
	}
	return subs
}

function flatten(sub, S) {
	const pts = []
	let prev = null
	for (const op of sub.ops) {
		const p = [op.p[0] * S, -op.p[1] * S]
		if (op.t === 'C' || op.t === 'Q') {
			const c1 = op.t === 'C' ? op.c1 : op.c, c2 = op.t === 'C' ? op.c2 : op.c
			const p0 = prev
			for (let i = 1; i <= 10; i++) {
				const t = i / 10, u = 1 - t
				const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] * S + 3 * u * t * t * c2[0] * S + t * t * t * p[0]
				const y = u * u * u * p0[1] + 3 * u * u * t * -c1[1] * S + 3 * u * t * t * -c2[1] * S + t * t * t * p[1]
				pts.push([x, y])
			}
		} else pts.push(p)
		prev = p
	}
	if (sub.closed && pts.length > 2) pts.push(pts[0])
	return pts
}

function segmentShape(a, b, w, extend) {
	let dx = b[0] - a[0], dy = b[1] - a[1]
	const len = Math.hypot(dx, dy)
	if (len < 1e-5 || w < 1e-5) return null
	dx /= len; dy /= len
	const ex = dx * extend, ey = dy * extend
	const nx = -dy * w / 2, ny = dx * w / 2
	return new THREE.Shape([
		new THREE.Vector2(a[0] - ex + nx, a[1] - ey + ny),
		new THREE.Vector2(b[0] + ex + nx, b[1] + ey + ny),
		new THREE.Vector2(b[0] + ex - nx, b[1] + ey - ny),
		new THREE.Vector2(a[0] - ex - nx, a[1] - ey - ny),
	])
}

function firstX(subs, S) { return subs[0].ops[0].p[0] * S }

const textCache = new Map()
function textTexture(text, font) {
	const key = font + '|' + text
	if (textCache.has(key)) return textCache.get(key)
	const R = 3
	const c = document.createElement('canvas')
	const g = c.getContext('2d')
	g.font = font
	const m = g.measureText(text)
	const asc = m.actualBoundingBoxAscent || parseFloat(font) * 0.8 || 10
	const desc = m.actualBoundingBoxDescent || parseFloat(font) * 0.2 || 3
	const pad = 2
	c.width = Math.ceil((m.width + pad * 2) * R)
	c.height = Math.ceil((asc + desc + pad * 2) * R)
	g.scale(R, R)
	g.font = font
	g.fillStyle = '#fff'
	g.textBaseline = 'alphabetic'
	g.fillText(text, pad, pad + asc)
	const tex = new THREE.CanvasTexture(c)
	tex.colorSpace = THREE.SRGBColorSpace
	tex.anisotropy = 4
	const entry = { tex, width: m.width, asc, desc, pad }
	textCache.set(key, entry)
	return entry
}

/**
 * Build three.js objects for a recorded score.
 *
 * @param {Array} records - from recordElements
 * @param {object} opts - { fontSize, materials: {staff, ink, glyph, text}, chunk }
 * @returns {{ group, glyphMeshes, heads: Map, bounds, setInkColor }}
 */
export function buildScoreMeshes(records, { fontSize, materials, chunk = 40 }) {
	const S = 4 / fontSize
	const group = new THREE.Group()
	group.name = 'score'

	// Thin, printed-looking ink: barely raised off the page (embossed print)
	const DEPTH = { staff: 0.02, ink: 0.05, glyph: 0.07, notehead: 0.09 }
	const buckets = new Map() // key → { staff: [], ink: [] }
	const bucket = x => {
		const k = Math.floor(x / chunk)
		if (!buckets.has(k)) buckets.set(k, { staff: [], ink: [] })
		return buckets.get(k)
	}
	const glyphs = new Map() // opentype path → { instances: [] }
	const bounds = new THREE.Box2(new THREE.Vector2(Infinity, Infinity), new THREE.Vector2(-Infinity, -Infinity))
	const grow = (x, y) => { bounds.min.x = Math.min(bounds.min.x, x); bounds.min.y = Math.min(bounds.min.y, y); bounds.max.x = Math.max(bounds.max.x, x); bounds.max.y = Math.max(bounds.max.y, y) }

	for (const r of records) {
		const cat = r.el?.constructor?.name === 'Stave' ? 'staff' : 'ink'
		if (r.kind === 'fill') {
			for (const s of shapePathToShapes(opsToShapePath(r.subs, S))) bucket(firstX(r.subs, S))[cat].push(s)
		} else if (r.kind === 'stroke') {
			const w = Math.max(r.width * S, 0.02)
			for (const sub of r.subs) {
				const pts = flatten(sub, S)
				for (let i = 0; i < pts.length - 1; i++) {
					const sh = segmentShape(pts[i], pts[i + 1], w, cat === 'staff' ? 0 : w * 0.25)
					if (sh) { bucket(pts[i][0])[cat].push(sh); grow(pts[i][0], pts[i][1]); grow(pts[i + 1][0], pts[i + 1][1]) }
				}
			}
		} else if (r.kind === 'glyph') {
			if (!glyphs.has(r.path)) {
				const name = r.el?.name || ''
				glyphs.set(r.path, { instances: [], isHead: name.startsWith('notehead'), name })
			}
			glyphs.get(r.path).instances.push(r)
		} else if (r.kind === 'text') {
			group.add(makeTextMesh(r, S, materials.text))
		}
	}

	// Merged extrusions per chunk
	for (const [, b] of buckets) {
		for (const cat of ['staff', 'ink']) {
			if (!b[cat].length) continue
			const geo = new THREE.ExtrudeGeometry(b[cat], { depth: DEPTH[cat], bevelEnabled: false, curveSegments: 6 })
			const mesh = new THREE.Mesh(geo, materials[cat])
			mesh.castShadow = cat === 'ink'
			mesh.receiveShadow = true
			group.add(mesh)
		}
	}

	// Instanced glyphs (one geometry per glyph, one InstancedMesh per glyph per chunk)
	const heads = new Map()
	const glyphMeshes = []
	const mat4 = new THREE.Matrix4()
	for (const [path, info] of glyphs) {
		const subs = glyphOpsFromPath(path)
		if (!subs.length) continue
		const shapes = shapePathToShapes(opsToShapePath(subs, S))
		if (!shapes.length) continue
		const depth = info.isHead ? DEPTH.notehead : DEPTH.glyph
		const bevel = Math.min(0.02, depth * 0.25)
		const geo = new THREE.ExtrudeGeometry(shapes, {
			depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.012, bevelSegments: 1, curveSegments: info.isHead ? 10 : 6,
		})
		geo.translate(0, 0, bevel)
		const bb = path.getBoundingBox()
		const byChunk = new Map()
		for (const inst of info.instances) {
			const k = Math.floor(inst.m[4] * S / chunk)
			if (!byChunk.has(k)) byChunk.set(k, [])
			byChunk.get(k).push(inst)
		}
		for (const [, list] of byChunk) {
			const mesh = new THREE.InstancedMesh(geo, info.isHead && materials.head ? materials.head : materials.glyph, list.length)
			mesh.castShadow = true
			mesh.receiveShadow = true
			mesh.userData.isHead = info.isHead
			list.forEach((inst, i) => {
				const [a, b, c, d, e, f] = inst.m
				mat4.set(a, -c, 0, e * S, -b, d, 0, -f * S, 0, 0, 1, 0, 0, 0, 0, 1)
				mesh.setMatrixAt(i, mat4)
				mesh.setColorAt(i, materials.inkColor)
				// glyph bbox (canvas-local) → world
				const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2
				const wx = (a * cx + c * cy + e) * S, wy = -(b * cx + d * cy + f) * S
				const top = -(b * cx + d * bb.y1 + f) * S
				const bottom = -(b * cx + d * bb.y2 + f) * S
				grow(wx, top); grow(wx, bottom)
				if (info.isHead && inst.el) {
					heads.set(inst.el, { mesh, index: i, matrix: mat4.clone(), x: wx, y: wy, top, bottom, depth, halfWidth: (bb.x2 - bb.x1) * 0.5 * Math.abs(a) * S })
				}
			})
			mesh.instanceMatrix.needsUpdate = true
			mesh.instanceColor.needsUpdate = true
			mesh.computeBoundingSphere()
			group.add(mesh)
			glyphMeshes.push(mesh)
		}
	}

	function setInkColor(color) {
		for (const mesh of glyphMeshes) {
			for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, color)
			mesh.instanceColor.needsUpdate = true
		}
	}

	return { group, glyphMeshes, heads, bounds, setInkColor, scale: S }
}

function makeTextMesh(r, S, material) {
	const { tex, width, asc, desc, pad } = textTexture(r.text, r.font)
	const align = r.align === 'center' ? 0.5 : (r.align === 'right' || r.align === 'end') ? 1 : 0
	let baseY = r.y
	if (r.baseline === 'top' || r.baseline === 'hanging') baseY += asc
	else if (r.baseline === 'middle') baseY += (asc - desc) / 2
	else if (r.baseline === 'bottom' || r.baseline === 'ideographic') baseY -= desc
	const x0 = r.x - width * align - pad, x1 = x0 + width + pad * 2
	const y0 = baseY - asc - pad, y1 = baseY + desc + pad
	const [a, b, c, d, e, f] = r.m
	const W = (x, y) => [(a * x + c * y + e) * S, -(b * x + d * y + f) * S]
	const p = [W(x0, y1), W(x1, y1), W(x1, y0), W(x0, y0)]
	const geo = new THREE.BufferGeometry()
	const z = 0.03
	geo.setAttribute('position', new THREE.Float32BufferAttribute([p[0][0], p[0][1], z, p[1][0], p[1][1], z, p[2][0], p[2][1], z, p[3][0], p[3][1], z], 3))
	geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
	geo.setIndex([0, 1, 2, 0, 2, 3])
	geo.computeVertexNormals()
	const mat = material.clone()
	mat.map = tex
	const mesh = new THREE.Mesh(geo, mat)
	mesh.userData.isText = true
	return mesh
}
