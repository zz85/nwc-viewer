/**
 * slots.js — the fixed places capabilities plug into (plans/ui-ux-philosophy.md §6).
 *
 * A slot is a named list of items, e.g. 'source' (ways a score comes in),
 * 'view' (ways to look at it), 'export' (output formats). The menu, the view
 * switch and so on are drawn from these lists, so a new capability — a scan
 * importer, a handwriting tool, a video export — registers items here
 * instead of adding buttons to the page.
 *
 * Item: { id, label, hint?, title?, available?() → boolean | string, run(event) }
 *   available() returning a string means "not now", with that string as the reason.
 */

const slots = new Map()
const listeners = new Map()

export function register(slot, item) {
	if (!slots.has(slot)) slots.set(slot, [])
	const list = slots.get(slot)
	const at = list.findIndex(i => i.id === item.id)
	if (at >= 0) list[at] = item
	else list.push(item)
	for (const fn of listeners.get(slot) || []) fn(list.slice())
	return item
}

export function itemsIn(slot) {
	return (slots.get(slot) || []).slice()
}

export function onSlotChange(slot, fn) {
	if (!listeners.has(slot)) listeners.set(slot, [])
	listeners.get(slot).push(fn)
}

/** Whether an item can run now: true, or the reason it can't. */
export function availability(item) {
	if (!item.available) return true
	const a = item.available()
	return a === undefined ? true : a
}

/**
 * Draw a slot as a list of menu buttons into `container` (re-drawn on
 * every change, and by calling the returned refresh()).
 * @param {(item, event) => void} [after] - called after an item runs (close the menu)
 */
export function renderMenu(container, slot, after) {
	const draw = () => {
		container.replaceChildren(...itemsIn(slot).map(item => {
			const b = document.createElement('button')
			b.className = 'menu-item'
			b.dataset.item = item.id
			const label = document.createElement('span')
			label.textContent = item.label
			b.appendChild(label)
			const a = availability(item)
			const note = typeof a === 'string' ? a : item.hint
			if (note) {
				const hint = document.createElement('span')
				hint.className = 'menu-hint'
				hint.textContent = note
				b.appendChild(hint)
				b.classList.add('has-hint')
			}
			b.disabled = a === false || typeof a === 'string'
			if (item.title) b.title = item.title
			b.onclick = async (e) => {
				after?.(item, e)
				try {
					await item.run(e)
				} catch (error) {
					console.error(`${item.label} failed:`, error)
					alert(`${item.label} failed: ${error.message}`)
				}
			}
			return b
		}))
	}
	onSlotChange(slot, draw)
	draw()
	return draw
}
