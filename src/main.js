import './constants.js'
import { getFontSize, setFontSize, getLayoutMode, setLayoutMode, setPageSize, getPageSize, setPageOrientation, getPageOrientation, getMusicFont, setMusicFont, getSpringDensity, setSpringDensity, getRodSpringBalance, setRodSpringBalance, getDurationProportionality, setDurationProportionality, getZoomLevel, setZoomLevel, getPageDimensions, setPageViewMode, getPageViewMode, setZoomFitMode, getZoomFitMode } from './constants.js'
import { ajax } from './loaders.js'
import { decodeNwcArrayBuffer, getUseNewParser, setUseNewParser } from './nwc.js'
import { decodeMidiArrayBuffer, isMidiFile } from './midi-import.js'
import { interpret } from './interpreter.js'
import { setup, resizeToFit, changeFont } from './drawing.js'
import { exportLilypond } from './exporter.js'
import { score, setPlaybackHighlighter, setInkBleedRenderer } from './layout/typeset.js'
import { blank } from './editing.js'
import { MusicContext } from './context.js'
import { PlaybackController } from './audio.js'
import { PlaybackHighlighter } from './playback-highlight.js'
import { InkBleedRenderer } from './ink-bleed.js'
import { PianoKeyboard } from './piano-keyboard.js'
import { parseMuseScore, isMuseScoreFileStrict } from './musescore-parser.js'
import { parseMusicXML, isMusicXMLFile } from './musicxml-import.js'
import { ensureWebMscore, exportMusicXML } from './webmscore-loader.js'

/**********************
 *
 *   Entry
 *
 **********************/

window.addEventListener('resize', () => {
	if (getLayoutMode() === 'wrap') {
		// In wrap mode, the layout depends on viewport width — must re-layout
		rerender()
	} else {
		// If a fit mode is active, recalculate the zoom
		if (getZoomFitMode() !== 'none') {
			applyZoomFit()
		} else {
			resizeToFit()
			var scoreElm = document.getElementById('score')
			quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
		}
	}
})

if (location.hostname === 'localhost') {
	document.getElementById('debug_tools').style.display = ''
}

// everyStaveTokens().filter(t => t && t.tie)
// data.score.staves[1].tokens.filter(t => t && t.tie)
// findFirstToken(t => t && t.tie)

window.findFirstToken = (predicate) => {
	var s, t
	data.score.staves.some((stave, i) => {
		s = i
		return stave.tokens.some((token, j) => {
			if (predicate(token)) {
				t = j
				return true
			}
		})
	})

	return { s, t }
}

var samples = [
	'AChildThisDayIsBorn.nwc', // v2.02
	'AveMariaArcadelt.nwc', // v2.75
	'WakenChristianChildren.nwc', // v2.75
	'WeThreeKingsOfOrientAre.nwc', // v2.75
	'WhatChildIsThis.nwc', // v2.02
	'adohn.nwc', // v1.75 *
	'anongs.nwc', // v1.75
	'bwv140-2.nwc', // v1.75
	'carenot.nwc', // v1.75
	'jem001.nwc', // v1.55
]

var nwcSamples = ['abelp.nwc','adohn.nwc','albadag.nwc','albadagio.nwc','albast.nwc','albzargn.nwc','alleg_miscrv.nwc','anonitra.nwc','anonsp.nwc','arcmargot.nwc','aufblue.nwc','bacfuggm.nwc','bachairg.nwc','bachbra5.nwc','bachjesu.nwc','beetadag.nwc','beetfid72_3.nwc','beetfur.nwc','beethall.nwc','bellvaga.nwc','bohnpost.nwc','bortib.nwc','brah_gr_mgz-brahms4.nwc','conop9-lesson1.nwc','cortajaca.nwc','dannyboy.nwc','decnonti.nwc','dingdong.nwc','eccson_gm_1.nwc','enter.nwc','falcbeaut.nwc','faurcant.nwc','gimboda.nwc','godrest.nwc','gotzom.nwc','hand_josz-11_00-joyful.nwc','handacis-16.nwc','handalex-28.nwc','handdett-07.nwc','handjoshz-40-heroes.nwc','handjoshz-50-hail.nwc','handking-2.nwc','handmesscrv-31-lift.nwc','handsam-75_76.nwc','hanjudm-67.nwc','hanjudm-68.nwc','hansol-41.nwc','har_ohg.nwc','haydheav.nwc','haydn_hobxxiiibz-1-salve.nwc','hdn_cr05-amazd.nwc','hdn_cr33-sing.nwc','holbng.nwc','hoolchris.nwc','horhuron.nwc','hoxmas2001-2.nwc','jsb_slpz-31-ojesu.nwc','jsbjjcrv.nwc','jsbmgh.nwc','kimfflow.nwc','lachiop43.nwc','lenzlsong.nwc','liszthr2.nwc','lvb3rd1.nwc','lvb5th1.nwc','lvb9th1.nwc','lvb9th2.nwc','lynmhall.nwc','mac_xflav.nwc','mahres3.nwc','marpqam.nwc','mend_fingcovez-fc-parts.nwc','moresuno.nwc','mozflhp1.nwc','mozkv335.nwc','n_cavern_p.nwc','n_caverns1.nwc','namibia.nwc','offbold.nwc','ovegmont.nwc','palestine.nwc','pendp.nwc','penflight.nwc','perposui.nwc','rosfang.nwc','rosspms_06-quitl.nwc','rosspmsgrat.nwc','rosssoglio.nwc','rossvoce.nwc','satiegy1.nwc','schtrans.nwc','schuave.nwc','schuspri.nwc','stradpiet.nwc','suslab2.nwc','tanonshen.nwc','teddypic.nwc','test.nwc','tullplay.nwc','tulltaab.nwc','uzbekistan.nwc','vict_ommcrv.nwc','vierop16kyr.nwc','vitrtuba.nwc','wamavc.nwc','wamkv1.nwc','wamr06-conft.nwc','warnmoz.nwc']

