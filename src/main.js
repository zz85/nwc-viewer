import './constants.js'
import { getLayoutMode } from './constants.js'
import { ajax } from './loaders.js'
import { decodeNwcArrayBuffer, getUseNewParser, setUseNewParser } from './nwc.js'
import { interpret } from './interpreter.js'
import { setup, resizeToFit } from './drawing.js'
import { exportLilypond } from './exporter.js'
import { score, setPlaybackHighlighter } from './layout/typeset.js'
import { blank } from './editing.js'
import { MusicContext } from './context.js'
import { PlaybackController } from './audio.js'
import { PlaybackHighlighter } from './playback-highlight.js'

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
}

// Default loading
ajax('samples/WhatChildIsThis.nwc', (buf) => processData(buf, 'WhatChildIsThis.nwc'))

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

playback.onNoteOn((ev) => highlighter.onNoteOn(ev))
playback.onNoteOff((ev) => highlighter.onNoteOff(ev))

playback.onStateChange((playing) => {
	playBtn.textContent = playing ? 'Pause' : 'Play'
	if (playing) highlighter.start()
	else highlighter.stop()
})

playback.onEnd(() => {
	playBtn.textContent = 'Play'
	progressBar.value = 0
	timeLabel.textContent = formatTime(0) + ' / ' + formatTime(playback.duration)
	highlighter.stop()
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
	progressBar.value = 0
	timeLabel.textContent = formatTime(0) + ' / ' + formatTime(playback.duration)
}

progressBar.addEventListener('pointerdown', () => { _seeking = true })

// Highlight style toggle
const highlightBtn = document.getElementById('highlight_toggle')
if (highlightBtn) {
	highlightBtn.onclick = () => {
		const newStyle = highlighter.toggleStyle()
		highlightBtn.textContent = 'Highlight: ' + (newStyle === 'glow' ? 'Glow' : 'Color')
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
	// data = _data;
	// window.data = data;
	rerender()
}

function processData(payload, filename) {
	try {
		window._lastPayload = payload
		window.__currentFile = filename || '(unknown)'
		window.__renderComplete = null
		var data = decodeNwcArrayBuffer(payload)
		setDataAndRender(data)
	} catch (error) {
		console.error('Failed to process NWC file:', error)
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

// ---- Layout mode toggle (scroll vs wrap) ----

const LAYOUT_STORAGE_KEY = 'nwc_layout_mode'

function updateLayoutButton() {
	const btn = document.getElementById('layout_toggle')
	if (btn) btn.textContent = getLayoutMode() === 'wrap' ? 'Wrap' : 'Scroll'
}

window.toggleLayout = function () {
	const next = getLayoutMode() === 'scroll' ? 'wrap' : 'scroll'
	setLayoutMode(next)
	localStorage.setItem(LAYOUT_STORAGE_KEY, next)
	updateLayoutButton()
	rerender()
}

// Restore persisted layout preference
const storedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY)
if (storedLayout === 'wrap' || storedLayout === 'scroll') {
	setLayoutMode(storedLayout)
}
updateLayoutButton()
