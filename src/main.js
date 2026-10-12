import './constants.js'
import { getFontSize, setFontSize, getLayoutMode, setLayoutMode, setPageSize, getPageSize, setPageOrientation, getPageOrientation, getMusicFont, setMusicFont, getSpringDensity, setSpringDensity, getRodSpringBalance, setRodSpringBalance, getDurationProportionality, setDurationProportionality, getZoomLevel, setZoomLevel, getPageDimensions, setPageViewMode, getPageViewMode, setZoomFitMode, getZoomFitMode, setShowHiddenItems } from './constants.js'
import { ajax } from './loaders.js'
import { decodeNwcArrayBuffer, getUseNewParser, setUseNewParser } from './nwc.js'
import { decodeMidiArrayBuffer, isMidiFile } from './midi-import.js'
import { interpret } from './interpreter.js'
import { setup, resizeToFit, changeFont } from './drawing.js'
import { exportLilypond } from './exporter.js'
import { score, renderPage, getTitleFields, setPlaybackHighlighter, setInkBleedRenderer } from './layout/typeset.js'
import { TitleEditor } from './title-editor.js'
import { getDraft, getDraftPayload, saveEdit, clearDraft, getLastDoc, setLastDoc } from './drafts.js'
import { buildSaveFile, isNoteWorthy } from './save.js'
import { sampleLink, embeddedLink, readLink } from './share.js'
import { buildPdf, canvasToPdfImage } from './pdf-writer.js'
import { blank } from './editing.js'
import { MusicContext } from './context.js'
import { PlaybackController, buildNoteEvents } from './audio.js'
import { Transport } from './transport.js'
import { buildTimeline, stepBars } from './transport-timeline.js'
import { registerCommand, bindShortcuts, openShortcutSheet, closeShortcutSheet, shortcutSheetOpen } from './commands.js'
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
	'HappyBirthdayTrio.nwctxt', // nwctxt (oboe, viola, double bass)
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
const LAST_SONG_KEY = 'nwc_last_song'
const isSample = (name) => samples.includes(name) || nwcSamples.includes(name)

// How the next processData() document was opened: 'sample' (address bar
// shows ?song=), 'link' (opened from a shared link) or null (local file)
let nextDocSource = null
let nextDocEdits = null

function loadSample(name) {
	const path = samples.includes(name) ? 'samples/' : 'nwcs/'
	ajax(path + name, (buf) => {
		nextDocSource = 'sample'
		processData(buf, name)
	})
	if (sample_dom) sample_dom.value = name
	localStorage.setItem(LAST_SONG_KEY, name)
}

sample_dom.onchange = function () {
	loadSample(sample_dom.value)
}

// Opening: a shared link first, then the last document if it has unsaved
// changes, else the last song (or WhatChildIsThis). Async, so it runs after
// this module has finished initializing (processData uses it).
async function openInitialScore() {
	let link = null
	try {
		link = await readLink(location.href)
	} catch (error) {
		console.warn('Could not read the shared link:', error)
	}
	if (link?.song && isSample(link.song)) return loadSample(link.song)
	if (link?.bytes) {
		nextDocSource = 'link'
		nextDocEdits = link.edits
		if (sample_dom && isSample(link.name)) sample_dom.value = link.name
		return processData(link.bytes, link.name)
	}
	const lastDoc = getLastDoc()
	const lastDocBytes = lastDoc ? getDraftPayload(lastDoc) : null
	if (lastDocBytes) {
		if (sample_dom && isSample(lastDoc)) sample_dom.value = lastDoc
		return processData(lastDocBytes, lastDoc)
	}
	loadSample(localStorage.getItem(LAST_SONG_KEY) || 'WhatChildIsThis.nwc')
}
openInitialScore()

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

// 3D view (src/view3d/view3d.js, loaded on first use); see "3D view" below
let view3d = null
let view3dActive = false

// ---- Transport (src/transport.js): the playback bar over the bottom of the score ----

const VOLUME_STORAGE_KEY = 'nwc_volume'
const MUTED_STORAGE_KEY = 'nwc_muted'
let timeline = buildTimeline(null)

