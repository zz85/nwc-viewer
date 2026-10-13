/**
 * export-dialog.js — "Export video": renders the 3D view to an MP4 frame by
 * frame (video-export.js), with an optional camera tour, intro title card
 * and outro credits, and the music rendered offline in exact sync.
 * (From midiviz experiment #025, Notation 3D.)
 *
 * Opened from the menu's export list (main.js); needs the 3D view to be open.
 */
import { exportVideo, exportSupported, defaultBitrate, drawTitleCard, drawOutroCard } from './video-export.js'
import { formatTime } from '../transport.js'

const MARKUP = `
	<h2 id="exportTitle">Export video</h2>
	<div class="row"><label for="exResolution">Resolution</label>
		<select id="exResolution">
			<option value="1280">720p (1280×720)</option>
			<option value="1920" selected>1080p (1920×1080)</option>
			<option value="2560">1440p (2560×1440)</option>
			<option value="3840">4K UHD (3840×2160)</option>
		</select></div>
	<div class="row"><label for="exAspect">Aspect</label>
		<select id="exAspect">
			<option value="16:9" selected>16:9 landscape</option>
			<option value="9:16">9:16 vertical (Shorts / Reels)</option>
			<option value="1:1">1:1 square</option>
		</select></div>
	<div class="row"><label for="exCamera">Camera</label>
		<select id="exCamera">
			<option value="current" selected>Current view</option>
			<option value="all">Tour: all views</option>
			<option value="cine">Tour: cinematic (grazing, Note Bounce, low, free orbit)</option>
			<option value="orbit">Free orbit, circling</option>
		</select></div>
	<div class="row" id="exTourRow" hidden><label for="exTourSeg">Switch every</label>
		<select id="exTourSeg">
			<option value="3">3 s</option><option value="4">4 s</option><option value="5">5 s</option><option value="8" selected>8 s</option><option value="12">12 s</option><option value="20">20 s</option>
		</select></div>
	<div class="row" id="exOrderRow" hidden><label for="exOrder">Order</label>
		<select id="exOrder"><option value="seq" selected>In sequence</option><option value="random">Random (no repeats)</option></select></div>
	<div class="row"><label for="exTransition">Transitions</label>
		<select id="exTransition">
			<option value="glide">Glide (camera flies)</option>
			<option value="crossfade" selected>Crossfade (dissolve)</option>
			<option value="cut">Cut</option>
		</select></div>
	<div class="row"><label for="exIntro">Intro card</label>
		<select id="exIntro"><option value="0">None</option><option value="3">3 s</option><option value="5" selected>5 s</option><option value="8">8 s</option></select></div>
	<div class="row" id="exIntroMusicRow"><label for="exIntroMusic">Music starts</label>
		<select id="exIntroMusic">
			<option value="overlap" selected>As the title fades out</option>
			<option value="after">After the intro</option>
		</select></div>
	<div class="row" id="exIntroStyleRow"><label for="exIntroStyle">Intro style</label>
		<select id="exIntroStyle">
			<option value="3d" selected>3D title (camera flies over the extruded title)</option>
			<option value="2d">2D glowing text card</option>
		</select></div>
	<div class="row" id="exTitleRow"><label for="exTitle">Title</label><input type="text" id="exTitle"></div>
	<div class="row" id="exSubRow"><label for="exSubtitle">Subtitle</label><input type="text" id="exSubtitle" placeholder="Composer, arranger… (optional)"></div>
	<div class="row"><label for="exOutro">Outro credits</label>
		<select id="exOutro"><option value="0">None</option><option value="5">5 s</option><option value="7" selected>7 s</option><option value="10">10 s</option></select></div>
	<div class="row" id="exOutroMusicRow"><label for="exOutroMusic">Music under credits</label>
		<select id="exOutroMusic">
			<option value="fade" selected>Fade out (credits overlap the ending)</option>
			<option value="ring">Let it ring (credits after the end)</option>
		</select></div>
	<div class="row" id="exCreditsRow"><label for="exCredits">Credits</label>
		<textarea id="exCredits" rows="4" spellcheck="false" placeholder="Role: Name (one per line)"></textarea></div>
	<div class="row" id="exPreviewRow"><label>Preview</label>
		<div class="ex-preview-buttons">
			<button type="button" id="exPrevIntro">▶ Intro card</button>
			<button type="button" id="exPrevOutro">▶ Outro card</button>
		</div></div>
	<div class="row"><label for="exFps">Frame rate</label>
		<select id="exFps"><option value="30">30 fps</option><option value="60" selected>60 fps</option></select></div>
	<div class="row"><label for="exRange">Range</label>
		<select id="exRange">
			<option value="all" selected>Whole score</option>
			<option value="here">From the current position to the end</option>
			<option value="30">30 s from the current position</option>
			<option value="60">60 s from the current position</option>
		</select></div>
	<div class="row"><label for="exQuality">Quality</label>
		<select id="exQuality">
			<option value="0.6">Smaller file</option>
			<option value="1" selected>High</option>
			<option value="1.8">Very high</option>
		</select></div>
	<div class="row"><label for="exAudio">Audio</label>
		<select id="exAudio"><option value="1" selected>Include (rendered offline, exact sync)</option><option value="0">Video only</option></select></div>
	<p class="ex-note">Renders frame by frame (not in real time), so 4K60 stays perfectly smooth on any GPU; it just takes longer.
		Uses the current camera, look and options. Chrome and Edge stream the file straight to disk.</p>
	<div class="ex-bar"><div id="exBar"></div></div>
	<div class="ex-status" id="exStatus" aria-live="polite"></div>
	<div class="ex-buttons">
		<button id="exCancel">Close</button>
		<button id="exStart" class="primary">Export MP4</button>
	</div>`

