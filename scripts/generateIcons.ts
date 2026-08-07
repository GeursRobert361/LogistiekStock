/**
 * Genereert de PWA-iconen (public/icon-192.png en icon-512.png).
 *
 * Bewust zonder externe beeldbibliotheek: het icoon is puur geometrisch, dus
 * een handgeschreven PNG-encoder is hier eenvoudiger dan een extra dependency.
 * Draaien met: npx tsx scripts/generateIcons.ts
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARENA_RED: RGB = [232, 0, 13]
const WHITE: RGB = [255, 255, 255]

type RGB = [number, number, number]

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(size: number, pixel: (x: number, y: number) => RGB): Buffer {
  // Elke scanline begint met een filterbyte (0 = geen filter).
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bitdiepte
  ihdr[9] = 2 // kleurtype: truecolor
  ihdr[10] = 0 // compressie
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Rode achtergrond met een wit kratsymbool in het midden. */
function iconPixel(size: number) {
  const unit = size / 100
  const inBand = (value: number, from: number, to: number) => value >= from * unit && value <= to * unit

  return (x: number, y: number): RGB => {
    // Krat: buitenrand 26–74, lijndikte 6 eenheden, plus een deksellijn op 42.
    const insideBox = inBand(x, 26, 74) && inBand(y, 26, 74)
    if (!insideBox) return ARENA_RED

    const onVerticalEdge = inBand(x, 26, 32) || inBand(x, 68, 74)
    const onHorizontalEdge = inBand(y, 26, 32) || inBand(y, 68, 74)
    const onLidLine = inBand(y, 40, 45)
    const onHandle = inBand(x, 44, 56) && inBand(y, 52, 58)

    return onVerticalEdge || onHorizontalEdge || onLidLine || onHandle ? WHITE : ARENA_RED
  }
}

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(publicDir, { recursive: true })

for (const size of [192, 512]) {
  writeFileSync(join(publicDir, `icon-${size}.png`), encodePng(size, iconPixel(size)))
  console.log(`public/icon-${size}.png geschreven`)
}

// Apple gebruikt een los icoon zonder maskable-marge.
writeFileSync(join(publicDir, 'apple-touch-icon.png'), encodePng(180, iconPixel(180)))
console.log('public/apple-touch-icon.png geschreven')
