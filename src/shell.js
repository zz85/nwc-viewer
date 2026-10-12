/**
 * shell.js — the frame around the score: the drawers that open from the top
 * bar (the menu on the left, Appearance on the right), the Studio / Light
 * theme, the score's title in the bar, and "About this score".
 * Playback lives in transport.js; what goes in the menu comes from slots.js.
 */

const drawers = []

/**
 * Open `panel` from `button`; one drawer at a time. Outside clicks, Esc and
 * [data-close] buttons close it.
 * @returns {{ open: (show?: boolean) => void, close: () => void, isOpen: () => boolean }}
 */
export function bindDrawer(button, panel, { onOpen } = {}) {
	const set = (show) => {
		if (show) for (const d of drawers) if (d.panel !== panel) d.close()
		panel.classList.toggle('open', show)
		panel.setAttribute('aria-hidden', String(!show))
		button.classList.toggle('active', show)
		button.setAttribute('aria-expanded', String(show))
		if (show) onOpen?.()
	}
	const drawer = {
		panel,
		open: (show = true) => set(show),
		close: () => { if (panel.classList.contains('open')) set(false) },
		isOpen: () => panel.classList.contains('open'),
	}
	drawers.push(drawer)
	button.addEventListener('click', (e) => {
		e.stopPropagation()
		set(!drawer.isOpen())
	})
	for (const b of panel.querySelectorAll('[data-close]')) b.addEventListener('click', () => drawer.close())
	document.addEventListener('click', (e) => {
		if (drawer.isOpen() && !panel.contains(e.target) && !button.contains(e.target)) drawer.close()
	})
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && drawer.isOpen()) {
			drawer.close()
			button.focus()
		}
	})
	return drawer
}

export function closeDrawers() {
	for (const d of drawers) d.close()
}

// ── Theme ──

const THEME_STORAGE_KEY = 'nwc_theme'
const themeListeners = []

export function getTheme() {
	return document.body.classList.contains('theme-light') ? 'light' : 'studio'
}

export function setTheme(name) {
	const light = name === 'light'
	document.body.classList.toggle('theme-light', light)
	localStorage.setItem(THEME_STORAGE_KEY, light ? 'light' : 'studio')
	for (const fn of themeListeners) fn(getTheme())
}

export function onThemeChange(fn) {
	themeListeners.push(fn)
	fn(getTheme())
}

export function restoreTheme() {
	setTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'studio')
}

// ── The score's title in the top bar ──

/**
 * Title and composer in the top bar; click the title to rename it (Enter
 * keeps, Esc cancels).
 * @param {{ title: HTMLElement, sub: HTMLElement, onRename: (value: string) => void }} opts
 */
export function docHeader({ title, sub, onRename }) {
	let current = ''
	const begin = () => {
		if (title.isContentEditable) return
		title.contentEditable = 'true'
		title.textContent = current
		title.focus()
		document.getSelection()?.selectAllChildren(title)
	}
	const end = (keep) => {
		if (!title.isContentEditable) return
		title.contentEditable = 'false'
		const value = title.textContent.replace(/\s+/g, ' ').trim()
		title.textContent = current || 'Untitled'
		if (keep && value !== current) onRename(value)
	}
	title.addEventListener('click', begin)
	title.addEventListener('keydown', (e) => {
		if (!title.isContentEditable) {
			if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin() }
			return
		}
		if (e.key === 'Enter') { e.preventDefault(); end(true) }
		else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false) }
	})
	title.addEventListener('blur', () => end(true))
	return {
		update(info = {}, fallback = '') {
			current = info.title || ''
			if (!title.isContentEditable) title.textContent = current || fallback || 'Untitled'
			sub.textContent = [info.author, info.lyricist].filter(Boolean).join(' · ')
			document.title = (current || fallback || 'Untitled') + ' — Notably'
		},
	}
}

// ── About this score ──

/** Fill and open the About dialog with [label, value] rows (empty values are left out). */
export function showAbout(dialog, rows) {
	const list = dialog.querySelector('dl')
	list.replaceChildren()
	for (const [label, value] of rows) {
		const v = value == null ? '' : String(value).trim()
		if (!v) continue
		const dt = document.createElement('dt')
		dt.textContent = label
		const dd = document.createElement('dd')
		dd.textContent = v
		list.append(dt, dd)
	}
	dialog.showModal()
}