var sample_dom = document.getElementById('samples')
samples.forEach((sample) => {
	var option = document.createElement('option')
	option.value = sample
	option.text = sample
	sample_dom.appendChild(option)
})
nwcSamples.forEach((sample) => {
	var option = document.createElement('option')
	option.value = sample
	option.text = sample
	sample_dom.appendChild(option)
})
sample_dom.onchange = function () {
	const path = samples.includes(sample_dom.value) ? 'samples/' : 'nwcs/'
	ajax(path + sample_dom.value, (buf) => processData(buf, sample_dom.value))
	localStorage.setItem('nwc_last_song', sample_dom.value)
}

// Default loading — restore last song or fall back to WhatChildIsThis
const LAST_SONG_KEY = 'nwc_last_song'
const lastSong = localStorage.getItem(LAST_SONG_KEY) || 'WhatChildIsThis.nwc'
const lastSongPath = samples.includes(lastSong) ? 'samples/' : 'nwcs/'
ajax(lastSongPath + lastSong, (buf) => processData(buf, lastSong))
if (sample_dom) sample_dom.value = lastSong

// Doesn't work yet

// ajax('samples/OhWhoAreTheySoPure.nwc', processData); // EcceConcipies IShouldLikeToHaveHeard GodRestYouMerry MountainsBowYourHeadsMajestic LetMusicBreakOnThisBlestMorn RingChristmasBells OhWhoAreTheySoPure
// ajax('samples/ComeLetUsAllSweetCarolSingNwc2.nwc', processData);
// ajax('samples/AShepherdBandTheirFlocksAreKeeping.nwc', processData);
// ajax('samples/canon.nwc', processData);
// ajax('samples/prelude.nwc', processData);

// v1.5
// ajax('samples/padstow-3.nwc', processData);
// ajax('samples/Mendelssohn.nwc', processData);

// Long piece
// ajax('samples/20171110c-bl.JingleBellsOverture.nwc', processData);

const test_data = {
	score: {
		staves: [
			{
				tokens: [
					{ type: 'Clef', clef: 'treble', octave: 0 },
					{ type: 'KeySignature', key: 'Bb' },
					{ type: 'TimeSignature', signature: 'AllaBreve' },
					{ type: 'Rest', position: 0, duration: 4, dots: 0 },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-1',
						position: -1,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-2',
						position: -2,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-1',
						position: -1,
						duration: 4,
						dots: 0,
					},
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-3',
						Opts: 'Slur=Downward',
						position: -3,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-2',
						Opts: 'Slur=Downward,Lyric=Never',
						position: -2,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: 'Half',
						Pos: '-1',
						position: -1,
						duration: 2,
						dots: 0,
					},
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-1',
						position: -1,
						duration: 4,
						dots: 0,
					},
				],
			},
			{
				tokens: [
					{ type: 'Clef', clef: 'bass', octave: 0 },
					{ type: 'KeySignature', key: 'Bb' },
					{ type: 'TimeSignature', signature: 'AllaBreve' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-3',
						position: -3,
						duration: 4,
						dots: 0,
					},
					{ type: 'Rest', position: 0, duration: 4, dots: 0 },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-6',
						position: -6,
						duration: 4,
						dots: 0,
					},
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: 'Half',
						Pos: '-3',
						position: -3,
						duration: 2,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-5',
						Opts: 'Slur=Downward',
						position: -5,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						Opts: 'Lyric=Never',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-3',
						position: -3,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-3',
						position: -3,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: 'Half',
						Pos: '-3',
						position: -3,
						duration: 2,
						dots: 0,
					},
				],
			},
		],
	},
}

const test_dot_quaver = {
	score: {
		staves: [
			{
				tokens: [
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{ type: 'Barline' },
				],
			},
			{
				tokens: [
					{ type: 'Barline' },
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 1,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 8,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{
						type: 'Note',
						Dur: '4th',
						Pos: '-4',
						position: -4,
						duration: 4,
						dots: 0,
					},
					{ type: 'Barline' },
				],
			},
		],
	},
}

/**
 * Playback — soundfont-engine
 */

const playback = new PlaybackController()
const highlighter = new PlaybackHighlighter(document.getElementById('score'))
setPlaybackHighlighter(highlighter)

// Piano keyboard — placed between the score and the footer
const pianoKeyboard = new PianoKeyboard(document.getElementById('container'))
// The constructor appends at the end; move it before #footer
const _pianoFooter = document.getElementById('footer')
if (_pianoFooter && pianoKeyboard._el) {
	pianoKeyboard._el.parentElement.insertBefore(pianoKeyboard._el, _pianoFooter)
}

function formatTime(sec) {
	if (!isFinite(sec) || sec < 0) sec = 0
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return m + ':' + String(s).padStart(2, '0')
}