const transport = new Transport(document.getElementById('transport'), {
	onToggle: () => togglePlayPause(),
	onRestart: () => restart(),
	onSeek: (t) => seekTo(t),
	onVolume: (volume, muted) => setVolume(volume, muted),
	onSpeed: (speed) => setSpeed(speed),
})

function setVolume(volume, muted) {
	playback.setVolume(muted ? 0 : volume)
	transport.setVolume(volume, muted)
	localStorage.setItem(VOLUME_STORAGE_KEY, String(volume))
	localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0')
}
{
	const stored = parseFloat(localStorage.getItem(VOLUME_STORAGE_KEY))
	setVolume(isFinite(stored) ? stored : 0.8, localStorage.getItem(MUTED_STORAGE_KEY) === '1')
}

function setSpeed(speed) {
	if (!isFinite(speed) || speed <= 0) return
	const clamped = Math.max(0.1, Math.min(4, speed))
	playback.setSpeed(clamped)
	transport.setSpeed(clamped)
}

// Speed steps for < and >, like a video player's
const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
function stepSpeed(dir) {
	const s = playback.speed
	const next = dir > 0 ? SPEED_STEPS.find(v => v > s + 1e-6) : [...SPEED_STEPS].reverse().find(v => v < s - 1e-6)
	if (next) setSpeed(next)
}

/** Bars, sections and length of the score, for the transport (after every layout). */
function updateTimeline(data) {
	try {
		timeline = buildTimeline(data, { duration: buildNoteEvents(data).duration })
	} catch (error) {
		console.warn('Transport timeline failed:', error)
		timeline = buildTimeline(null)
	}
	transport.setTimeline(timeline)
}

playback.onTime((t) => {
	transport.setTime(t)
	highlighter.updateTime(t)
	view3d?.onTime(t)
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
	transport.setPlaying(playing)
	// The 2D highlighter repaints the score every frame; not while it is hidden
	if (playing && !view3dActive) highlighter.start()
	else if (!playing) highlighter.pause()  // keep highlights frozen on pause
	view3d?.setPlaying(playing, playback.currentTime)
})

playback.onEnd(() => {
	transport.setTime(0)
	highlighter.stop()
	pianoKeyboard.clear()
	view3d?.setPlaying(false)
})

async function togglePlayPause() {
	if (playback.playing) {
		playback.pause()
	} else {
		// Load current score data before playing (playback resumes where it was)
		const data = scoreManager.getData()
		if (!data) return
		await playback.load(data)
		await playback.play()
	}
}

/** Jump to t seconds: the audio, the 2D cursor, the 3D view and the transport. */
function seekTo(t) {
	t = Math.max(0, Math.min(t, timeline.duration || t))
	playback.seek(t)
	highlighter.clearNotes()
	pianoKeyboard.clear()
	highlighter.updateTime(t)
	highlighter.resumeFollow()
	if (!highlighter.active) {
		const scoreElm = document.getElementById('score')
		quickDraw(null, -(scoreElm?.scrollLeft || 0), -(scoreElm?.scrollTop || 0))
	}
	view3d?.seek(t)
	transport.setTime(t)
}

function stopPlayback() {
	playback.stop()
	highlighter.stop()
	pianoKeyboard.clear()
	view3d?.setPlaying(false, 0)
	transport.setTime(0)
}

/** Back to the start: keeps playing from the top, or stops when paused. */
function restart() {
	if (playback.playing) seekTo(0)
	else stopPlayback()
}

// "Back to the playhead": following pauses while the reader scrolls away
const followPill = document.getElementById('follow_pill')
highlighter.onFollowChange = (suspended) => { followPill.hidden = !suspended }
followPill.onclick = () => highlighter.resumeFollow()
{
	const scoreElm = document.getElementById('score')
	const away = () => highlighter.suspendFollow()
	let downX = 0, downY = 0
	scoreElm.addEventListener('wheel', away, { passive: true })
	scoreElm.addEventListener('touchmove', away, { passive: true })
	scoreElm.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY })
	scoreElm.addEventListener('pointermove', (e) => {
		// drag-to-scroll (a click moves less than 5px)
		if (e.buttons & 1 && (e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 25) away()
	})
	document.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') away()
	})
}

