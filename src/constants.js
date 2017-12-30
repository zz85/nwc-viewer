const NODE = typeof module !== 'undefined'
const BROWSER = typeof window !== 'undefined'

// TODO remove HARDCODING
const FONT_SIZE = 36

Object.assign(NODE ? global : window, { NODE, BROWSER, FONT_SIZE })

export { NODE, BROWSER, FONT_SIZE }