const playBtn = document.getElementById('play')
const stopBtn = document.getElementById('stop')
const progressBar = document.getElementById('progress_bar')
const timeLabel = document.getElementById('playback_time')

let _seeking = false

playback.onTime((t, dur) => {
	if (!_seeking) {
		progressBar.value = dur > 0 ? t / dur : 0
	}
	timeLabel.textContent = formatTime(t) + ' / ' + formatTime(dur)
	highlighter.updateTime(t)
})

playback.onNoteOn((ev) => {
	highlighter.onNoteOn(ev)
	pianoKeyboard.noteOn(ev)
})
playback.onNoteOff((ev) => {
	highlighter.onNoteOff(ev)
	pianoKeyboard.noteOff(ev)
})

playback.onStateChange((playing) => {
	playBtn.textContent = playing ? 'Pause' : 'Play'
	if (playing) highlighter.start()
	else highlighter.pause()  // keep highlights frozen on pause
})

playback.onEnd(() => {
	playBtn.textContent = 'Play'
	progressBar.value = 0
	timeLabel.textContent = formatTime(0) + ' / ' + formatTime(playback.duration)
	highlighter.stop()
	pianoKeyboard.clear()
})

async function togglePlayPause() {
	if (playback.playing) {
		playback.pause()
	} else {
		// Load current score data before playing
		const data = scoreManager.getData()
		await playback.load(data)
		await playback.play()
	}
}

playBtn.onclick = togglePlayPause

stopBtn.onclick = () => {
	playback.stop()
	highlighter.stop()
	pianoKeyboard.clear()
	progressBar.value = 0
	timeLabel.textContent = formatTime(0) + ' / ' + formatTime(playback.duration)
}

progressBar.addEventListener('pointerdown', () => { _seeking = true })

// Highlight mode selector
const highlightSelect = document.getElementById('highlight_mode')
if (highlightSelect) {
	highlightSelect.onchange = () => {
		highlighter.setHighlightMode(highlightSelect.value)
	}
}

// Click-to-seek: clicking on the score positions the playback cursor.
// Distinguishes clicks from drag-scrolls using a 5px movement threshold.
{
	const scoreElm = document.getElementById('score')
	let _clickX = 0, _clickY = 0
	scoreElm.addEventListener('pointerdown', (e) => {
		_clickX = e.clientX
		_clickY = e.clientY
	})
	scoreElm.addEventListener('pointerup', (e) => {
		// Ignore if mouse moved (drag-scroll, not a click)
		const dx = e.clientX - _clickX
		const dy = e.clientY - _clickY
		if (dx * dx + dy * dy > 25) return

		// Convert click position to score-space coordinates
		const canvasEl = window.canvas
		if (!canvasEl) return
		const rect = canvasEl.getBoundingClientRect()
		const zoom = getZoomLevel()
		const scoreX = (e.clientX - rect.left + scoreElm.scrollLeft) / zoom
		const scoreY = (e.clientY - rect.top + scoreElm.scrollTop) / zoom

		// Find the playback time at this position
		const time = highlighter.getTimeAtPosition(scoreX, scoreY)
		if (time == null) return

		// Seek the playback engine and update the visual cursor
		playback.seek(time)
		highlighter.updateTime(time)

		// Update progress bar position
		if (playback.duration > 0) {
			progressBar.value = time / playback.duration
		}
	})
}

// Auto-scroll toggle
const autoScrollBtn = document.getElementById('autoscroll_toggle')
if (autoScrollBtn) {
	autoScrollBtn.onclick = () => {
		const enabled = highlighter.toggleAutoScroll()
		autoScrollBtn.classList.toggle('active', enabled)
	}
}

// Solo staff selector
const soloSelect = document.getElementById('solo_staff')

function updateSoloStaffOptions(data) {
	if (!soloSelect) return
	// Clear existing options (keep "All")
	soloSelect.innerHTML = '<option value="all">All Staves</option>'
	const staves = data?.score?.staves
	if (!staves) return
	for (let i = 0; i < staves.length; i++) {
		const opt = document.createElement('option')
		opt.value = String(i)
		const name = staves[i].staff_name || staves[i].staff_label || `Staff ${i + 1}`
		opt.textContent = `${i + 1}: ${name}`
		soloSelect.appendChild(opt)
	}
	// Restore selection (clear solo if staves changed)
	soloSelect.value = 'all'
	playback.clearSoloMute()
}

if (soloSelect) {
	soloSelect.onchange = async () => {
		const val = soloSelect.value
		playback.clearSoloMute()
		if (val !== 'all') {
			playback.setSolo(parseInt(val, 10), true)
		}
		// Re-filter and reload if we have notes loaded
		await playback._reloadFiltered()
	}
}

// Piano keyboard toggle
const pianoToggleBtn = document.getElementById('piano_toggle')
if (pianoToggleBtn) {
	pianoToggleBtn.onclick = () => {
		const visible = pianoKeyboard.toggle()
		pianoToggleBtn.classList.toggle('active', visible)
		// Resize canvas to reclaim/release space from the keyboard area
		if (getLayoutMode() === 'wrap') {
			rerender()
		} else {
			resizeToFit()
			var scoreElm = document.getElementById('score')
			quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
		}
	}
}

progressBar.addEventListener('pointerup', () => {
	_seeking = false
	const t = parseFloat(progressBar.value) * playback.duration
	playback.seek(t)
})
progressBar.addEventListener('input', () => {
	const t = parseFloat(progressBar.value) * playback.duration
	timeLabel.textContent = formatTime(t) + ' / ' + formatTime(playback.duration)
})