// Highlight mode selector
const highlightSelect = document.getElementById('highlight_mode')
if (highlightSelect) {
	highlightSelect.onchange = () => {
		highlighter.setHighlightMode(highlightSelect.value)
	}
}

// Click-to-edit title block: click the title, author or lyricist to edit it
const titleEditor = new TitleEditor({
	scoreElm: document.getElementById('score'),
	getCanvas: () => window.canvas,
	getZoom: getZoomLevel,
	getFields: getTitleFields,
	onCommit: (field, value) => {
		const data = scoreManager.getData()
		if (!data) return
		data.info = data.info || {}
		data.info[field] = value
		recordEdit(field, value)
		rerender()
	},
})

// ---- Unsaved changes ----
// Edits are kept in localStorage (src/drafts.js) until the score is saved,
// and re-applied when the same file is opened again.

let sessionEdits = {}      // edits to the open file (kept after saving, for the next save)
let pendingDoc = null      // file being opened by processData(), for draft lookup

function recordEdit(field, value) {
	sessionEdits[field] = value
	const name = window.__currentFile
	const kept = name && window._lastPayload ? saveEdit(name, window._lastPayload, field, value) : false
	setUnsavedStatus(kept ? 'Unsaved changes' : "Unsaved changes (couldn't keep them in this browser)", true)
}

function setUnsavedStatus(text, canDiscard) {
	const status = document.getElementById('unsaved_status')
	if (!status) return
	status.hidden = !text
	document.getElementById('unsaved_text').textContent = text || ''
	status.title = canDiscard ? 'Kept in this browser until you save' : ''
	document.getElementById('discard_changes').hidden = !canDiscard
}

/** Called for every newly loaded score: re-apply its draft, if any. */
function applyDraft(data) {
	sessionEdits = {}
	const doc = pendingDoc
	pendingDoc = null
	if (!doc) {
		setUnsavedStatus('')
		return
	}
	setLastDoc(doc.name)
	// Keep the address bar shareable: ?song= for samples, the shared link as
	// opened, nothing for local files (the old link would open another score)
	if (doc.source === 'sample') history.replaceState(null, '', sampleLink(location.href, doc.name))
	else if (doc.source !== 'link' && (location.search || location.hash)) history.replaceState(null, '', location.pathname)

	const draft = getDraft(doc.name, doc.payload)
	if (draft && Object.keys(draft.edits).length) {
		data.info = Object.assign(data.info || {}, draft.edits)
		sessionEdits = { ...draft.edits }
		setUnsavedStatus('Restored unsaved changes', true)
	} else if (doc.edits && Object.keys(doc.edits).length) {
		// Edits that came with a shared link are this browser's unsaved changes
		for (const [field, value] of Object.entries(doc.edits)) {
			data.info = data.info || {}
			data.info[field] = value
			recordEdit(field, value)
		}
	} else {
		setUnsavedStatus('')
	}
}

/** Show a short message in the status area, then return to the unsaved state. */
function flashStatus(text) {
	setUnsavedStatus(text, false)
	setTimeout(() => {
		if (document.getElementById('unsaved_text').textContent !== text) return
		const name = window.__currentFile
		const unsaved = name && window._lastPayload && getDraft(name, window._lastPayload)
		setUnsavedStatus(unsaved ? 'Unsaved changes' : '', !!unsaved)
	}, 2500)
}

// ---- Share ----

/** Copy a link that opens the current score (with its edits). */
async function copyShareLink() {
	const name = window.__currentFile
	const payload = window._lastPayload
	if (!payload) return
	const edited = Object.keys(sessionEdits).length > 0
	const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
	const link = isSample(name) && !edited
		? sampleLink(location.href, name)
		: await embeddedLink(location.href, bytes, name, sessionEdits)
	try {
		await navigator.clipboard.writeText(link)
		flashStatus('Link copied')
	} catch {
		prompt('Copy this link:', link)
	}
	return link
}
window.copyShareLink = copyShareLink

