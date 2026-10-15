/**
 * hover-open.js — menus and popovers that open when the mouse rests on their
 * button, so looking costs no click.
 *
 * A menu the mouse opened closes again once the mouse has left both the
 * button and the menu (after a short grace period, so the way from one to
 * the other doesn't close it). Clicking the button, or anything inside the
 * menu, keeps it open until a click elsewhere or Escape, as clicking always
 * did. Touch and pen have no hover: they open and close by tap only, so
 * nothing works by hover alone.
 */

const OPEN_DELAY = 180   // ms the mouse rests on the button before the menu opens
const CLOSE_DELAY = 350  // ms after the mouse leaves before the menu closes

/**
 * @param {HTMLElement} button
 * @param {HTMLElement} panel
 * @param {{ open: () => void, close: () => void, isOpen: () => boolean }} menu
 * @returns {() => void} what a click on the button does: pin a menu the
 *   mouse opened, else open or close it
 */
export function openOnHover(button, panel, { open, close, isOpen }) {
	let byHover = false
	let timer = 0
	const later = (fn, ms) => {
		clearTimeout(timer)
		timer = setTimeout(fn, ms)
	}
	const mouse = (e) => e.pointerType === 'mouse'

	button.addEventListener('pointerenter', (e) => {
		if (!mouse(e)) return
		if (isOpen()) return clearTimeout(timer)
		later(() => {
			open()
			byHover = true
		}, OPEN_DELAY)
	})
	panel.addEventListener('pointerenter', (e) => {
		if (mouse(e) && isOpen()) clearTimeout(timer)
	})
	const leave = (e) => {
		if (!mouse(e)) return
		if (!byHover || !isOpen()) return clearTimeout(timer)
		later(() => {
			if (byHover && isOpen()) close()
			byHover = false
		}, CLOSE_DELAY)
	}
	button.addEventListener('pointerleave', leave)
	panel.addEventListener('pointerleave', leave)
	// Using the menu (a click, a select's list) keeps it open
	panel.addEventListener('pointerdown', () => {
		byHover = false
		clearTimeout(timer)
	})

	return () => {
		clearTimeout(timer)
		const pin = byHover && isOpen()
		byHover = false
		if (pin) return
		if (isOpen()) close()
		else open()
	}
}
