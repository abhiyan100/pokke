const BUCKET_BITS = 4
const SHIFT = 8 - BUCKET_BITS
const MIN_DISTANCE = 56

interface Bucket {
  count: number
  r: number
  g: number
  b: number
}

/**
 * Finds the dominant colours of an image from its raw pixels (4 bytes each).
 * Pixels are grouped into coarse colour buckets; the most common buckets win,
 * skipping any that sit too close to a colour already chosen.
 *
 * @param order byte order of each pixel. Electron bitmaps are BGRA.
 */
export function extractPalette(pixels: Uint8Array, order: 'rgba' | 'bgra', count = 5): string[] {
  const [rOffset, bOffset] = order === 'rgba' ? [0, 2] : [2, 0]
  const buckets = new Map<number, Bucket>()

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue
    const r = pixels[i + rOffset]!
    const g = pixels[i + 1]!
    const b = pixels[i + bOffset]!
    const key = ((r >> SHIFT) << (BUCKET_BITS * 2)) | ((g >> SHIFT) << BUCKET_BITS) | (b >> SHIFT)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.r += r
      bucket.g += g
      bucket.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  const chosen: [number, number, number][] = []
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count)
  for (const bucket of ranked) {
    const colour: [number, number, number] = [
      Math.round(bucket.r / bucket.count),
      Math.round(bucket.g / bucket.count),
      Math.round(bucket.b / bucket.count)
    ]
    if (chosen.every((other) => distance(colour, other) >= MIN_DISTANCE)) chosen.push(colour)
    if (chosen.length === count) break
  }
  return chosen.map(toHex)
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function toHex(colour: [number, number, number]): string {
  return `#${colour.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