const shareBtn = document.getElementById('share_btn')
if (shareBtn) {
	shareBtn.onclick = () => copyShareLink().catch((error) => {
		console.error('Share failed:', error)
		alert(`Could not make a link: ${error.message}`)
	})
}

const discardBtn = document.getElementById('discard_changes')
if (discardBtn) {
	discardBtn.onclick = () => {
		const name = window.__currentFile
		if (!name || !window._lastPayload) return
		clearDraft(name)
		processData(window._lastPayload, name)
	}
}

// ---- Save ----

const saveBtn = document.getElementById('save_btn')
const saveMenu = document.getElementById('save_menu')
if (saveBtn && saveMenu) {
	const setOpen = (open) => {
		saveMenu.classList.toggle('open', open)
		saveBtn.setAttribute('aria-expanded', String(open))
		if (!open) return
		const supported = !!window._lastPayload && isNoteWorthy(window._lastPayload)
		// PDF export works for any score; the file formats need a NoteWorthy source
		for (const item of saveMenu.querySelectorAll('button[data-format]')) item.disabled = !supported
		document.getElementById('save_hint').hidden = supported
	}
	saveBtn.onclick = (e) => {
		e.stopPropagation()
		setOpen(!saveMenu.classList.contains('open'))
	}
	document.addEventListener('click', (e) => {
		if (!saveMenu.contains(e.target) && e.target !== saveBtn) setOpen(false)
	})
	saveMenu.addEventListener('click', async (e) => {
		const item = e.target.closest('button[data-format]')
		if (!item) return
		setOpen(false)
		try {
			await saveAs(item.dataset.format)
		} catch (error) {
			console.error('Save failed:', error)
			alert(`Save failed: ${error.message}`)
		}
	})
}

/** Download the open score in `format` with the edits made to it. */
async function saveAs(format) {
	const name = window.__currentFile
	const payload = window._lastPayload
	if (!payload) return
	const file = await buildSaveFile(format, payload, sessionEdits)
	downloadFile(file.data, baseFileName() + '.' + file.ext, file.type)
	// The changes are in the saved file now; stop restoring them
	if (name) clearDraft(name)
	flashStatus('Saved')
}
window.saveAs = saveAs

function baseFileName() {
	const title = scoreManager.getData()?.info?.title || ''
	return (window.__currentFile || title || 'score').replace(/\.[^.]+$/, '')
}

function downloadFile(data, filename, type) {
	const url = URL.createObjectURL(new Blob([data], { type }))
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Click-to-seek: clicking on the score positions the playback cursor.
// Distinguishes clicks from drag-scrolls using a 5px movement threshold.
// A click on the title block edits it instead.
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

		if (titleEditor.handleClick(e)) return

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

		seekTo(time)
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
		rebuild3D()  // only audible staves light up
	}
}