// Speed control
const speedSlider = document.getElementById('speed_slider')
const speedInput = document.getElementById('speed_input')

function applySpeed(val) {
	const n = parseFloat(val)
	if (!isFinite(n) || n <= 0) return
	const clamped = Math.max(0.1, Math.min(4, n))
	playback.setSpeed(clamped)
	// Keep slider and input in sync (slider max is 3, input max is 4)
	speedSlider.value = Math.min(clamped, parseFloat(speedSlider.max))
	speedInput.value = clamped
}

if (speedSlider) {
	speedSlider.addEventListener('input', () => applySpeed(speedSlider.value))
}

if (speedInput) {
	speedInput.addEventListener('change', () => applySpeed(speedInput.value))
}

// Ink bleed / print emulation toggle
let inkBleed = null
const inkBleedBtn = document.getElementById('ink_bleed_toggle')
if (inkBleedBtn) {
	inkBleedBtn.onclick = () => {
		// Lazy init: create the renderer on first toggle
		if (!inkBleed && window.canvas) {
			inkBleed = new InkBleedRenderer(window.canvas)
			setInkBleedRenderer(inkBleed)
		}
		if (inkBleed) {
			const on = inkBleed.toggle()
			inkBleedBtn.classList.toggle('active', on)
			// Trigger a repaint so the effect shows immediately
			var scoreElm = document.getElementById('score')
			quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
		}
	}
}

// Paper color picker for ink bleed
const paperColorInput = document.getElementById('ink_paper_color')
if (paperColorInput) {
	paperColorInput.addEventListener('input', () => {
		if (!inkBleed) return
		// Convert hex color to RGB 0-1 array
		const hex = paperColorInput.value
		const r = parseInt(hex.slice(1, 3), 16) / 255
		const g = parseInt(hex.slice(3, 5), 16) / 255
		const b = parseInt(hex.slice(5, 7), 16) / 255
		inkBleed.setParams({ paperColor: [r, g, b] })
		// Repaint
		var scoreElm = document.getElementById('score')
		quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
	})
}

// Ink controls popover + sliders
const inkToggle = document.getElementById('ink_controls_toggle')
const inkPanel = document.getElementById('ink_controls_panel')
if (inkToggle && inkPanel) {
	inkToggle.onclick = (e) => {
		e.stopPropagation()
		const isOpen = inkPanel.classList.toggle('open')
		inkToggle.classList.toggle('active', isOpen)
	}
	document.addEventListener('click', (e) => {
		if (!inkPanel.contains(e.target) && e.target !== inkToggle) {
			inkPanel.classList.remove('open')
			inkToggle.classList.remove('active')
		}
	})
}

function inkRepaint() {
	if (!inkBleed) return
	var scoreElm = document.getElementById('score')
	quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
}

const inkSliders = [
	['ink_bleed_slider',     'ink_bleed_label',     'bleed'],
	['ink_roughness_slider', 'ink_roughness_label',  'roughness'],
	['ink_density_slider',   'ink_density_label',    'inkDensity'],
	['ink_grain_slider',     'ink_grain_label',      'paperGrain'],
	['ink_pool_slider',      'ink_pool_label',       'edgePool'],
]

for (const [sliderId, labelId, paramKey] of inkSliders) {
	const slider = document.getElementById(sliderId)
	const label = document.getElementById(labelId)
	if (slider && label) {
		slider.addEventListener('input', () => {
			const val = parseFloat(slider.value) / 100
			label.textContent = val.toFixed(2)
			if (inkBleed) {
				inkBleed.setParams({ [paramKey]: val })
				inkRepaint()
			}
		})
	}
}

const rerender = () => {
	try {
		setup(
			() => {
				console.log('rerender')
				let data = scoreManager.getData()
				const musicContext = new MusicContext(data, window.canvas)
				// MuseScore/MusicXML-parsed data has timing/pitch already resolved — skip interpret
				if (data._source !== 'musescore' && data._source !== 'musicxml') {
					interpret(musicContext)
				}
				score(musicContext)
				window.__renderComplete = { ts: Date.now(), file: window.__currentFile }

				// Update highlighter with new layout positions
				highlighter.setScore(data)
			},
			null,
			(canvas) => {
				console.log('ok')
				var score_div = document.getElementById('score')
				var invisible_canvas = document.getElementById('invisible_canvas')

				score_div.insertBefore(canvas, invisible_canvas)
				resizeToFit()
			}
		)
	} catch (error) {
		console.error('Rendering failed:', error)
		alert(`Error rendering score: ${error.message}\n\nSee DevTools console for the full stack trace.`)
	}
}

window.exportLilypond = exportLilypond

function setDataAndRender(_data) {
	scoreManager.setData(_data)
	updateSoloStaffOptions(_data)
	rerender()
}

// ---------------------------------------------------------------------------
// MuseScore Import Mode
// ---------------------------------------------------------------------------

/** Get the current MuseScore import mode ('webmscore' or 'jsparser'). */
function getMuseScoreImportMode() {
	const select = document.getElementById('mscore_import_mode')
	return select ? select.value : 'webmscore'
}

// Persist import mode in localStorage
;(function initImportMode() {
	const select = document.getElementById('mscore_import_mode')
	if (!select) return
	const saved = localStorage.getItem('mscore_import_mode')
	if (saved && (saved === 'webmscore' || saved === 'jsparser')) {
		select.value = saved
	}
	select.addEventListener('change', () => {
		localStorage.setItem('mscore_import_mode', select.value)
	})
})()