const TOUR_SETS = { all: s => s.viewOrder, cine: () => ['cinema', 'bounce', 'low', 'free'], orbit: () => ['free'] }

let dlg = null
let ctx = null
let exporting = false
let abort = null
let preview = null

export function isExporting() { return exporting }

/**
 * @param {object} context
 * @param {object} context.stage - NotationStage (the open 3D view)
 * @param {object} context.view3d - View3D, whose clock drives previews
 * @param {() => {title, subtitle, schedule, programs, duration}} context.getSong
 * @param {() => number} context.getTime - current playback position
 * @param {() => void} context.pause
 * @param {() => void} context.play - start playback from the current position
 * @param {(t: number) => void} context.seek
 * @param {() => object} context.getAudioOpts - { vendorPath, soundfonts, volume }
 * @param {string} context.fileLabel - for the default credits
 * @param {string} context.soundLabel
 * @param {(msg: string) => void} context.notify
 */
export function openExportDialog(context) {
	ctx = context
	if (!exportSupported()) {
		ctx.notify('Video export needs WebCodecs (Chrome, Edge or Safari 17+)')
		return
	}
	if (!dlg) build()
	ctx.pause()
	const song = ctx.getSong()
	dlg.classList.remove('busy')
	$('exStart').disabled = false
	$('exCancel').textContent = 'Close'
	$('exBar').style.width = '0'
	if ($('exTitle').dataset.song !== song.title) {
		$('exTitle').value = song.title || ''
		$('exSubtitle').value = song.subtitle || ''
		$('exTitle').dataset.song = song.title
		$('exCredits').value = defaultCredits()
		$('exCredits').dataset.auto = '1'
	}
	rows()
	summary()
	dlg.showModal()
}

const $ = id => dlg.querySelector('#' + id)

function build() {
	dlg = document.createElement('dialog')
	dlg.className = 'export-dialog'
	dlg.setAttribute('aria-labelledby', 'exportTitle')
	dlg.innerHTML = MARKUP
	document.body.appendChild(dlg)
	for (const id of ['exResolution', 'exAspect', 'exFps', 'exRange', 'exQuality', 'exOutroMusic', 'exIntroMusic']) $(id).addEventListener('change', summary)
	for (const id of ['exOutro', 'exIntro', 'exCamera']) $(id).addEventListener('change', () => { rows(); summary() })
	// Credits follow the subtitle until edited by hand
	$('exCredits').addEventListener('input', () => { $('exCredits').dataset.auto = '0' })
	$('exSubtitle').addEventListener('input', () => { if ($('exCredits').dataset.auto === '1') $('exCredits').value = defaultCredits() })
	$('exPrevIntro').onclick = () => startPreview('intro')
	$('exPrevOutro').onclick = () => startPreview('outro')
	$('exCancel').onclick = () => { if (abort) abort.abort(); else dlg.close() }
	dlg.addEventListener('cancel', e => { if (abort) { e.preventDefault(); abort.abort() } })
	$('exStart').onclick = start
}

function size() {
	const long = +$('exResolution').value, short = Math.round(long * 9 / 16)
	const a = $('exAspect').value
	return a === '9:16' ? [short, long] : a === '1:1' ? [short, short] : [long, short]
}

