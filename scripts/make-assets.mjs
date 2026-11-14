// Builds the shipped image assets from the source art in assets/generated.
// Run with `node scripts/make-assets.mjs`. The outputs are committed, so this
// only needs re-running when the source art changes.
//
// It drives a headless browser purely as an image toolkit (canvas), which
// avoids adding a native image library to the project.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const at = (...parts) => resolve(root, ...parts)

async function dataUrl(file, type = 'image/png') {
  return `data:${type};base64,${(await readFile(file)).toString('base64')}`
}

async function save(file, url) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
  console.log('wrote', file.replace(`${root}/`, ''))
}

const browser = await chromium.launch()
const page = await browser.newPage()
await page.evaluate(() => {
  window.loadImage = (src) =>
    new Promise((done, fail) => {
      const image = new Image()
      image.onload = () => done(image)
      image.onerror = () => fail(new Error('image failed to load'))
      image.src = src
    })
  window.canvasOf = (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
})

// --- Weave: a neutral-grey, seamless tile of the cloth's fine texture -------
// Large light/dark patches are removed (they would repeat visibly), leaving
// only the thread-level weave, centred on mid-grey so it can be blended over
// any indigo. Mirroring the tile 2x2 makes its edges match by construction.
const weave = await page.evaluate(async (src) => {
  const source = await window.loadImage(src)
  const size = 256
  const gain = 3.6
  const offset = (source.width - size) / 2

  const sharp = window.canvasOf(size, size).getContext('2d')
  sharp.drawImage(source, offset, offset, size, size, 0, 0, size, size)
  const blurred = window.canvasOf(size, size).getContext('2d')
  blurred.filter = 'blur(8px)'
  blurred.drawImage(source, offset, offset, size, size, 0, 0, size, size)

  const detail = sharp.getImageData(0, 0, size, size)
  const base = blurred.getImageData(0, 0, size, size).data
  const pixels = detail.data
  const luma = (data, i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  for (let i = 0; i < pixels.length; i += 4) {
    const value = Math.max(0, Math.min(255, 128 + (luma(pixels, i) - luma(base, i)) * gain))
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value
  }
  sharp.putImageData(detail, 0, 0)

  const out = window.canvasOf(size * 2, size * 2)
  const context = out.getContext('2d')
  for (const [flipX, flipY] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    context.save()
    context.translate(size, size)
    context.scale(flipX, flipY)
    context.drawImage(sharp.canvas, -size, -size)
    context.restore()
  }
  return out.toDataURL('image/jpeg', 0.8)
}, await dataUrl(at('assets/generated/cloth-tile.png')))
await save(at('src/renderer/src/assets/weave.jpg'), weave)

// --- App icon: the stitched patch, cut out with transparent corners ---------
const icons = await page.evaluate(async (src) => {
  const source = await window.loadImage(src)
  const render = (size, padding) => {
    const canvas = window.canvasOf(size, size)
    const context = canvas.getContext('2d')
    const body = size - padding * 2
    context.beginPath()
    context.roundRect(padding, padding, body, body, body * 0.225)
    context.clip()
    // The patch fills the source apart from a ~4% dark margin.
    const margin = source.width * 0.04
    context.drawImage(source, margin, margin, source.width - margin * 2, source.height - margin * 2, padding, padding, body, body)
    return canvas.toDataURL('image/png')
  }
  return { app: render(512, 50), small: render(64, 2) }
}, await dataUrl(at('assets/generated/icon.png')))
await save(at('resources/icon.png'), icons.app)
await save(at('resources/tray.png'), icons.small)
await save(at('site/public/favicon.png'), icons.small)

// --- Menu-bar glyph: four corner brackets, black on transparent -------------
const tray = await page.evaluate(() => {
  const render = (scale) => {
    const canvas = window.canvasOf(18 * scale, 18 * scale)
    const context = canvas.getContext('2d')
    context.scale(scale, scale)
    context.lineWidth = 1.7
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#000'
    context.stroke(new Path2D('M3 7V3H7M11 3H15V7M15 11V15H11M7 15H3V11'))
    context.fillStyle = '#000'
    context.beginPath()
    context.arc(9, 9, 1.4, 0, Math.PI * 2)
    context.fill()
    return canvas.toDataURL('image/png')
  }
  return { one: render(1), two: render(2) }
})
await save(at('resources/trayTemplate.png'), tray.one)
await save(at('resources/trayTemplate@2x.png'), tray.two)

// --- Photographs: re-encoded as JPEG at the size they are shown -------------
async function photo(from, to, width, quality) {
  const url = await page.evaluate(
    async ({ src, width, quality }) => {
      const source = await window.loadImage(src)
      const scale = Math.min(1, width / source.width)
      const canvas = window.canvasOf(Math.round(source.width * scale), Math.round(source.height * scale))
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', quality)
    },
    { src: await dataUrl(from), width, quality }
  )
  await save(to, url)
}
await photo(at('assets/generated/hero-roll.png'), at('site/src/assets/hero-roll.jpg'), 1586, 0.86)
await photo(at('assets/generated/empty-pocket.png'), at('src/renderer/src/assets/empty-pocket.jpg'), 1100, 0.84)

// --- Test fixture: the sample desktop rendered to a PNG "screen" ------------
const screenSvg = at('src/renderer/public/samples/screen.svg')
if (existsSync(screenSvg)) {
  const shot = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await shot.goto(`file://${screenSvg}`)
  await mkdir(at('tests/fixtures'), { recursive: true })
  await shot.screenshot({ path: at('tests/fixtures/screen.png') })
  console.log('wrote tests/fixtures/screen.png')
}

await browser.close()
