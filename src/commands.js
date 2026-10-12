/**
 * commands.js — named commands with keyboard shortcuts, and the "?" sheet
 * that lists them.
 *
 * Every feature registers what it can do here instead of adding its own
 * keydown listener: one place resolves keys, skips them while typing, and
 * documents them. (The Command slot of plans/ui-ux-philosophy.md; a "/"
 * palette can later list the same entries.)
 */

const commands = []

/**
 * @param {object} cmd
 * @param {string} cmd.id
 * @param {string} cmd.label - shown on the shortcut sheet
 * @param {string} cmd.group - sheet section ("Playback", "View", …)
 * @param {string[]} [cmd.keys] - key names: 'Space', 'k', 'ArrowLeft', 'Shift+ArrowLeft', 'Alt+1', '<', '?'
 * @param {string} [cmd.keyLabel] - how the keys read on the sheet (default: derived from keys)
 * @param {boolean} [cmd.sheet] - false: leave off the sheet (the other half of a pair like ← →)
 * @param {(e: KeyboardEvent) => (void|false)} cmd.run - return false to let the key through
 * @param {() => boolean} [cmd.when] - only active while this returns true
 */
export function registerCommand(cmd) {
	commands.push(cmd)
	return cmd
}

export function getCommands() {
	return commands.slice()
}

/** Normalised name of a key event: 'Space', 'k', 'Shift+ArrowLeft', 'Alt+1', '<'. */
export function keyName(e) {
	if (e.altKey && /^Digit\d$/.test(e.code)) return 'Alt+' + e.code.slice(5)  // Alt+digit types symbols on macOS
	let key = e.key === ' ' ? 'Space' : e.key
	if (key.length === 1) key = key.toLowerCase()
	// Shift is part of printable keys ('<', '?'), so it only prefixes named keys
	else if (e.shiftKey) key = 'Shift+' + key
	return (e.altKey ? 'Alt+' : '') + key
}

function isTyping(target) {
	if (!target || target === document.body) return false
	const tag = target.tagName
	return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

let bound = false

/** Start dispatching shortcuts (once). */
export function bindShortcuts(root = document) {
	if (bound) return
	bound = true
	root.addEventListener('keydown', e => {
		if (e.defaultPrevented || e.ctrlKey || e.metaKey || isTyping(e.target)) return
		const name = keyName(e)
		const cmd = commands.find(c => c.keys?.includes(name) && (!c.when || c.when()))
		if (!cmd || cmd.run(e) === false) return
		e.preventDefault()
		e.stopPropagation()
	})
	// Space on a focused button would also click it on keyup
	root.addEventListener('keyup', e => {
		if (e.key === ' ' && e.target?.tagName === 'BUTTON' && !isTyping(e.target)) e.preventDefault()
	})
}

const KEY_LABELS = { Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', PageUp: 'PgUp', PageDown: 'PgDn', Escape: 'Esc' }

function labelForKey(name) {
	return name.split('+').map(part => KEY_LABELS[part] || (part === 'Shift' ? '⇧' : part === 'Alt' ? '⌥' : part.length === 1 ? part.toUpperCase() : part)).join(' ')
}

let sheet = null

function buildSheet() {
	sheet = document.createElement('div')
	sheet.id = 'shortcut_sheet'
	sheet.setAttribute('role', 'dialog')
	sheet.setAttribute('aria-label', 'Keyboard shortcuts')
	sheet.hidden = true
	sheet.addEventListener('click', e => { if (e.target === sheet) closeShortcutSheet() })
	document.body.appendChild(sheet)
}

function renderSheet() {
	const groups = new Map()
	for (const c of commands) {
		if (c.sheet === false || (!c.keys?.length && !c.keyLabel)) continue
		if (!groups.has(c.group)) groups.set(c.group, [])
		groups.get(c.group).push(c)
	}
	const card = document.createElement('div')
	card.className = 'sheet-card'
	const title = document.createElement('h3')
	title.textContent = 'Keyboard shortcuts'
	card.appendChild(title)
	const grid = document.createElement('div')
	grid.className = 'sheet-grid'
	for (const [group, list] of groups) {
		const sec = document.createElement('section')
		const h = document.createElement('h4')
		h.textContent = group
		sec.appendChild(h)
		for (const c of list) {
			const row = document.createElement('div')
			row.className = 'sheet-row'
			const name = document.createElement('span')
			name.textContent = c.label
			const keys = document.createElement('span')
			keys.className = 'sheet-keys'
			const labels = c.keyLabel ? [c.keyLabel] : c.keys.map(labelForKey)
			for (const l of labels) {
				const kbd = document.createElement('kbd')
				kbd.textContent = l
				keys.appendChild(kbd)
			}
			row.append(name, keys)
			sec.appendChild(row)
		}
		grid.appendChild(sec)
	}
	card.appendChild(grid)
	sheet.replaceChildren(card)
}

export function openShortcutSheet() {
	if (!sheet) buildSheet()
	renderSheet()
	sheet.hidden = false
}

export function closeShortcutSheet() {
	if (sheet) sheet.hidden = true
}

export function shortcutSheetOpen() {
	return !!sheet && !sheet.hidden
}