function range() {
	const r = $('exRange').value, dur = ctx.getSong().duration || 0, now = Math.min(ctx.getTime(), Math.max(0, dur - 1))
	if (r === 'all') return [0, dur]
	if (r === 'here') return [now, dur]
	return [now, Math.min(dur, now + +r)]
}

function summary() {
	const [w, h] = size(), fps = +$('exFps').value, [a, b] = range()
	const outroExtra = $('exOutroMusic').value === 'fade' ? 0 : +$('exOutro').value
	const iv = +$('exIntro').value, introExtra = $('exIntroMusic').value === 'overlap' ? iv - Math.min(iv * 0.45, 2.5) : iv
	const secs = b - a + 3 + introExtra + outroExtra, mb = defaultBitrate(w, h, fps) * +$('exQuality').value * secs / 8 / 1e6
	$('exStatus').textContent = `${w}×${h} @ ${fps}fps · ${formatTime(secs)} · ~${mb < 1000 ? Math.round(mb) + ' MB' : (mb / 1000).toFixed(1) + ' GB'}`
}

function rows() {
	const cam = $('exCamera').value, intro = $('exIntro').value !== '0', outro = $('exOutro').value !== '0'
	$('exTourRow').hidden = cam === 'current'
	$('exOrderRow').hidden = cam === 'current' || cam === 'orbit'
	$('exTitleRow').hidden = $('exSubRow').hidden = !intro && !outro
	$('exCreditsRow').hidden = $('exOutroMusicRow').hidden = !outro
	$('exIntroStyleRow').hidden = $('exIntroMusicRow').hidden = !intro
	$('exPreviewRow').hidden = !intro && !outro
	$('exPrevIntro').hidden = !intro
	$('exPrevOutro').hidden = !outro
}

function defaultCredits() {
	const lines = []
	if ($('exSubtitle').value.trim()) lines.push(`Music: ${$('exSubtitle').value.trim()}`)
	lines.push(`Score: ${ctx.fileLabel || 'local file'}`)
	if (ctx.soundLabel) lines.push(`Sound: ${ctx.soundLabel}`)
	lines.push('Engraving & visuals: Notably · three.js')
	return lines.join('\n')
}

function parseCredits(text) {
	return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
		const m = l.match(/^([^:]{1,30}):\s*(.+)$/)
		return m ? { role: m[1].trim(), name: m[2].trim() } : { role: '', name: l }
	})
}

const cardTitle = () => $('exTitle').value.trim() || ctx.getSong().title || 'Untitled'

function introSpec() {
	const secs = +$('exIntro').value
	return secs > 0 ? { seconds: secs, title: cardTitle(), subtitle: $('exSubtitle').value.trim(), credit: '♪ Notably · 3D notation', style: $('exIntroStyle').value, overlap: $('exIntroMusic').value === 'overlap' } : null
}

function outroSpec() {
	const secs = +$('exOutro').value
	return secs > 0 ? { seconds: secs, title: cardTitle(), subtitle: $('exSubtitle').value.trim(), credits: parseCredits($('exCredits').value), music: $('exOutroMusic').value } : null
}

function tour() {
	const v = $('exCamera').value
	return v === 'current' ? null : { views: TOUR_SETS[v](ctx.stage), segment: +$('exTourSeg').value, random: $('exOrder').value === 'random' }
}

// ── Live card preview: an overlay over the 3D view, played once (click or Esc stops it) ──

function stopPreview(reopen = true) {
	if (!preview) return
	const { stage } = ctx
	cancelAnimationFrame(preview.raf)
	preview.canvas.remove()
	preview.hint.remove()
	document.removeEventListener('keydown', preview.onKey, true)
	if (preview.wasPlaying) ctx.pause()
	stage.setIntroShot(null)
	if (preview.prevTitle != null && stage.titleText !== preview.prevTitle) stage.setTitle(preview.prevTitle)
	if (preview.at != null) ctx.seek(preview.at)
	preview = null
	if (reopen) { rows(); dlg.showModal() }
}

