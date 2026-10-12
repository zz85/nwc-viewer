import { describe, test, expect } from 'bun:test'

const { register, itemsIn, onSlotChange, availability } = await import('../src/slots.js')

describe('slots', () => {
	test('items keep their registration order; re-registering an id replaces it in place', () => {
		register('t-order', { id: 'a', label: 'A', run() {} })
		register('t-order', { id: 'b', label: 'B', run() {} })
		register('t-order', { id: 'a', label: 'A2', run() {} })
		expect(itemsIn('t-order').map(i => i.label)).toEqual(['A2', 'B'])
		expect(itemsIn('t-empty')).toEqual([])
	})

	test('listeners hear every change with the new list', () => {
		const seen = []
		onSlotChange('t-listen', list => seen.push(list.map(i => i.id).join()))
		register('t-listen', { id: 'x', run() {} })
		register('t-listen', { id: 'y', run() {} })
		expect(seen).toEqual(['x', 'x,y'])
	})

	test('availability: true, false, or the reason it is not available now', () => {
		expect(availability({ id: 'always' })).toBe(true)
		expect(availability({ id: 'never', available: () => false })).toBe(false)
		expect(availability({ id: 'later', available: () => 'NoteWorthy files only' })).toBe('NoteWorthy files only')
		expect(availability({ id: 'undef', available: () => undefined })).toBe(true)
	})
})
