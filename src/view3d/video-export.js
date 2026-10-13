/**
 * video-export.js — offline (non-realtime) video export for the notation stage.
 *
 * Every frame is rendered at a fixed timestep, so output is perfectly smooth at
 * any resolution (incl. 4K60) regardless of how fast the GPU is. Audio is
 * rendered offline too, by a dedicated OxiSynth instance whose `render()` is
 * driven sample-accurately from the same note schedule — so A/V sync is exact.
 *
 * Encoding: WebCodecs (VideoEncoder / AudioEncoder) → mp4-muxer → MP4.
 * When the File System Access API is available the file streams straight to
 * disk (no RAM ceiling for long 4K exports); otherwise it is buffered in memory.
 */
import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from '../../vendor/mp4-muxer-5.1.3/mp4-muxer.mjs'

const SAMPLE_RATE = 48000

const VIDEO_CODECS = [
	{ codec: 'avc1.640034', mux: 'avc' }, // H.264 High @ 5.2 (4K60)
	{ codec: 'avc1.640033', mux: 'avc' }, // 5.1
	{ codec: 'avc1.64002A', mux: 'avc' }, // 4.2 (1080p60)
	{ codec: 'vp09.00.51.08', mux: 'vp9' },
	{ codec: 'av01.0.13M.08', mux: 'av1' },
]
const AUDIO_CODECS = [
	{ codec: 'mp4a.40.2', mux: 'aac' },
	{ codec: 'opus', mux: 'opus' },
]

