fontMap = {
	treble: 'e050'
}

getCode = (name) => String.fromCharCode
(
	parseInt(fontMap[name], 16)
)


class Draw {
	draw() {
		console.log('implement me .draw()')
	}

	outline() {
	}

	debug(ctx) {
		ctx.fillRect(0, 0, 10, 10)

		console.log(this.width)
		ctx.strokeRect(0, 0, this.width || 40, 40)
		// TODO add y bounds
	}

	moveTo(x, y) {
		this.x = x;
		this.y = y;
	}

	positionY(semitones) {
		this.offsetY = -semitones / 2 / 4 * 40
		console.log('this.offsetY', this.offsetY)
	}
}

class Stave extends Draw {
	constructor() {
		super()
		this.size = 40  // TODO global
		this.x = 0
		this.y = 0
		this.width = 100
	}

	draw(ctx) {
		const {x, y, width, size} = this

		ctx.strokeStyle = '#000'
		ctx.lineWidth = 1.4

		// 5 lines
		const spaces = 4; // TODO global
		for (let i = 0; i <= spaces; i++) {
			const ty = -i / spaces * size
			ctx.beginPath()
			ctx.moveTo(0, ty)
			ctx.lineTo(width, ty);
			ctx.stroke()
		}

		// this.debug(ctx);
	}
}

class Treble extends Draw {
	constructor() {
		super()

		this.char = getCode('treble')
		// TODO remove ctx hardcoding
		this.width = ctx.measureText(this.char).width
	}

	draw(ctx) {
		ctx.fillStyle = '#000'
		ctx.fillText(this.char, 0, 0)

		this.debug(ctx);
	}
}

class Drawing {
	constructor() {
		this.set = new Set()
	}

	add(el) {
		this.set.add(el)
	}

	remove(el) {
		this.set.delete(el)
	}

	draw(ctx) {
		for (const el of this.set) {
			if (el instanceof Draw) {
				ctx.save()
				ctx.translate(el.x, el.y)
				console.log('el.offsetY', el.offsetX || 0, el.offsetY || 0);
				ctx.translate(el.offsetX || 0, el.offsetY || 0)
				el.draw(ctx)
				ctx.restore()
			}
			else {
				console.log('Element', el, 'not a draw element')
			}
		}
	}
}