// Piano keyboard toggle. The choice is remembered; without one, the keyboard
// starts hidden on narrow screens where it would take a large share of the
// height.
const PIANO_STORAGE_KEY = 'nwc_piano_visible'
const pianoToggleBtn = document.getElementById('piano_toggle')
{
	const stored = localStorage.getItem(PIANO_STORAGE_KEY)
	const showPiano = stored !== null ? stored === '1' : window.innerWidth > 700
	if (!showPiano) pianoKeyboard.hide()
	if (pianoToggleBtn) pianoToggleBtn.classList.toggle('active', showPiano)
}
if (pianoToggleBtn) {
	pianoToggleBtn.onclick = () => {
		const visible = pianoKeyboard.toggle()
		pianoToggleBtn.classList.toggle('active', visible)
		localStorage.setItem(PIANO_STORAGE_KEY, visible ? '1' : '0')
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
				// Page count changes with every layout; refresh the "n / total" nav
				if (currentPageIdx >= (window._pageGeometry?.pageCount || 1)) currentPageIdx = 0
				updatePageNav()

				// Update highlighter with new layout positions
				highlighter.setScore(data)
				updateTimeline(data)
				rebuild3D()
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

// Text fonts load lazily (the SMuFL text faces use CSS unicode-range), and
// canvas text drawn before a face arrives silently uses a fallback — e.g.
// metronome glyphs in tempo marks render as boxes. Re-render once loads finish.
if (typeof document !== 'undefined' && document.fonts) {
	document.fonts.addEventListener('loadingdone', () => {
		if (scoreManager.getData()) rerender()
	})
}

function setDataAndRender(_data) {
	stopPlayback()  // a new score starts at the top
	titleEditor.finish(false)
	applyDraft(_data)
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
		pendingDoc = filename ? { name: filename, payload, source: nextDocSource, edits: nextDocEdits } : null
		nextDocSource = nextDocEdits = null
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

// The old parser is a fallback (decodeNwcArrayBuffer switches to it when the
// new one fails); the toggle is for comparing them and lasts for this page
// only, so a stale choice can't stick.
function toggleParser() {
	setUseNewParser(!getUseNewParser())
	updateParserButton()
	if (window._lastPayload) {
		processData(window._lastPayload, window.__currentFile)
	}
}

const parserBtn = document.getElementById('parser_toggle')
if (parserBtn) parserBtn.onclick = toggleParser

// Earlier versions remembered the toggle; drop that so everyone starts on
// the new parser
localStorage.removeItem(PARSER_STORAGE_KEY)
updateParserButton()

// Show hidden items (Settings > Advanced): draw what the score hides as
// ghosts, for debugging and seeing how a file is set up. Page only.
const showHiddenBox = document.getElementById('show_hidden_items')
if (showHiddenBox) {
	showHiddenBox.checked = false
	showHiddenBox.onchange = () => {
		setShowHiddenItems(showHiddenBox.checked)
		if (scoreManager.getData()) rerender()
	}
}

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
			btn.classList.toggle('active', btn.dataset.mode === (view3dActive ? '3d' : mode))
		}
	}

	// Show/hide page-only controls
	const pageSizeEl = document.getElementById('page_size')
	const orientGroup = document.getElementById('orientation_group')
	const pageViewModeEl = document.getElementById('page_view_mode')
	const isPage = mode === 'page'
	document.body.classList.toggle('page-layout', isPage)
	if (pageSizeEl) pageSizeEl.style.display = isPage ? 'inline' : 'none'
	if (orientGroup) orientGroup.style.display = isPage ? 'inline-flex' : 'none'
	if (pageViewModeEl) pageViewModeEl.style.display = isPage ? 'inline' : 'none'
	const pageHint = document.getElementById('page_settings_hint')
	if (pageHint) pageHint.style.display = isPage ? 'none' : ''
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
		if (btn.dataset.mode === '3d') {
			enter3D()
			return
		}
		if (view3dActive) {
			exit3D(btn.dataset.mode)
			localStorage.setItem(LAYOUT_STORAGE_KEY, btn.dataset.mode)
			return
		}
		setLayoutMode(btn.dataset.mode)
		localStorage.setItem(LAYOUT_STORAGE_KEY, btn.dataset.mode)
		updateLayoutUI()
		rerender()
	})
}

// ---- 3D view ----
// Replaces #score with a three.js scene of the score (src/view3d/). It is
// built from the scroll layout (one long line), so opening it switches the
// layout to scroll and closing it restores the previous mode. Its options
// (Settings > 3D view) are remembered together in one localStorage entry.

const VIEW3D_STORAGE_KEY = 'nwc_view_3d'
const VIEW3D_OPTS_STORAGE_KEY = 'nwc_3d_opts'
const score3dEl = document.getElementById('score3d')
const score3dStatus = document.getElementById('score3d_status')
const view3dControls = document.querySelectorAll('[data-opt3d]')
let view3dLoading = null   // Promise of the View3D, once loading started
let layoutBefore3D = null

function set3DStatus(text) {
	score3dStatus.textContent = text || ''
	score3dStatus.hidden = !text
}

function load3DOptions() {
	try {
		return JSON.parse(localStorage.getItem(VIEW3D_OPTS_STORAGE_KEY)) || {}
	} catch {
		return {}
	}
}

function save3DOption(key, value) {
	const opts = load3DOptions()
	opts[key] = value
	localStorage.setItem(VIEW3D_OPTS_STORAGE_KEY, JSON.stringify(opts))
}

