/**
 * Minimal ZIP file parser.
 *
 * Extracts file entries from a ZIP archive stored as an ArrayBuffer.
 * Uses the browser's DecompressionStream API for deflate decompression.
 * Supports stored (uncompressed) and deflated entries.
 *
 * Only what we need for .mscz files — no ZIP64, no encryption, no
 * multi-disk archives.
 */

/**
 * Decompress raw-deflated data using the browser's DecompressionStream.
 * @param {Uint8Array} compressed
 * @returns {Promise<Uint8Array>}
 */
async function inflateRaw(compressed) {
	const ds = new DecompressionStream('deflate-raw')
	const writer = ds.writable.getWriter()
	const reader = ds.readable.getReader()

	writer.write(compressed)
	writer.close()

	const chunks = []
	let totalLen = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(value)
		totalLen += value.length
	}

	const result = new Uint8Array(totalLen)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.length
	}
	return result
}

/**
 * Parse a ZIP ArrayBuffer and return a Map of filename → Uint8Array.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function unzip(buffer) {
	const bytes = new Uint8Array(buffer)
	const view = new DataView(buffer)
	const files = new Map()

	// Find End of Central Directory record (EOCD).
	// Signature: 0x06054b50.  Search backwards from end of file.
	let eocdOffset = -1
	for (let i = bytes.length - 22; i >= 0; i--) {
		if (view.getUint32(i, true) === 0x06054b50) {
			eocdOffset = i
			break
		}
	}
	if (eocdOffset === -1) {
		throw new Error('ZIP: End of Central Directory not found')
	}

	const cdOffset = view.getUint32(eocdOffset + 16, true)
	const cdEntries = view.getUint16(eocdOffset + 10, true)

	// Collect all entries, then decompress in parallel
	const entries = []
	let pos = cdOffset
	for (let i = 0; i < cdEntries; i++) {
		if (view.getUint32(pos, true) !== 0x02014b50) {
			throw new Error('ZIP: Invalid central directory entry at offset ' + pos)
		}

		const compressionMethod = view.getUint16(pos + 10, true)
		const compressedSize = view.getUint32(pos + 20, true)
		const nameLen = view.getUint16(pos + 28, true)
		const extraLen = view.getUint16(pos + 30, true)
		const commentLen = view.getUint16(pos + 32, true)
		const localHeaderOffset = view.getUint32(pos + 42, true)

		const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLen)
		const filename = new TextDecoder().decode(nameBytes)

		if (!filename.endsWith('/')) {
			const lhNameLen = view.getUint16(localHeaderOffset + 26, true)
			const lhExtraLen = view.getUint16(localHeaderOffset + 28, true)
			const dataOffset = localHeaderOffset + 30 + lhNameLen + lhExtraLen
			const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize)

			entries.push({ filename, compressionMethod, compressedData })
		}

		pos += 46 + nameLen + extraLen + commentLen
	}

	// Decompress all entries in parallel
	const results = await Promise.all(entries.map(async (entry) => {
		let data
		if (entry.compressionMethod === 0) {
			data = entry.compressedData
		} else if (entry.compressionMethod === 8) {
			data = await inflateRaw(entry.compressedData)
		} else {
			console.warn(`ZIP: Unsupported compression method ${entry.compressionMethod} for ${entry.filename}`)
			return null
		}
		return { filename: entry.filename, data }
	}))

	for (const result of results) {
		if (result) files.set(result.filename, result.data)
	}

	return files
}
