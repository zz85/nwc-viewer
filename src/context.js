/**
 * MusicContext - Encapsulates music data and rendering context
 * Eliminates global window.data and window.ctx dependencies
 */
class MusicContext {
	constructor(data, canvas) {
		this.data = data
		this.canvas = canvas
		this.ctx = canvas ? canvas.getContext('2d') : null
	}

	getData() {
		return this.data
	}

	setData(data) {
		this.data = data
	}

	getCanvas() {
		return this.canvas
	}

	getContext() {
		return this.ctx
	}

	getScore() {
		return this.data?.score
	}

	getStaves() {
		return this.data?.score?.staves || []
	}
}

export { MusicContext }
