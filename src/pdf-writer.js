/**
 * Minimal PDF writer for score export: every page is one full-bleed raster
 * image.  Images are 8-bit grayscale, Flate-compressed (lossless) with the
 * built-in CompressionStream, so no PDF library is needed.
 */

/** Compress bytes to zlib format (what PDF's FlateDecode expects). */
async function deflate(bytes) {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
	return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Encode a canvas as a grayscale, Flate-compressed PDF image. */
async function canvasToPdfImage(canvas) {
	const { width, height } = canvas
	const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data
	const gray = new Uint8Array(width * height)
	for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
		// Rec. 601 luma, composited over white for any transparent pixels
		const a = rgba[i + 3] / 255
		const luma = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
		gray[j] = Math.round(luma * a + 255 * (1 - a))
	}
	return { width, height, data: await deflate(gray) }
}

/** PDF text string: UTF-16BE hex with BOM, so any title survives. */
function pdfString(str) {
	let hex = 'FEFF'
	for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(4, '0')
	return `<${hex.toUpperCase()}>`
}

/**
 * Assemble a PDF.
 * @param {Array<{widthPt: number, heightPt: number, image: {width, height, data}}>} pages
 *   Each image (from canvasToPdfImage) is stretched over its whole page.
 * @param {string} [title] - document title for the PDF metadata
 * @returns {Uint8Array}
 */
function buildPdf(pages, title) {
	const chunks = []
	const offsets = [] // byte offset of each object, by object number
	let length = 0
	const encoder = new TextEncoder()
	const write = (part) => {
		const bytes = typeof part === 'string' ? encoder.encode(part) : part
		chunks.push(bytes)
		length += bytes.length
	}
	const object = (num, ...parts) => {
		offsets[num] = length
		write(`${num} 0 obj\n`)
		parts.forEach(write)
		write('\nendobj\n')
	}

	// Objects: 1 catalog, 2 page tree, 3 info, then 3 per page
	// (page, content stream, image)
	const pageNum = (i) => 4 + i * 3
	write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
	object(1, '<< /Type /Catalog /Pages 2 0 R >>')
	object(2, `<< /Type /Pages /Kids [${pages.map((p, i) => `${pageNum(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`)
	object(3, `<< /Producer (Notably) ${title ? `/Title ${pdfString(title)} ` : ''}>>`)

	pages.forEach((page, i) => {
		const n = pageNum(i)
		const w = +page.widthPt.toFixed(2)
		const h = +page.heightPt.toFixed(2)
		const { image } = page
		const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
		object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
			`/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`)
		object(n + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
		object(n + 2, `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
			`/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.data.length} >>\nstream\n`,
			image.data, '\nendstream')
	})

	const xrefOffset = length
	const count = pageNum(pages.length)
	let xref = `xref\n0 ${count}\n0000000000 65535 f \n`
	for (let num = 1; num < count; num++) xref += `${String(offsets[num]).padStart(10, '0')} 00000 n \n`
	write(xref)
	write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

	const out = new Uint8Array(length)
	let pos = 0
	for (const chunk of chunks) {
		out.set(chunk, pos)
		pos += chunk.length
	}
	return out
}

export { buildPdf, canvasToPdfImage, deflate }
