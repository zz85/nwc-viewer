/**
 * parts-panel.js — the Parts panel (plans/ui-ux-philosophy.md, "Parts"): one
 * row per staff to mix what you hear and choose what you see. Each row has
 * the staff's colour and name, an eye that hides it from the score, Mute
 * and Solo, its instrument and a volume slider. It is a light panel, not a
 * DAW mixer; the choices last until another score is opened.
 *
 * It draws and reports; playback (PlaybackController) keeps the mix, main.js
 * re-lays out the score and re-lights the views.
 */
import { GM_PATCHES } from '../lib/nwc2xml/constants.js'
import { STAFF_COLORS } from './piano-keyboard.js'
import { assignChannels } from './audio.js'

const DRUM_CHANNEL = 9

/**
 * @param {HTMLElement} container - where the rows go
 * @param {object} opts
 * @param {import('./audio.js').PlaybackController} opts.playback
 * @param {() => Promise<void>|void} opts.onHeardChange - mute or solo changed
 * @param {() => void} opts.onShownChange - a staff was hidden or shown
 */
export function createPartsPanel(container, { playback, onHeardChange, onShownChange }) {
	let staves = []

	const button = (cls, text, title) => {
		const b = document.createElement('button')
		b.className = 'part-btn ' + cls
		b.textContent = text
		b.title = title
		return b
	}

	function refresh() {
		const shownCount = staves.filter(s => !s.hidden).length
		container.querySelectorAll('.part-row').forEach(row => {
			const si = +row.dataset.staff
			const st = staves[si]
			const heard = playback.isHeard(si)
			row.classList.toggle('silent', !heard)
			row.classList.toggle('hidden-staff', !!st.hidden)
			const muted = playback.muteOn(si)
			const set = (sel, on, title) => {
				const b = row.querySelector(sel)
				b.classList.toggle('active', on)
				b.setAttribute('aria-pressed', String(on))
				if (title) b.title = title
			}
			set('.part-mute', muted, muted ? 'Unmute' : 'Mute')
			set('.part-solo', playback.isSoloed(si), playback.isSoloed(si) ? 'Unsolo' : 'Solo: hear only the soloed staves')
			set('.part-eye', !st.hidden, st.hidden ? 'Show in the score' : 'Hide from the score')
			row.querySelector('.part-eye use').setAttribute('href', st.hidden ? '#i-eye-off' : '#i-eye')
			// The score always shows at least one staff
			row.querySelector('.part-eye').disabled = !st.hidden && shownCount <= 1
		})
	}

	/** Draw the rows for a newly opened score (and forget the old one's mix). */
	function render(data) {
		staves = data?.score?.staves || []
		playback.resetParts()
		playback.setFileMuted(staves)
		const channels = assignChannels(staves)
		container.replaceChildren(...staves.map((st, si) => {
			const row = document.createElement('div')
			row.className = 'part-row'
			row.dataset.staff = si

			const head = document.createElement('div')
			head.className = 'part-head'
			const swatch = document.createElement('span')
			swatch.className = 'part-swatch'
			swatch.style.background = STAFF_COLORS[si % STAFF_COLORS.length]
			const name = document.createElement('span')
			name.className = 'part-name'
			name.textContent = st.staff_name || st.staff_label || `Staff ${si + 1}`
			name.title = name.textContent
			const eye = button('part-eye', '', 'Hide from the score')
			eye.innerHTML = '<svg class="i"><use href="#i-eye"/></svg>'
			eye.setAttribute('aria-label', 'Shown in the score')
			const mute = button('part-mute', 'M', 'Mute')
			const solo = button('part-solo', 'S', 'Solo')
			head.append(swatch, name, eye, mute, solo)

			const mix = document.createElement('div')
			mix.className = 'part-mix'
			const instrument = document.createElement('select')
			instrument.className = 'part-instrument'
			instrument.title = 'Instrument'
			if (channels[si] === DRUM_CHANNEL) {
				instrument.append(new Option('Drums', ''))
				instrument.disabled = true
			} else {
				GM_PATCHES.forEach((label, program) => instrument.append(new Option(label, program)))
				instrument.value = String(playback.programOf(si, staves))
			}
			const volume = document.createElement('input')
			volume.type = 'range'
			volume.className = 'part-volume'
			volume.min = 0
			volume.max = 1
			volume.step = 0.01
			volume.value = playback.staffLevel(si)
			volume.setAttribute('aria-label', `${name.textContent} volume`)
			mix.append(instrument, volume)

			mute.onclick = async () => {
				playback.setMute(si, !playback.muteOn(si))
				refresh()
				await onHeardChange()
			}
			solo.onclick = async () => {
				playback.setSolo(si, !playback.isSoloed(si))
				refresh()
				await onHeardChange()
			}
			eye.onclick = () => {
				st.hidden = !st.hidden
				refresh()
				onShownChange()
			}
			instrument.onchange = () => playback.setStaffProgram(si, +instrument.value)
			volume.oninput = () => playback.setStaffLevel(si, +volume.value)

			row.append(head, mix)
			return row
		}))
		refresh()
	}

	return { render, refresh }
}
