const NODE = typeof module !== 'undefined'
const BROWSER = typeof window !== 'undefined'

// TODO remove HARDCODING
const FONT_SIZE = 36

// Stave space
// 1-1.25 key 1-1.5 timesig 2 note p.42

Object.assign(NODE ? global : window, { NODE, BROWSER, FONT_SIZE })

export { NODE, BROWSER, FONT_SIZE }