export function exportSupported() {
	return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

/** Default bitrate (bits/s) by pixel rate. ~0.1 bit per pixel per frame for H.264. */
export function defaultBitrate(w, h, fps) {
	return Math.round(Math.min(80e6, Math.max(6e6, w * h * fps * 0.09)))
}

async function pickVideoCodec(w, h, fps, bitrate) {
	for (const c of VIDEO_CODECS) {
		const config = { codec: c.codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality' }
		if (c.mux === 'avc') config.avc = { format: 'avc' }
		try {
			const r = await VideoEncoder.isConfigSupported(config)
			if (r.supported) return { ...c, config: r.config }
		} catch { /* try next */ }
	}
	throw new Error(`No supported video encoder for ${w}×${h}@${fps}`)
}

async function pickAudioCodec() {
	if (typeof AudioEncoder === 'undefined') return null
	for (const c of AUDIO_CODECS) {
		const config = { codec: c.codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192000 }
		try {
			const r = await AudioEncoder.isConfigSupported(config)
			if (r.supported) return { ...c, config: r.config }
		} catch { /* try next */ }
	}
	return null
}

/**
 * Offline synth: OxiSynthRaw fed by a sorted event list, rendered on demand.
 */
class OfflineSynth {
	static async create({ vendorPath, soundfonts, convertSF3, schedule, programs, volume }) {
		const mod = await import(`${vendorPath}/oxisynth/oxisynth.js`)
		await mod.default()
		const synth = new mod.OxiSynthRaw(SAMPLE_RATE)
		for (const path of soundfonts) {
			const res = await fetch(path)
			if (!res.ok) throw new Error(`Soundfont ${path}: HTTP ${res.status}`)
			let data = new Uint8Array(await res.arrayBuffer())
			if (path.endsWith('.sf3')) {
				if (!convertSF3) throw new Error('SF3 soundfonts need conversion; choose an SF2 sound for export')
				data = await convertSF3(data)
			}
			synth.add_soundfont(data)
		}
		for (const [ch, prog] of programs) synth.program_change(ch, prog)
		const vol = Math.round(volume * 127)  // CC 7, as the live player sends it (PlaybackController)
		for (let ch = 0; ch < 16; ch++) synth.control_change(ch, 7, vol)
		return new OfflineSynth(synth, schedule)
	}

	constructor(synth, { notes, controlChanges }) {
		this.synth = synth
		const ev = []
		for (const n of notes) {
			ev.push({ t: n.time, k: 2, ch: n.channel, a: n.midi, b: Math.max(1, Math.round(n.velocity * 127)) })
			ev.push({ t: n.time + Math.max(0.01, n.duration), k: 0, ch: n.channel, a: n.midi })
		}
		for (const c of controlChanges || []) ev.push({ t: c.time, k: 1, ch: c.channel, a: c.controller, b: c.value })
		// time, then note-off < cc < note-on so re-struck notes retrigger cleanly
		ev.sort((p, q) => p.t - q.t || p.k - q.k)
		this.events = ev
		this.next = 0
		this.frame = 0 // frames rendered so far (relative to the synth's t=0)
	}

	_fire(e) {
		const s = this.synth
		if (e.k === 2) s.note_on(e.ch, e.a, e.b)
		else if (e.k === 0) s.note_off(e.ch, e.a)
		else s.control_change(e.ch, e.a, e.b)
	}

	/** Skip silently to time t (events before t are applied, notes released). */
	seek(t) {
		const ev = this.events
		while (this.next < ev.length && ev[this.next].t < t) {
			const e = ev[this.next++]
			if (e.k === 1) this._fire(e) // keep controller state (sustain, expression)
		}
		for (let ch = 0; ch < 16; ch++) this.synth.all_sound_off(ch)
		this.frame = Math.round(t * SAMPLE_RATE)
	}

	/** Render up to absolute frame `endFrame`; returns planar Float32Array [L..., R...]. */
	renderTo(endFrame) {
		const total = endFrame - this.frame
		const out = new Float32Array(Math.max(0, total) * 2)
		let written = 0
		const ev = this.events
		while (this.frame < endFrame) {
			// fire everything due at the current frame
			while (this.next < ev.length && Math.round(ev[this.next].t * SAMPLE_RATE) <= this.frame) this._fire(ev[this.next++])
			const nextEv = this.next < ev.length ? Math.round(ev[this.next].t * SAMPLE_RATE) : Infinity
			const n = Math.min(endFrame, nextEv, this.frame + 4096) - this.frame
			const buf = this.synth.render(n) // interleaved stereo
			for (let i = 0; i < n; i++) {
				out[written + i] = buf[i * 2]
				out[total + written + i] = buf[i * 2 + 1]
			}
			written += n
			this.frame += n
		}
		return out
	}

	dispose() { try { this.synth.free() } catch { /* ignore */ } }
}

/**
 * Intro title card, drawn with Canvas2D over a dimmed still of the opening shot.
 * k = progress through the card (0..1); secs = card length.
 */
export function drawTitleCard(g, w, h, k, secs, { title, subtitle, credit, style }) {
	const t = k * secs
	const fadeIn = clamp01((t - 0.15) / 0.8)                 // text in
	const fadeOut = clamp01((secs - t) / 0.7)                // whole card out (scene revealed)
	const black = clamp01(1 - t / 0.45)                      // start from black
	const a = Math.min(fadeIn, fadeOut)
	if (style === '3d') return drawTitleOverlay3D(g, w, h, t, secs, { subtitle, credit, black })
	// dim + vignette the scene behind the card
	g.fillStyle = `rgba(0,0,0,${Math.max(black, 0.62 * fadeOut)})`
	g.fillRect(0, 0, w, h)
	const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75)
	vg.addColorStop(0, 'rgba(0,0,0,0)')
	vg.addColorStop(1, `rgba(0,0,0,${0.55 * fadeOut})`)
	g.fillStyle = vg
	g.fillRect(0, 0, w, h)
	if (a <= 0) return
	const S = Math.min(w, h)
	const cy = h * 0.47
	const rise = (1 - easeOut(fadeIn)) * S * 0.02
	g.save()
	g.globalAlpha = a
	g.textAlign = 'center'
	g.textBaseline = 'alphabetic'
	// title — shrink to fit 86% of the width
	let fs = S * 0.105
	const font = px => `600 ${px}px Georgia, 'Times New Roman', serif`
	g.font = font(fs)
	const maxW = w * 0.86
	const tw = g.measureText(title).width
	if (tw > maxW) { fs *= maxW / tw; g.font = font(fs) }
	g.shadowColor = 'rgba(255, 190, 110, 0.85)'
	g.shadowBlur = S * 0.035
	g.fillStyle = '#ffe9c9'
	g.fillText(title, w / 2, cy + rise)
	g.shadowBlur = 0
	// rule
	const ruleW = Math.min(maxW, Math.max(g.measureText(title).width * 0.6, S * 0.25)) * easeOut(fadeIn)
	const lg = g.createLinearGradient(w / 2 - ruleW / 2, 0, w / 2 + ruleW / 2, 0)
	lg.addColorStop(0, 'rgba(255,200,130,0)'); lg.addColorStop(0.5, 'rgba(255,200,130,0.9)'); lg.addColorStop(1, 'rgba(255,200,130,0)')
	g.fillStyle = lg
	g.fillRect(w / 2 - ruleW / 2, cy + fs * 0.32 + rise, ruleW, Math.max(1, S * 0.0025))
	if (subtitle) {
		g.font = `italic ${S * 0.042}px Georgia, 'Times New Roman', serif`
		g.fillStyle = 'rgba(235, 220, 195, 0.88)'
		g.fillText(subtitle, w / 2, cy + fs * 0.32 + S * 0.075 + rise)
	}
	if (credit) {
		g.font = `${S * 0.022}px system-ui, sans-serif`
		g.fillStyle = 'rgba(210, 190, 160, 0.55)'
		g.fillText(credit, w / 2, h - S * 0.07)
	}
	g.restore()
}
const clamp01 = x => Math.max(0, Math.min(1, x))
const easeOut = x => 1 - (1 - x) * (1 - x)

/** 2D layer for the 3D-title intro: fade from black, letterbox vignette, subtitle in the lower third. */
function drawTitleOverlay3D(g, w, h, t, secs, { subtitle, credit, black }) {
	const S = Math.min(w, h)
	const out = clamp01((secs - t) / 1.2)
	g.fillStyle = `rgba(0,0,0,${black})`
	g.fillRect(0, 0, w, h)
	const vg = g.createRadialGradient(w / 2, h / 2, S * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
	vg.addColorStop(0, 'rgba(0,0,0,0)')
	vg.addColorStop(1, `rgba(0,0,0,${0.5 * out})`)
	g.fillStyle = vg
	g.fillRect(0, 0, w, h)
	const a = Math.min(clamp01((t - 0.9) / 0.8), clamp01((secs * 0.62 - t) / 0.6))
	if (a <= 0) return
	g.save()
	g.globalAlpha = a
	g.textAlign = 'center'
	if (subtitle) {
		g.font = `italic ${S * 0.042}px Georgia, 'Times New Roman', serif`
		g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = S * 0.02
		g.fillStyle = 'rgba(240, 226, 200, 0.92)'
		g.fillText(subtitle, w / 2, h * 0.8)
		g.shadowBlur = 0
	}
	if (credit) {
		g.font = `${S * 0.022}px system-ui, sans-serif`
		g.fillStyle = 'rgba(210, 190, 160, 0.55)'
		g.fillText(credit, w / 2, h - S * 0.07)
	}
	g.restore()
}

/**
 * Outro / credits card: the scene keeps drifting while it dims, title and
 * credit lines stagger in, then everything fades to black.
 * credits: [{role, name}] — role may be '' for a plain line.
 */
export function drawOutroCard(g, w, h, k, secs, { title, subtitle, credits = [] }) {
	const t = k * secs
	const dim = clamp01(t / 1.2)                              // scene dims in
	const black = clamp01((t - (secs - 1.1)) / 1.0)           // final fade to black
	g.fillStyle = `rgba(0,0,0,${0.7 * dim + 0.3 * black})`
	g.fillRect(0, 0, w, h)
	const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75)
	vg.addColorStop(0, 'rgba(0,0,0,0)')
	vg.addColorStop(1, `rgba(0,0,0,${0.6 * dim})`)
	g.fillStyle = vg
	g.fillRect(0, 0, w, h)
	const S = Math.min(w, h)
	const lines = credits.filter(c => c && (c.role || c.name))
	const lineH = S * 0.05
	const blockH = S * 0.12 + (subtitle ? S * 0.06 : 0) + S * 0.05 + lines.length * lineH
	let y = h / 2 - blockH / 2 + S * 0.06
	const appear = (delay) => clamp01((t - delay) / 0.7) * (1 - black)
	g.save()
	g.textAlign = 'center'
	g.textBaseline = 'alphabetic'
	// title
	let a = appear(0.5)
	if (a > 0) {
		let fs = S * 0.075
		const font = px => `600 ${px}px Georgia, 'Times New Roman', serif`
		g.font = font(fs)
		const tw = g.measureText(title).width, maxW = w * 0.86
		if (tw > maxW) { fs *= maxW / tw; g.font = font(fs) }
		g.globalAlpha = a
		g.shadowColor = 'rgba(255, 190, 110, 0.8)'
		g.shadowBlur = S * 0.03
		g.fillStyle = '#ffe9c9'
		g.fillText(title, w / 2, y + (1 - easeOut(a)) * S * 0.015)
		g.shadowBlur = 0
	}
	y += S * 0.06
	if (subtitle) {
		a = appear(0.8)
		g.globalAlpha = a
		g.font = `italic ${S * 0.036}px Georgia, 'Times New Roman', serif`
		g.fillStyle = 'rgba(235, 220, 195, 0.9)'
		g.fillText(subtitle, w / 2, y)
		y += S * 0.06
	}
	// rule
	a = appear(1.0)
	const ruleW = S * 0.3 * easeOut(a)
	const lg = g.createLinearGradient(w / 2 - ruleW / 2, 0, w / 2 + ruleW / 2, 0)
	lg.addColorStop(0, 'rgba(255,200,130,0)'); lg.addColorStop(0.5, 'rgba(255,200,130,0.85)'); lg.addColorStop(1, 'rgba(255,200,130,0)')
	g.globalAlpha = a
	g.fillStyle = lg
	g.fillRect(w / 2 - ruleW / 2, y - S * 0.01, ruleW, Math.max(1, S * 0.0022))
	y += S * 0.05
	// credit lines: "role  name" — role right-aligned, name left-aligned around the centre
	lines.forEach((c, i) => {
		a = appear(1.3 + i * 0.25)
		if (a <= 0) return
		g.globalAlpha = a
		const yy = y + i * lineH + (1 - easeOut(a)) * S * 0.01
		if (c.role && c.name) {
			g.font = `${S * 0.024}px system-ui, sans-serif`
			g.fillStyle = 'rgba(210, 190, 160, 0.7)'
			g.textAlign = 'right'
			g.fillText(c.role.toUpperCase(), w / 2 - S * 0.02, yy)
			g.font = `${S * 0.032}px Georgia, 'Times New Roman', serif`
			g.fillStyle = 'rgba(245, 232, 210, 0.95)'
			g.textAlign = 'left'
			g.fillText(c.name, w / 2 + S * 0.02, yy)
			g.textAlign = 'center'
		} else {
			g.font = `${S * 0.03}px Georgia, 'Times New Roman', serif`
			g.fillStyle = 'rgba(240, 225, 200, 0.9)'
			g.fillText(c.role || c.name, w / 2, yy)
		}
	})
	g.restore()
}

/**
 * @param {object} o
 * @param {NotationStage} o.stage
 * @param {{schedule, programs, duration, title}} o.song
 * @param {number} o.width, o.height, o.fps, o.start, o.end - seconds (music time)
 * @param {{views:string[], segment:number, random?:boolean}|null} o.tour - rotate camera views during the export
 * @param {'glide'|'crossfade'|'cut'} [o.transition] - view-change style during the export
 * @param {{seconds:number, title:string, subtitle?:string, credit?:string}|null} [o.intro] - title card
 * @param {{seconds:number, title:string, subtitle?:string, credits:{role,name}[], music?:'ring'|'fade'}|null} [o.outro]
 *        - credits card; music 'ring' = after the end, 'fade' = overlaps the ending while the music fades out
 * @param {boolean} o.audio
 * @param {object} o.audioOpts - { vendorPath, soundfonts, convertSF3, volume }
 * @param {FileSystemWritableFileStream|null} o.fileStream - stream to write to (else buffered)
 * @param {(p:{frame,frames,phase})=>void} o.onProgress
 * @param {AbortSignal} o.signal
 * @returns {Promise<Blob|null>} blob when buffered, null when streamed to disk
 */
export async function exportVideo(o) {
	const { stage, song, fps, signal } = o
	const width = o.width & ~1, height = o.height & ~1
	const bitrate = o.bitrate || defaultBitrate(width, height, fps)
	const preroll = o.preroll ?? 1, tail = o.tail ?? 2
	const t0 = o.start - preroll
	const t1 = Math.min(song.duration + tail, o.end + (o.end >= song.duration ? tail : 0))
	const musicFrames = Math.max(1, Math.round((t1 - t0) * fps))
	const introFrames = o.intro?.seconds > 0 ? Math.round(o.intro.seconds * fps) : 0
	const outroFade = o.outro?.music === 'fade'
	const outroFrames = o.outro?.seconds > 0 ? Math.min(Math.round(o.outro.seconds * fps), outroFade ? musicFrames : Infinity) : 0
	// music can start while the intro is still fading out (overlap)
	const overlapFrames = introFrames && o.intro.overlap ? Math.round(Math.min(o.intro.seconds * 0.45, 2.5) * fps) : 0
	const musicStart = introFrames - overlapFrames
	const frames = musicStart + musicFrames + (outroFade ? 0 : outroFrames)
	// 'fade': credits start outroFrames before the end and the music fades out under them
	const outroStart = musicStart + musicFrames - (outroFade ? outroFrames : 0)
	const fadeA = Math.round(outroStart * SAMPLE_RATE / fps), fadeB = Math.round((outroStart + outroFrames) * SAMPLE_RATE / fps)
	const intro3D = o.intro?.style === '3d' && stage.titleMesh
	const introSamples = Math.round(musicStart * SAMPLE_RATE / fps)

	const vc = await pickVideoCodec(width, height, fps, bitrate)
	const ac = o.audio ? await pickAudioCodec() : null
	if (o.audio && !ac) console.warn('[export] no audio encoder available — exporting video only')

	const target = o.fileStream ? new FileSystemWritableFileStreamTarget(o.fileStream) : new ArrayBufferTarget()
	const muxer = new Muxer({
		target,
		video: { codec: vc.mux, width, height, frameRate: fps },
		audio: ac ? { codec: ac.mux, numberOfChannels: 2, sampleRate: SAMPLE_RATE } : undefined,
		fastStart: o.fileStream ? false : 'in-memory',
		firstTimestampBehavior: 'offset',
	})

	let encError = null
	const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { encError = e } })
	venc.configure(vc.config)
	let aenc = null, synth = null
	if (ac) {
		aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { encError = e } })
		aenc.configure(ac.config)
		synth = await OfflineSynth.create({ ...o.audioOpts, schedule: song.schedule, programs: song.programs })
		synth.seek(Math.max(0, t0))
	}

	const yieldUI = () => new Promise(r => setTimeout(r, 0))
	const startWall = performance.now()
	const prevTour = stage.tour, prevTransition = stage.opts.transition, prevView = stage.opts.view
	if (o.tour) stage.setTour({ ...o.tour, t0: o.start })
	if (o.transition) stage.opts.transition = o.transition
	// 2D canvas for compositing the title card over the WebGL frame
	let card = null
	if (introFrames || outroFrames) {
		card = document.createElement('canvas')
		card.width = width; card.height = height
		card.g = card.getContext('2d')
	}
	const prevTitle = stage.titleText
	if (intro3D && o.intro.title && o.intro.title !== prevTitle) await stage.setTitle(o.intro.title)
	stage.beginOffline(width, height)
	let musicFrame = Math.round(t0 * SAMPLE_RATE) // synth timeline; may be negative (pre-roll silence)
	let audioTs = 0                                // samples encoded so far (output timeline)
	try {
		for (let i = 0; i < frames; i++) {
			if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
			if (encError) throw encError
			const inIntro = i < introFrames
			const outroI = outroFrames ? i - outroStart : -1
			const inOutro = outroI >= 0
			// music time: frozen during the intro; keeps running in the outro so the camera drifts on
			const t = i < musicStart ? t0 : t0 + (i - musicStart) / fps
			const introK = inIntro ? (i + 0.5) / introFrames : null
			if (intro3D) stage.setIntroShot(introK)
			stage.update(t, 1 / fps, i >= musicStart && !(inOutro && !outroFade), t)
			let src = stage.renderer.domElement
			if (inIntro || inOutro) {
				const g = card.g
				g.drawImage(src, 0, 0, width, height)
				if (inIntro) drawTitleCard(g, width, height, introK, o.intro.seconds, { ...o.intro, style: intro3D ? '3d' : '2d' })
				else drawOutroCard(g, width, height, (outroI + 0.5) / outroFrames, o.outro.seconds, o.outro)
				src = card
			}
			const frame = new VideoFrame(src, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) })
			venc.encode(frame, { keyFrame: i % (fps * 2) === 0 })
			frame.close()

			// audio up to the end of this video frame (silence during the intro card)
			if (aenc) {
				const target = Math.round((i + 1) * SAMPLE_RATE / fps)
				while (audioTs < target) {
					let n, data
					if (audioTs < introSamples) {
						n = Math.min(target, introSamples, audioTs + 4800) - audioTs
						data = new Float32Array(n * 2)
					} else {
						n = Math.min(target - audioTs, 4800)
						const chunkEnd = musicFrame + n
						if (chunkEnd <= 0) data = new Float32Array(n * 2) // pre-roll before t=0
						else if (musicFrame < 0) { // straddles t=0
							const pad = -musicFrame
							const rest = synth.renderTo(chunkEnd)
							data = new Float32Array(n * 2)
							data.set(rest.subarray(0, n - pad), pad)
							data.set(rest.subarray(n - pad), n + pad)
						} else data = synth.renderTo(chunkEnd)
						musicFrame = chunkEnd
						// fade the music out under the credits (equal-power cosine)
						if (outroFade && audioTs + n > fadeA) {
							for (let j = 0; j < n; j++) {
								const x = clamp01((audioTs + j - fadeA) / Math.max(1, fadeB - fadeA))
								const gn = Math.cos(x * Math.PI / 2)
								data[j] *= gn; data[n + j] *= gn
							}
						}
					}
					const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(audioTs * 1e6 / SAMPLE_RATE), data })
					aenc.encode(ad)
					ad.close()
					audioTs += n
				}
			}

			// back-pressure + keep the UI responsive
			while (venc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2))
			if (i % 2 === 0) {
				const el = (performance.now() - startWall) / 1000
				o.onProgress?.({ frame: i + 1, frames, elapsed: el, eta: el / (i + 1) * (frames - i - 1), codec: vc.codec, audioCodec: ac?.codec })
				await yieldUI()
			}
		}
		o.onProgress?.({ frame: frames, frames, phase: 'finalizing' })
		await venc.flush()
		if (aenc) await aenc.flush()
		if (encError) throw encError
		muxer.finalize()
		if (o.fileStream) { await o.fileStream.close(); return null }
		return new Blob([target.buffer], { type: 'video/mp4' })
	} catch (e) {
		try { venc.close() } catch { /* ignore */ }
		try { aenc?.close() } catch { /* ignore */ }
		if (o.fileStream) try { await o.fileStream.abort() } catch { /* ignore */ }
		throw e
	} finally {
		synth?.dispose()
		if (intro3D) stage.setIntroShot(null)
		if (intro3D && stage.titleText !== prevTitle) stage.setTitle(prevTitle)
		if (o.tour) {
			stage.setTour(prevTour)
			if (!prevTour && stage.opts.view !== prevView) { stage.setView(prevView); stage.onViewChange?.(prevView); stage._snapCamera = true }
		}
		stage.opts.transition = prevTransition
		stage.endOffline()
	}
}