/**
 * Process a MuseScore file via the WebMscore WASM pipeline.
 * Falls back to the JS parser if WebMscore fails.
 */
async function processMuseScoreViaWebMscore(payload, filename) {
	try {
		const musicxml = await exportMusicXML(payload, filename)
		console.log(`WebMscore exported MusicXML (${musicxml.length} chars)`)

		const data = await parseMusicXML(musicxml, filename)
		console.log('MusicXML parsed via WebMscore pipeline:', data)
		setDataAndRender(data)
	} catch (error) {
		console.warn('WebMscore pipeline failed, falling back to JS parser:', error.message)

		// Fallback to direct JS parser
		try {
			const data = await parseMuseScore(payload)
			console.log('MuseScore parsed (JS fallback):', data)
			setDataAndRender(data)
		} catch (fallbackError) {
			console.error('JS parser also failed:', fallbackError)
			alert(`Error loading MuseScore file.\n\nWebMscore: ${error.message}\nJS parser: ${fallbackError.message}\n\nSee DevTools console for details.`)
		}
	}
}

function processData(payload, filename) {
	try {
		window._lastPayload = payload
		window.__currentFile = filename || '(unknown)'
		window.__renderComplete = null
		// Detect MuseScore files (.mscx / .mscz)
		if (isMuseScoreFileStrict(payload, filename)) {
			console.log('Detected MuseScore file:', filename)

			const useWebMscore = getMuseScoreImportMode() === 'webmscore'

			if (useWebMscore) {
				// WebMscore pipeline: .mscz → webmscore WASM → MusicXML → our parser
				console.log('Using WebMscore pipeline...')
				processMuseScoreViaWebMscore(payload, filename)
			} else {
				// Direct JS parser
				parseMuseScore(payload).then(data => {
					console.log('MuseScore parsed (JS):', data)
					setDataAndRender(data)
				}).catch(error => {
					console.error('Failed to parse MuseScore file:', error)
					alert(`Error loading MuseScore file: ${error.message}\n\nSee DevTools console for the full stack trace.`)
				})
			}
			return
		}

		// Detect MusicXML files (.musicxml / .mxl / .xml)
		if (isMusicXMLFile(payload, filename)) {
			console.log('Detected MusicXML file:', filename)
			parseMusicXML(payload, filename).then(data => {
				console.log('MusicXML parsed:', data)
				setDataAndRender(data)
			}).catch(error => {
				console.error('Failed to parse MusicXML file:', error)
				alert(`Error loading MusicXML file: ${error.message}\n\nSee DevTools console for the full stack trace.`)
			})
			return
		}

		var data
		if (isMidiFile(payload)) {
			data = decodeMidiArrayBuffer(payload, filename)
		} else {
			data = decodeNwcArrayBuffer(payload)
		}
		setDataAndRender(data)
	} catch (error) {
		console.error('Failed to process file:', error)
		// Log the full stack so the root cause is visible in DevTools, then
		// surface a user-readable message.  We deliberately do NOT catch errors
		// from rerender() here — those are caught inside rerender() itself.
		alert(`Error loading file: ${error.message}\n\nSee DevTools console for the full stack trace.`)
	}
}

document.getElementById('blank_button').onclick = () => {
	setDataAndRender(blank)
	// setDataAndRender(test_data)
	// setDataAndRender(test_dot_quaver)
}

window.rerender = rerender
window.processData = processData
window.setDataAndRender = setDataAndRender

const PARSER_STORAGE_KEY = 'nwc_use_new_parser'

function updateParserButton() {
	const btn = document.getElementById('parser_toggle')
	if (btn) btn.textContent = getUseNewParser() ? 'New' : 'Old'
}

function toggleParser() {
	const next = !getUseNewParser()
	setUseNewParser(next)
	localStorage.setItem(PARSER_STORAGE_KEY, next)
	updateParserButton()
	if (window._lastPayload) {
		processData(window._lastPayload)
	}
}

const parserBtn = document.getElementById('parser_toggle')
if (parserBtn) parserBtn.onclick = toggleParser

// Restore persisted parser preference
const storedParser = localStorage.getItem(PARSER_STORAGE_KEY)
if (storedParser !== null) {
	setUseNewParser(storedParser === 'true')
}
updateParserButton()

// ---- Layout mode (segmented button group) ----

const LAYOUT_STORAGE_KEY = 'nwc_layout_mode'
const PAGE_SIZE_STORAGE_KEY = 'nwc_page_size'
const ORIENTATION_STORAGE_KEY = 'nwc_page_orientation'

function updateLayoutUI() {
	const mode = getLayoutMode()

	// Update segmented button group active state
	const group = document.getElementById('layout_group')
	if (group) {
		for (const btn of group.querySelectorAll('button')) {
			btn.classList.toggle('active', btn.dataset.mode === mode)
		}
	}

	// Show/hide page-only controls
	const pageSizeEl = document.getElementById('page_size')
	const orientGroup = document.getElementById('orientation_group')
	const pageViewModeEl = document.getElementById('page_view_mode')
	const isPage = mode === 'page'
	if (pageSizeEl) pageSizeEl.style.display = isPage ? 'inline' : 'none'
	if (orientGroup) orientGroup.style.display = isPage ? 'inline-flex' : 'none'
	if (pageViewModeEl) pageViewModeEl.style.display = isPage ? 'inline' : 'none'
	updatePageNavVisibility()

	// Toggle background for page mode (gray canvas background)
	const scoreDiv = document.getElementById('score')
	const canvasEl = window.canvas
	if (mode === 'page') {
		if (scoreDiv) scoreDiv.style.background = '#888'
		if (canvasEl) canvasEl.style.background = 'transparent'
	} else {
		if (scoreDiv) scoreDiv.style.background = ''
		if (canvasEl) canvasEl.style.background = '#fff'
	}
}