function read3DControl(el) {
	if (el.tagName === 'BUTTON') return el.classList.contains('active')
	if (el.type === 'range') return parseFloat(el.value)
	return el.value
}

function write3DControl(el, value) {
	if (el.tagName === 'BUTTON') el.classList.toggle('active', !!value)
	else if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === value)) return
	else el.value = value
	const label = document.querySelector(`[data-opt3d-label="${el.dataset.opt3d}"]`)
	if (label) label.textContent = parseFloat(el.value).toFixed(2)
}

/** Staves whose notes light up: the ones that are heard (solo / mute). */
function isStaffAudible(si) {
	if (playback.soloStaves.size) return playback.soloStaves.has(si)
	return !playback.muteStaves.has(si) && !scoreManager.getData()?.score?.staves[si]?.muted
}

function ensureView3D() {
	view3dLoading ||= import('./view3d/view3d.js').then(({ View3D }) => {
		const options = {}
		for (const el of view3dControls) options[el.dataset.opt3d] = read3DControl(el)
		view3d = new View3D(score3dEl, {
			options,
			getSpeed: () => playback.speed,
			onViewChange: (view) => {
				for (const el of view3dControls) if (el.dataset.opt3d === 'view') write3DControl(el, view)
				save3DOption('view', view)
			},
		})
		return view3d
	})
	return view3dLoading
}

/**
 * Rebuild the 3D scene from the current (scroll) layout, if the view is open.
 * Coalesced to one rebuild per frame: rerenders come in bursts (text fonts
 * arriving), and a rebuild costs far more than a 2D layout.
 */
let rebuild3DPending = false
function rebuild3D() {
	if (!view3dActive || !view3d || rebuild3DPending) return
	rebuild3DPending = true
	requestAnimationFrame(() => {
		rebuild3DPending = false
		const data = scoreManager.getData()
		if (!view3dActive || !data) return
		try {
			view3d.rebuild(data, isStaffAudible)
			set3DStatus('')
		} catch (error) {
			console.error('3D view failed:', error)
			set3DStatus('3D view failed: ' + error.message)
		}
	})
}

async function enter3D() {
	if (view3dActive) return
	view3dActive = true
	layoutBefore3D = getLayoutMode()
	localStorage.setItem(VIEW3D_STORAGE_KEY, '1')
	document.body.classList.add('view-3d')
	score3dEl.hidden = false
	if (highlighter.active) highlighter.pause()
	setLayoutMode('scroll')
	updateLayoutUI()
	if (!view3d) set3DStatus('Loading 3D view…')
	try {
		await ensureView3D()
	} catch (error) {
		console.error('Could not load the 3D view:', error)
		view3dLoading = null
		set3DStatus('Could not load the 3D view: ' + error.message)
		return
	}
	if (!view3dActive) return  // closed while loading
	set3DStatus('')
	view3d.setPlaying(playback.playing, playback.currentTime)
	view3d.show()
	if (scoreManager.getData()) rerender()  // lays out in scroll mode, then rebuild3D()
}

function exit3D(mode) {
	if (!view3dActive) return
	view3dActive = false
	localStorage.setItem(VIEW3D_STORAGE_KEY, '0')
	view3d?.hide()
	set3DStatus('')
	score3dEl.hidden = true
	document.body.classList.remove('view-3d')
	setLayoutMode(mode || layoutBefore3D || 'wrap')
	updateLayoutUI()
	if (scoreManager.getData()) rerender()
	if (playback.playing) highlighter.start()
}

