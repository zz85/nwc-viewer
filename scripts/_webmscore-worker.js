#!/usr/bin/env bun
// Helper: load a single .mscz via webmscore and output JSON to stdout
import WebMscore from 'webmscore'
import { readFileSync } from 'fs'

await WebMscore.ready
const file = process.argv[2]
const data = readFileSync(file)
const score = await WebMscore.load('mscz', new Uint8Array(data))
const xml = await score.saveXml()
const meta = await score.metadata()
score.destroy()
const xmlStr = typeof xml === 'string' ? xml : new TextDecoder().decode(xml)
process.stdout.write(JSON.stringify({ xml: xmlStr, meta }))
