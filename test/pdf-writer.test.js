import { describe, test, expect } from 'bun:test'
import { inflateSync } from 'zlib'
import { buildPdf, deflate } from '../src/pdf-writer.js'

const latin1 = (bytes) => Buffer.from(bytes).toString('latin1')

async function grayImage(width, height, value) {
	return { width, height, data: await deflate(new Uint8Array(width * height).fill(value)) }
}

describe('buildPdf', () => {
	test('writes one page object per image with the page size in points', async () => {
		const pages = [
			{ widthPt: 595.5, heightPt: 842.25, image: await grayImage(4, 6, 255) },
			{ widthPt: 595.5, heightPt: 842.25, image: await grayImage(4, 6, 0) },
		]
		const pdf = latin1(buildPdf(pages, 'Happy Birthday'))
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true)
		expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
		expect(pdf).toContain('/Type /Pages /Kids [4 0 R 7 0 R] /Count 2')
		expect(pdf.match(/\/Type \/Page /g).length).toBe(2)
		expect(pdf).toContain('/MediaBox [0 0 595.5 842.25]')
		expect(pdf).toContain('/Width 4 /Height 6 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode')
	})

	test('xref offsets point at their objects', async () => {
		const pdf = latin1(buildPdf([{ widthPt: 612, heightPt: 792, image: await grayImage(2, 2, 128) }]))
		const startxref = +pdf.match(/startxref\n(\d+)/)[1]
		expect(pdf.slice(startxref, startxref + 4)).toBe('xref')
		const [, count] = pdf.slice(startxref).match(/xref\n0 (\d+)/)
		const entries = pdf.slice(startxref).split('\n').slice(2, 2 + +count)
		entries.slice(1).forEach((entry, i) => {
			const offset = +entry.slice(0, 10)
			expect(pdf.startsWith(`${i + 1} 0 obj\n`, offset)).toBe(true)
		})
		expect(pdf).toContain(`/Size ${count} /Root 1 0 R`)
	})

	test('image stream holds the zlib-compressed pixels', async () => {
		const pdf = buildPdf([{ widthPt: 612, heightPt: 792, image: await grayImage(3, 2, 200) }])
		const text = latin1(pdf)
		const header = text.match(/\/FlateDecode \/Length (\d+) >>\nstream\n/)
		const start = header.index + header[0].length
		const pixels = inflateSync(Buffer.from(pdf.subarray(start, start + +header[1])))
		expect([...pixels]).toEqual([200, 200, 200, 200, 200, 200])
	})

	test('title is stored as a UTF-16 string', () => {
		const pdf = latin1(buildPdf([], 'Héllo'))
		expect(pdf).toContain('/Title <FEFF00480065006C006C006F>'.replace('0065', '00E9'))
	})
})