{
	const stored = load3DOptions()
	for (const el of view3dControls) {
		const key = el.dataset.opt3d
		if (key in stored) write3DControl(el, stored[key])
		const commit = () => {
			const value = read3DControl(el)
			save3DOption(key, value)
			view3d?.setOption(key, value)
		}
		if (el.tagName === 'BUTTON') {
			el.onclick = () => {
				el.classList.toggle('active')
				commit()
			}
		} else if (el.type === 'range') {
			el.oninput = () => {
				write3DControl(el, el.value)
				commit()
			}
		} else {
			el.onchange = commit
		}
	}
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
if (localStorage.getItem(VIEW3D_STORAGE_KEY) === '1') enter3D()

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

// ---- PDF export ----

const PDF_FIT_STORAGE_KEY = 'nwc_pdf_fit_one_page'
const PDF_DPI = 300
const SCORE_DPI = 96            // page sizes are in px at 96 DPI
const FIT_MIN_FONT_SIZE = 12    // smallest staff size "fit on one page" goes to

const pdfFitCheckbox = document.getElementById('pdf_fit_one_page')
if (pdfFitCheckbox) {
	pdfFitCheckbox.checked = localStorage.getItem(PDF_FIT_STORAGE_KEY) === 'true'
	pdfFitCheckbox.onchange = () => localStorage.setItem(PDF_FIT_STORAGE_KEY, String(pdfFitCheckbox.checked))
}

/**
 * Lay the score out on pages (size and orientation from the page settings)
 * and download it as a PDF.  With "fit on one page", the staff size is
 * reduced step by step until the score fits.  The on-screen layout and staff
 * size are restored afterwards; layout is synchronous, so the screen never
 * shows the temporary page layout.
 */
async function exportPdf() {
	const prevMode = getLayoutMode()
	const prevFontSize = getFontSize()
	const fitOnePage = !!pdfFitCheckbox?.checked
	const pageCount = () => window._pageGeometry?.pageCount || 1
	let canvases, pg, exportFontSize
	try {
		setLayoutMode('page')
		rerender()
		while (fitOnePage && pageCount() > 1 && getFontSize() - 4 >= FIT_MIN_FONT_SIZE) {
			setFontSize(getFontSize() - 4)
			rerender()
		}
		pg = window._pageGeometry
		if (!pg) throw new Error('page layout is not available')
		exportFontSize = getFontSize()
		canvases = []
		for (let i = 0; i < pg.pageCount; i++) canvases.push(renderPage(i, PDF_DPI / SCORE_DPI))
	} finally {
		setLayoutMode(prevMode)
		setFontSize(prevFontSize)
		rerender()
	}

	const ptPerPx = 72 / SCORE_DPI
	const pages = []
	for (const canvas of canvases) {
		pages.push({ widthPt: pg.pageWidth * ptPerPx, heightPt: pg.pageHeight * ptPerPx, image: await canvasToPdfImage(canvas) })
	}
	const title = scoreManager.getData()?.info?.title || ''
	downloadFile(buildPdf(pages, title), baseFileName() + '.pdf', 'application/pdf')

	if (fitOnePage && pages.length > 1) {
		alert(`The score doesn't fit on one page even at the smallest staff size, so the PDF has ${pages.length} pages.`)
	}
	return { pageCount: pages.length, fontSize: exportFontSize }
}

const exportPdfBtn = document.getElementById('export_pdf')
if (exportPdfBtn) {
	exportPdfBtn.onclick = async () => {
		saveMenu?.classList.remove('open')
		exportPdfBtn.disabled = true
		try {
			await exportPdf()
		} catch (error) {
			console.error('PDF export failed:', error)
			alert(`PDF export failed: ${error.message}`)
		} finally {
			exportPdfBtn.disabled = false
		}
	}
}
window.exportPdf = exportPdf

// ---- Settings menu ----

const settingsToggle = document.getElementById('settings_toggle')
const settingsPanel = document.getElementById('settings_panel')
if (settingsToggle && settingsPanel) {
	const setSettingsOpen = (open) => {
		settingsPanel.classList.toggle('open', open)
		settingsToggle.classList.toggle('active', open)
		settingsToggle.setAttribute('aria-expanded', String(open))
	}
	settingsToggle.onclick = (e) => {
		e.stopPropagation()
		setSettingsOpen(!settingsPanel.classList.contains('open'))
	}
	document.addEventListener('click', (e) => {
		if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) setSettingsOpen(false)
	})
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && settingsPanel.classList.contains('open')) {
			setSettingsOpen(false)
			settingsToggle.focus()
		}
	})
}

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