// Layout button group click handler
const layoutGroup = document.getElementById('layout_group')
if (layoutGroup) {
	layoutGroup.addEventListener('click', (e) => {
		const btn = e.target.closest('button')
		if (!btn || !btn.dataset.mode) return
		setLayoutMode(btn.dataset.mode)
		localStorage.setItem(LAYOUT_STORAGE_KEY, btn.dataset.mode)
		updateLayoutUI()
		rerender()
	})
}

// Page size selector
const pageSizeSelect = document.getElementById('page_size')
if (pageSizeSelect) {
	pageSizeSelect.onchange = function () {
		setPageSize(pageSizeSelect.value)
		localStorage.setItem(PAGE_SIZE_STORAGE_KEY, pageSizeSelect.value)
		if (getLayoutMode() === 'page') rerender()
	}
}

// Orientation button group click handler
const orientGroup = document.getElementById('orientation_group')
if (orientGroup) {
	orientGroup.addEventListener('click', (e) => {
		const btn = e.target.closest('button')
		if (!btn || !btn.dataset.orient) return
		setPageOrientation(btn.dataset.orient)
		localStorage.setItem(ORIENTATION_STORAGE_KEY, btn.dataset.orient)
		for (const b of orientGroup.querySelectorAll('button')) {
			b.classList.toggle('active', b === btn)
		}
		if (getLayoutMode() === 'page') rerender()
	})
}

// ---------------------------------------------------------------------------
// Page View Mode (vertical, single-page, two-up, horizontal)
// ---------------------------------------------------------------------------

const PAGE_VIEW_STORAGE_KEY = 'nwc_page_view_mode'

// Current page index for single-page mode
let currentPageIdx = 0

// Page view mode selector
const pageViewModeSelect = document.getElementById('page_view_mode')
if (pageViewModeSelect) {
	pageViewModeSelect.onchange = function () {
		setPageViewMode(pageViewModeSelect.value)
		localStorage.setItem(PAGE_VIEW_STORAGE_KEY, pageViewModeSelect.value)
		currentPageIdx = 0
		updatePageNav()
		updatePageNavVisibility()
		if (getLayoutMode() === 'page') rerender()
	}
}

function updatePageNavVisibility() {
	const nav = document.getElementById('page_nav')
	if (nav) nav.style.display = getLayoutMode() === 'page' ? 'inline' : 'none'
}

function updatePageNav() {
	const input = document.getElementById('page_input')
	const indicator = document.getElementById('page_indicator')
	const prevBtn = document.getElementById('page_prev')
	const nextBtn = document.getElementById('page_next')
	const totalPages = window._pageGeometry?.pageCount || 1
	if (input) {
		input.value = currentPageIdx + 1
		input.max = totalPages
	}
	if (indicator) indicator.textContent = ` / ${totalPages}`
	if (prevBtn) prevBtn.disabled = currentPageIdx <= 0
	if (nextBtn) nextBtn.disabled = currentPageIdx >= totalPages - 1
}

function scrollToPage(pageIdx) {
	const pg = window._pageGeometry
	if (!pg || !pg.pagePositions || pageIdx < 0 || pageIdx >= pg.pageCount) return
	currentPageIdx = pageIdx
	const pos = pg.pagePositions[pageIdx]
	const zoom = getZoomLevel()
	const scoreElm = document.getElementById('score')
	if (scoreElm) {
		// Center the page in the viewport
		const pageVirtualHeight = pg.pageHeight + pg.interPageGap
		scoreElm.scrollTop = (pos.y - pg.interPageGap / 2) * zoom
		scoreElm.scrollLeft = 0
		quickDraw(null, -scoreElm.scrollLeft, -scoreElm.scrollTop)
	}
	updatePageNav()
}

// Prev / Next buttons
const pagePrevBtn = document.getElementById('page_prev')
const pageNextBtn = document.getElementById('page_next')
if (pagePrevBtn) pagePrevBtn.onclick = () => scrollToPage(currentPageIdx - 1)
if (pageNextBtn) pageNextBtn.onclick = () => scrollToPage(currentPageIdx + 1)

// Jump-to-page input
const pageInput = document.getElementById('page_input')
if (pageInput) {
	pageInput.addEventListener('change', () => {
		const totalPages = window._pageGeometry?.pageCount || 1
		const page = Math.max(1, Math.min(totalPages, parseInt(pageInput.value, 10) || 1))
		scrollToPage(page - 1)
	})
	pageInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.target.blur()  // triggers change event
		}
	})
	// Prevent scroll-wheel from changing the number input (confusing UX)
	pageInput.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })
}

