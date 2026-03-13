import './constants.js'
import { getLayoutMode, setPageSize, getPageSize, getMusicFont, setMusicFont, getSpacingModel, setSpacingModel, getSpringDensity, setSpringDensity, getRodSpringBalance, setRodSpringBalance, getDurationProportionality, setDurationProportionality } from './constants.js'
import { ajax } from './loaders.js'
import { decodeNwcArrayBuffer, getUseNewParser, setUseNewParser } from './nwc.js'
import { decodeMidiArrayBuffer, isMidiFile } from './midi-import.js'
import { interpret } from './interpreter.js'
import { setup, resizeToFit, changeFont } from './drawing.js'
import { exportLilypond } from './exporter.js'
import { score, setPlaybackHighlighter } from './layout/typeset.js'
import { blank } from './editing.js'
import { MusicContext } from './context.js'
import { PlaybackController } from './audio.js'
import { PlaybackHighlighter } from './playback-highlight.js'
import { PianoKeyboard } from './piano-keyboard.js'

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
		// scroll and page modes: fixed width, just repaint
		resizeToFit()
		var scoreElm = document.getElementById('score')
		quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
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

// Auto-scroll toggle
const autoScrollBtn = document.getElementById('autoscroll_toggle')
if (autoScrollBtn) {
	autoScrollBtn.onclick = () => {
		const enabled = highlighter.toggleAutoScroll()
		autoScrollBtn.textContent = 'Auto-scroll: ' + (enabled ? 'On' : 'Off')
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
		pianoToggleBtn.textContent = 'Piano: ' + (visible ? 'On' : 'Off')
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

const rerender = () => {
	try {
		setup(
			() => {
				console.log('rerender')
				let data = scoreManager.getData()
				const musicContext = new MusicContext(data, window.canvas)
				interpret(musicContext)
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

function processData(payload, filename) {
	try {
		window._lastPayload = payload
		window.__currentFile = filename || '(unknown)'
		window.__renderComplete = null
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

window.toggleParser = function () {
	const next = !getUseNewParser()
	setUseNewParser(next)
	localStorage.setItem(PARSER_STORAGE_KEY, next)
	updateParserButton()
	if (window._lastPayload) {
		processData(window._lastPayload)
	}
}

// Restore persisted parser preference
const storedParser = localStorage.getItem(PARSER_STORAGE_KEY)
if (storedParser !== null) {
	setUseNewParser(storedParser === 'true')
}
updateParserButton()

// ---- Layout mode toggle (scroll → wrap → page) ----

const LAYOUT_STORAGE_KEY = 'nwc_layout_mode'
const PAGE_SIZE_STORAGE_KEY = 'nwc_page_size'

function updateLayoutButton() {
	const btn = document.getElementById('layout_toggle')
	const mode = getLayoutMode()
	if (btn) btn.textContent = mode === 'wrap' ? 'Wrap' : mode === 'page' ? 'Page' : 'Scroll'

	// Show/hide page size selector
	const pageSizeSelect = document.getElementById('page_size')
	if (pageSizeSelect) pageSizeSelect.style.display = mode === 'page' ? 'inline' : 'none'

	// Toggle background color for page mode (gray vs white canvas)
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

window.toggleLayout = function () {
	const modes = ['scroll', 'wrap', 'page']
	const idx = modes.indexOf(getLayoutMode())
	const next = modes[(idx + 1) % modes.length]
	setLayoutMode(next)
	localStorage.setItem(LAYOUT_STORAGE_KEY, next)
	updateLayoutButton()
	rerender()
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

// Restore persisted preferences
const storedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)
if (storedLayout === 'wrap' || storedLayout === 'scroll' || storedLayout === 'page') {
	setLayoutMode(storedLayout)
}
const storedPageSize = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
if (storedPageSize) setPageSize(storedPageSize)
if (pageSizeSelect) pageSizeSelect.value = getPageSize()
updateLayoutButton()

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

// ---- Spacing model toggle (current ↔ spring) ----

const SPACING_STORAGE_KEY = 'nwc_spacing_model'

function updateSpacingButton() {
	var btn = document.getElementById('spacing_toggle')
	if (btn) btn.textContent = getSpacingModel() === 'spring' ? 'Spring' : 'Fixed'
}

window.toggleSpacing = function () {
	var next = getSpacingModel() === 'spring' ? 'current' : 'spring'
	setSpacingModel(next)
	localStorage.setItem(SPACING_STORAGE_KEY, next)
	updateSpacingButton()
	rerender()
}

// Restore persisted spacing preference
var storedSpacing = localStorage.getItem(SPACING_STORAGE_KEY)
if (storedSpacing === 'current' || storedSpacing === 'spring') {
	setSpacingModel(storedSpacing)
}
updateSpacingButton()

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