// ---- Keyboard shortcuts (src/commands.js) ----
// A video player's keys where they fit (Space/K, M, F, 0–9, < >, ?), bars
// where music needs them: ← → step a bar, J / L and ⇧← / ⇧→ five bars.
// ↑ ↓ are left to scroll the score.

{
	const nowTime = () => playback.currentTime
	const seekBars = (n) => seekTo(stepBars(timeline, nowTime(), n))
	const toggleLayout = (i) => document.querySelectorAll('#layout_group button')[i]?.click()

	registerCommand({ id: 'play', label: 'Play / pause', group: 'Playback', keys: ['Space', 'k'], run: () => { togglePlayPause() } })
	registerCommand({ id: 'start', label: 'Back to the start', group: 'Playback', keys: ['Home', '0'], run: () => seekTo(0) })
	registerCommand({ id: 'bar-prev', label: 'Previous / next bar', group: 'Playback', keys: ['ArrowLeft'], keyLabel: '← →', run: () => seekBars(-1) })
	registerCommand({ id: 'bar-next', label: 'Next bar', group: 'Playback', keys: ['ArrowRight'], sheet: false, run: () => seekBars(1) })
	registerCommand({ id: 'bars-back', label: 'Back / ahead 5 bars', group: 'Playback', keys: ['j', 'Shift+ArrowLeft'], keyLabel: 'J L', run: () => seekBars(-5) })
	registerCommand({ id: 'bars-ahead', label: 'Ahead 5 bars', group: 'Playback', keys: ['l', 'Shift+ArrowRight'], sheet: false, run: () => seekBars(5) })
	registerCommand({
		id: 'jump', label: 'Jump to 10% … 90%', group: 'Playback', keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], keyLabel: '1 … 9',
		run: (e) => seekTo(timeline.duration * (+e.key) / 10),
	})
	registerCommand({ id: 'slower', label: 'Slower / faster', group: 'Playback', keys: ['<'], keyLabel: '< >', run: () => stepSpeed(-1) })
	registerCommand({ id: 'faster', label: 'Faster', group: 'Playback', keys: ['>'], sheet: false, run: () => stepSpeed(1) })
	registerCommand({ id: 'mute', label: 'Mute', group: 'Playback', keys: ['m'], run: () => transport.toggleMute() })

	registerCommand({ id: 'fullscreen', label: 'Full screen', group: 'View', keys: ['f'], run: () => transport.toggleFullscreen() })
	registerCommand({ id: 'piano', label: 'Piano keyboard', group: 'View', keys: ['p'], run: () => pianoToggleBtn?.click() })
	registerCommand({
		id: 'layouts', label: 'Scroll · Wrap · Page · 3D', group: 'View', keys: ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4'], keyLabel: '⌥1 … ⌥4',
		run: (e) => toggleLayout(+e.code.slice(5) - 1),
	})
	registerCommand({
		id: 'page-prev', label: 'Previous / next page', group: 'View', keys: ['PageUp'], keyLabel: 'PgUp PgDn',
		when: () => getLayoutMode() === 'page' && !view3dActive, run: () => pagePrevBtn?.click(),
	})
	registerCommand({
		id: 'page-next', label: 'Next page', group: 'View', keys: ['PageDown'], sheet: false,
		when: () => getLayoutMode() === 'page' && !view3dActive, run: () => pageNextBtn?.click(),
	})

	registerCommand({ id: 'help', label: 'Keyboard shortcuts', group: 'Help', keys: ['?'], run: () => (shortcutSheetOpen() ? closeShortcutSheet() : openShortcutSheet()) })
	registerCommand({
		id: 'close', label: 'Close', group: 'Help', keys: ['Escape'],
		when: () => shortcutSheetOpen() || transport.speedOpen,
		run: () => { closeShortcutSheet(); transport.closeSpeed() },
	})
	bindShortcuts()

	const shortcutsBtn = document.getElementById('shortcuts_btn')
	if (shortcutsBtn) shortcutsBtn.onclick = (e) => {
		e.stopPropagation()
		if (settingsPanel?.classList.contains('open')) settingsToggle.click()
		openShortcutSheet()
	}
}
