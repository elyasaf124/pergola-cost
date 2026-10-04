import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size)
      const i = row + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function pergola(x, y, size) {
  const sand = [244, 239, 228, 255]
  const ink = [31, 77, 58, 255]
  const brass = [196, 165, 116, 255]
  const nx = x / size
  const ny = y / size
  const inRect = (x0, y0, x1, y1) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1
  if (inRect(0.16, 0.22, 0.84, 0.32)) return ink
  if (inRect(0.22, 0.38, 0.78, 0.43)) return ink
  if (inRect(0.22, 0.48, 0.78, 0.53)) return ink
  if (inRect(0.22, 0.58, 0.78, 0.63)) return brass
  if (inRect(0.24, 0.32, 0.3, 0.78)) return ink
  if (inRect(0.7, 0.32, 0.76, 0.78)) return ink
  return sand
}

for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}.png`, png(size, pergola))
}