// Track current page from scroll position in all page view modes
;(function initPageScrollTracking() {
	const scoreElm = document.getElementById('score')
	if (!scoreElm) return

	let trackPending = false
	scoreElm.addEventListener('scroll', () => {
		if (getLayoutMode() !== 'page') return
		if (trackPending) return
		trackPending = true
		requestAnimationFrame(() => {
			trackPending = false
			updateCurrentPageFromScroll()
		})
	})
})()

/**
 * Determine which page is currently most visible and update the nav UI.
 */
function updateCurrentPageFromScroll() {
	const pg = window._pageGeometry
	if (!pg || !pg.pagePositions) return
	const scoreElm = document.getElementById('score')
	if (!scoreElm) return

	const zoom = getZoomLevel()
	const viewMode = getPageViewMode()

	// Compute viewport center in score-space
	let viewCenterX, viewCenterY
	if (viewMode === 'horizontal') {
		viewCenterX = (scoreElm.scrollLeft + scoreElm.clientWidth / 2) / zoom
		viewCenterY = pg.pagePositions[0]?.y + pg.pageHeight / 2 || 0
	} else {
		viewCenterX = pg.pagePositions[0]?.x + pg.pageWidth / 2 || 0
		viewCenterY = (scoreElm.scrollTop + scoreElm.clientHeight / 2) / zoom
	}

	// Find the page whose center is closest to viewport center
	let closestPage = 0
	let closestDist = Infinity
	for (let i = 0; i < pg.pageCount; i++) {
		const pos = pg.pagePositions[i]
		const pageCenterX = pos.x + pg.pageWidth / 2
		const pageCenterY = pos.y + pg.pageHeight / 2
		const dx = pageCenterX - viewCenterX
		const dy = pageCenterY - viewCenterY
		const dist = dx * dx + dy * dy
		if (dist < closestDist) {
			closestDist = dist
			closestPage = i
		}
	}

	if (closestPage !== currentPageIdx) {
		currentPageIdx = closestPage
		updatePageNav()
	}
}

// ---------------------------------------------------------------------------
// Zoom Fit Mode (width / height) — buttons next to zoom slider
// ---------------------------------------------------------------------------

const ZOOM_FIT_STORAGE_KEY = 'nwc_zoom_fit'

/** Calculate and apply zoom to fit width or height. */
function applyZoomFit() {
	const scoreElm = document.getElementById('score')
	if (!scoreElm || typeof maxCanvasWidth === 'undefined') return

	const mode = getZoomFitMode()
	if (mode === 'none') return

	const viewportW = scoreElm.clientWidth - 20
	const viewportH = scoreElm.clientHeight - 20
	let newZoom

	if (mode === 'width') {
		newZoom = viewportW / maxCanvasWidth
	} else if (mode === 'height') {
		newZoom = viewportH / maxCanvasHeight
	}

	if (newZoom) {
		setZoomLevel(newZoom)
		if (window.applyZoom) window.applyZoom(newZoom)
	}
}

/**
 * Called when the user manually drags the zoom slider.
 * Disengages any active fit mode and applies the zoom.
 */
function onZoomSliderInput(value) {
	setZoomFitMode('none')
	updateFitButtonsUI()
	localStorage.removeItem(ZOOM_FIT_STORAGE_KEY)
	if (window.applyZoom) window.applyZoom(value)
}
window.onZoomSliderInput = onZoomSliderInput

function updateFitButtonsUI() {
	const mode = getZoomFitMode()
	const fitW = document.getElementById('fit_width_btn')
	const fitH = document.getElementById('fit_height_btn')
	if (fitW) fitW.classList.toggle('active', mode === 'width')
	if (fitH) fitH.classList.toggle('active', mode === 'height')
}

// Fit Width button
const fitWidthBtn = document.getElementById('fit_width_btn')
if (fitWidthBtn) {
	fitWidthBtn.onclick = () => {
		const newMode = getZoomFitMode() === 'width' ? 'none' : 'width'
		setZoomFitMode(newMode)
		localStorage.setItem(ZOOM_FIT_STORAGE_KEY, newMode)
		updateFitButtonsUI()
		if (newMode !== 'none') applyZoomFit()
	}
}

// Fit Height button
const fitHeightBtn = document.getElementById('fit_height_btn')
if (fitHeightBtn) {
	fitHeightBtn.onclick = () => {
		const newMode = getZoomFitMode() === 'height' ? 'none' : 'height'
		setZoomFitMode(newMode)
		localStorage.setItem(ZOOM_FIT_STORAGE_KEY, newMode)
		updateFitButtonsUI()
		if (newMode !== 'none') applyZoomFit()
	}
}

// Apply fit mode after each render
;(function hookZoomFit() {
	let lastRenderTs = 0
	const checkRender = () => {
		if (window.__renderComplete && window.__renderComplete.ts !== lastRenderTs) {
			lastRenderTs = window.__renderComplete.ts
			if (getZoomFitMode() !== 'none') {
				requestAnimationFrame(() => applyZoomFit())
			}
			// Update page nav in single-page mode
			if (getPageViewMode() === 'single-page' && getLayoutMode() === 'page') {
				updatePageNav()
			}
		}
		requestAnimationFrame(checkRender)
	}
	requestAnimationFrame(checkRender)
})()