async function startPreview(kind) {
	const spec = kind === 'intro' ? introSpec() : outroSpec()
	const song = ctx.getSong()
	if (!spec || !song) return
	const { stage, view3d } = ctx
	const use3D = kind === 'intro' && spec.style === '3d'
	const prevTitle = stage.titleText
	if (use3D && spec.title !== prevTitle) await stage.setTitle(spec.title)
	dlg.close()
	const host = view3d.container
	const canvas = document.createElement('canvas')
	canvas.className = 'card-preview'
	canvas.title = 'Click or press Esc to end the preview'
	const hint = document.createElement('div')
	hint.className = 'card-preview-hint'
	hint.textContent = `${kind === 'intro' ? 'Intro' : 'Outro'} preview — click or Esc to stop`
	host.append(canvas, hint)
	const g = canvas.getContext('2d')
	const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopPreview() } }
	document.addEventListener('keydown', onKey, true)
	canvas.onclick = () => stopPreview()
	const at = ctx.getTime()
	preview = { canvas, hint, onKey, at, wasPlaying: false, raf: 0, prevTitle: use3D ? prevTitle : null }
	// outro: drift through the ending as the export does; intro: hold the opening shot
	const outroFrom = spec.music === 'fade' ? Math.max(0, song.duration - spec.seconds + 2) : song.duration - 0.5
	if (kind === 'outro') ctx.seek(outroFrom)
	else ctx.seek(Math.max(0, range()[0] - 1))
	const t0 = performance.now()
	const step = now => {
		const k = (now - t0) / 1000 / spec.seconds
		if (k >= 1) { stopPreview(); return }
		if (kind === 'outro') view3d.seek(outroFrom + (now - t0) / 1000)  // the camera keeps moving
		if (use3D) stage.setIntroShot(k)
		if (kind === 'intro' && spec.overlap && !preview.musicStarted && k * spec.seconds >= spec.seconds - Math.min(spec.seconds * 0.45, 2.5)) {
			preview.musicStarted = preview.wasPlaying = true
			ctx.play()
		}
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const w = Math.round(host.clientWidth * dpr), h = Math.round(host.clientHeight * dpr)
		if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
		g.clearRect(0, 0, w, h)
		if (kind === 'intro') drawTitleCard(g, w, h, k, spec.seconds, { ...spec, style: use3D && stage.titleMesh ? '3d' : '2d' })
		else drawOutroCard(g, w, h, k, spec.seconds, spec)
		preview.raf = requestAnimationFrame(step)
	}
	preview.raf = requestAnimationFrame(step)
}

// ── Export ──

async function start() {
	const { stage } = ctx
	const song = ctx.getSong()
	const [width, height] = size(), fps = +$('exFps').value, [startT, endT] = range()
	const name = (song.title || 'notation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + `_${height}p${fps}.mp4`
	let fileStream = null
	if (window.showSaveFilePicker) {
		try {
			const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }] })
			fileStream = await handle.createWritable()
		} catch (e) {
			if (e.name === 'AbortError') return
			console.warn(e)
		}
	}
	abort = new AbortController()
	exporting = true
	dlg.classList.add('busy')
	$('exStart').disabled = true
	$('exCancel').textContent = 'Cancel'
	const prevView = stage.opts.view
	try {
		const blob = await exportVideo({
			stage, song, width, height, fps, start: startT, end: endT,
			bitrate: Math.round(defaultBitrate(width, height, fps) * +$('exQuality').value),
			audio: $('exAudio').value === '1',
			audioOpts: ctx.getAudioOpts(),
			tour: tour(),
			transition: $('exTransition').value,
			intro: introSpec(),
			outro: outroSpec(),
			fileStream, signal: abort.signal,
			onProgress: p => {
				$('exBar').style.width = (p.frame / p.frames * 100).toFixed(1) + '%'
				$('exStatus').textContent = p.phase === 'finalizing' ? 'Finalizing…'
					: `${p.frame}/${p.frames} frames · ${(p.frame / p.elapsed).toFixed(1)} fps · ${formatTime(p.eta)} left · ${p.codec}${p.audioCodec ? ' + ' + p.audioCodec : ''}`
			},
		})
		if (blob) {
			const a = document.createElement('a')
			a.href = URL.createObjectURL(blob)
			a.download = name
			a.click()
			setTimeout(() => URL.revokeObjectURL(a.href), 60000)
		}
		$('exStatus').textContent = 'Done ✓ ' + name
		ctx.notify('Exported ' + name)
	} catch (e) {
		console.error(e)
		$('exStatus').textContent = e.name === 'AbortError' ? 'Cancelled' : 'Failed: ' + e.message
	} finally {
		exporting = false
		abort = null
		if (!stage.tour && stage.opts.view !== prevView) {
			stage.setView(prevView)
			stage.onViewChange?.(prevView)
		}
		dlg.classList.remove('busy')
		$('exStart').disabled = false
		$('exCancel').textContent = 'Close'
	}
}