// Restore persisted preferences
const storedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)
if (storedLayout === 'wrap' || storedLayout === 'scroll' || storedLayout === 'page') {
	setLayoutMode(storedLayout)
}
const storedPageSize = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
if (storedPageSize) setPageSize(storedPageSize)
if (pageSizeSelect) pageSizeSelect.value = getPageSize()
const storedOrientation = localStorage.getItem(ORIENTATION_STORAGE_KEY)
if (storedOrientation === 'portrait' || storedOrientation === 'landscape') {
	setPageOrientation(storedOrientation)
}
if (orientGroup) {
	for (const btn of orientGroup.querySelectorAll('button')) {
		btn.classList.toggle('active', btn.dataset.orient === getPageOrientation())
	}
}
const storedPageView = localStorage.getItem(PAGE_VIEW_STORAGE_KEY)
if (storedPageView) {
	setPageViewMode(storedPageView)
	if (pageViewModeSelect) pageViewModeSelect.value = storedPageView
}
const storedZoomFit = localStorage.getItem(ZOOM_FIT_STORAGE_KEY)
if (storedZoomFit === 'width' || storedZoomFit === 'height') {
	setZoomFitMode(storedZoomFit)
	updateFitButtonsUI()
}
updateLayoutUI()

// ---- Music font selector ----

const MUSIC_FONT_STORAGE_KEY = 'nwc_music_font'
const musicFontSelect = document.getElementById('music_font')

if (musicFontSelect) {
	musicFontSelect.onchange = function () {
		setMusicFont(musicFontSelect.value)
		localStorage.setItem(MUSIC_FONT_STORAGE_KEY, musicFontSelect.value)
		// Load the new font file (async), then re-render when ready.
		changeFont(rerender)
	}
}

// Restore persisted music font preference
const storedMusicFont = localStorage.getItem(MUSIC_FONT_STORAGE_KEY)
if (storedMusicFont) setMusicFont(storedMusicFont)
if (musicFontSelect) musicFontSelect.value = getMusicFont()

// ---- Size buttons ----

const sizeDownBtn = document.getElementById('size_down')
const sizeUpBtn = document.getElementById('size_up')
if (sizeDownBtn) sizeDownBtn.onclick = () => { setFontSize(getFontSize() - 4); rerender() }
if (sizeUpBtn) sizeUpBtn.onclick = () => { setFontSize(getFontSize() + 4); rerender() }

// ---- Tuning popover ----

const tuningToggle = document.getElementById('tuning_toggle')
const tuningPanel = document.getElementById('tuning_panel')
if (tuningToggle && tuningPanel) {
	tuningToggle.onclick = (e) => {
		e.stopPropagation()
		const isOpen = tuningPanel.classList.toggle('open')
		tuningToggle.classList.toggle('active', isOpen)
	}
	// Close on click outside
	document.addEventListener('click', (e) => {
		if (!tuningPanel.contains(e.target) && e.target !== tuningToggle) {
			tuningPanel.classList.remove('open')
			tuningToggle.classList.remove('active')
		}
	})
}

// ---- Spacing density slider ----

const DENSITY_STORAGE_KEY = 'nwc_spring_density'
const densitySlider = document.getElementById('density_slider')
const densityLabel = document.getElementById('density_label')

function updateDensityUI() {
	var val = getSpringDensity()
	if (densitySlider) densitySlider.value = val
	if (densityLabel) densityLabel.textContent = val.toFixed(2)
}

if (densitySlider) {
	densitySlider.oninput = function () {
		var val = parseFloat(densitySlider.value)
		setSpringDensity(val)
		localStorage.setItem(DENSITY_STORAGE_KEY, val)
		updateDensityUI()
		rerender()
	}
}

var storedDensity = localStorage.getItem(DENSITY_STORAGE_KEY)
if (storedDensity !== null) setSpringDensity(parseFloat(storedDensity))
updateDensityUI()

// ---- Rod-spring balance slider ----

const ROD_SPRING_STORAGE_KEY = 'nwc_rod_spring_balance'
const rodSpringSlider = document.getElementById('rod_spring_slider')
const rodSpringLabel = document.getElementById('rod_spring_label')

function updateRodSpringUI() {
	var val = getRodSpringBalance()
	if (rodSpringSlider) rodSpringSlider.value = val
	if (rodSpringLabel) rodSpringLabel.textContent = val.toFixed(2)
}

if (rodSpringSlider) {
	rodSpringSlider.oninput = function () {
		var val = parseFloat(rodSpringSlider.value)
		setRodSpringBalance(val)
		localStorage.setItem(ROD_SPRING_STORAGE_KEY, val)
		updateRodSpringUI()
		rerender()
	}
}

var storedRodSpring = localStorage.getItem(ROD_SPRING_STORAGE_KEY)
if (storedRodSpring !== null) setRodSpringBalance(parseFloat(storedRodSpring))
updateRodSpringUI()

// ---- Duration proportionality slider (visual ↔ timing) ----

const PROP_STORAGE_KEY = 'nwc_duration_proportionality'
const propSlider = document.getElementById('proportionality_slider')
const propLabel = document.getElementById('proportionality_label')

function updateProportionalityUI() {
	var val = getDurationProportionality()
	if (propSlider) propSlider.value = val
	if (propLabel) propLabel.textContent = val.toFixed(2)
}

if (propSlider) {
	propSlider.oninput = function () {
		var val = parseFloat(propSlider.value)
		setDurationProportionality(val)
		localStorage.setItem(PROP_STORAGE_KEY, val)
		updateProportionalityUI()
		rerender()
	}
}

var storedProp = localStorage.getItem(PROP_STORAGE_KEY)
if (storedProp !== null) setDurationProportionality(parseFloat(storedProp))
updateProportionalityUI()
