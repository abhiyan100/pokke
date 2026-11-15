import { execFile } from 'node:child_process'
import { rmSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { desktopCapturer, nativeImage, screen, type Display, type NativeImage } from 'electron'
import type { Rect } from '@shared/types'
import { extractPalette } from './palette'

const run = promisify(execFile)

export interface Shot {
  display: Display
  /** PNG holding the frozen screen, when the grab wrote one. The overlay shows this file as it is. */
  file: string | null
  /** The frozen screen's pixels, decoded on first use. The snip is cut from these same pixels. */
  image(): NativeImage
  /** Whether `file` is a temporary file to delete once the shot is no longer needed. */
  temporary: boolean
}

const TEMP_SHOT = /^pokke-\d+-\d+\.(png|jpg)$/

/** The display the pointer is on, which is where the user is looking. */
export function activeDisplay(): Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/**
 * Grabs one display at full pixel resolution.
 *
 * macOS: the system `screencapture` tool first (native resolution), then
 * Electron's capturer if that fails. The two are never run back to back on
 * success, which is known to make the second one fail.
 */
export async function shootDisplay(display: Display): Promise<Shot> {
  const fixture = process.env.POKKE_FIXTURE
  if (fixture) return shotFromImage(nativeImage.createFromPath(fixture), display)

  if (process.platform === 'darwin') {
    const shot = await shootWithScreencapture(display)
    if (shot) return shot
  }
  return shotFromImage(await shootWithCapturer(display), display)
}

/** Deletes a shot's temporary file. */
export async function releaseShot(shot: Shot): Promise<void> {
  if (shot.temporary && shot.file) await rm(shot.file, { force: true })
}

/** The same, for use while the app is quitting and cannot wait. */
export function releaseShotNow(shot: Shot): void {
  if (shot.temporary && shot.file) rmSync(shot.file, { force: true })
}

/**
 * Removes screen grabs left in the temp folder by a run that quit or crashed
 * mid-snip. Only files older than a minute are touched, so a grab another
 * running copy of the app is using right now is left alone.
 */
export async function sweepAbandonedShots(olderThanMs = 60_000): Promise<void> {
  const dir = tmpdir()
  const names = await readdir(dir).catch(() => [] as string[])
  await Promise.all(
    names.filter((name) => TEMP_SHOT.test(name)).map(async (name) => {
      const file = join(dir, name)
      const info = await stat(file).catch(() => null)
      if (info && Date.now() - info.mtimeMs > olderThanMs) await rm(file, { force: true })
    })
  )
}

function shotFromImage(image: NativeImage, display: Display): Shot {
  return { display, file: null, image: () => image, temporary: false }
}

async function shootWithScreencapture(display: Display): Promise<Shot | null> {
  // screencapture numbers displays from 1 with the main display first.
  const displays = screen.getAllDisplays()
  const primaryId = screen.getPrimaryDisplay().id
  const ordered = [...displays].sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId))
  const number = String(ordered.findIndex((candidate) => candidate.id === display.id) + 1)
  const file = join(tmpdir(), `pokke-${process.pid}-${Date.now()}.png`)

  // Decoding a full screen takes a moment, so it waits until the snip is cut,
  // after the overlay (which shows the file directly) is already up.
  let decoded: NativeImage | null = null
  const shot: Shot = { display, file, image: () => (decoded ??= nativeImage.createFromPath(file)), temporary: true }

  try {
    await run('/usr/sbin/screencapture', ['-x', '-t', 'png', '-D', number, file])
    // With one display the numbering cannot be wrong; with several, check the size.
    if (displays.length === 1 || matchesDisplay(shot.image(), display)) return shot
  } catch {
    // Fall through to the capturer.
  }
  await releaseShot(shot)
  return null
}

/** Guards against screencapture numbering a display differently than expected. */
function matchesDisplay(image: NativeImage, display: Display): boolean {
  const { width, height } = image.getSize()
  const expectedWidth = display.size.width * display.scaleFactor
  const expectedHeight = display.size.height * display.scaleFactor
  return !image.isEmpty() && Math.abs(width - expectedWidth) <= 2 && Math.abs(height - expectedHeight) <= 2
}

async function shootWithCapturer(display: Display): Promise<NativeImage> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor)
    }
  })
  const source = sources.find((candidate) => candidate.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new Error('The screen could not be captured.')
  return source.thumbnail
}

/**
 * Cuts the selected region out of a display's image. `rect` is in the
 * overlay's CSS pixels; the image is usually denser, so it is scaled to
 * image pixels.
 */
export function cropImage(image: NativeImage, display: Display, rect: Rect): NativeImage {
  const size = image.getSize()
  const scaleX = size.width / display.size.width
  const scaleY = size.height / display.size.height
  const x = clamp(Math.round(rect.x * scaleX), 0, size.width - 1)
  const y = clamp(Math.round(rect.y * scaleY), 0, size.height - 1)
  return image.crop({
    x,
    y,
    width: clamp(Math.round(rect.width * scaleX), 1, size.width - x),
    height: clamp(Math.round(rect.height * scaleY), 1, size.height - y)
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const THUMB_WIDTH = 720
const MODEL_LONG_EDGE = 1568
const PALETTE_WIDTH = 64

export function thumbnailOf(image: NativeImage): Buffer {
  const { width } = image.getSize()
  const sized = width > THUMB_WIDTH ? image.resize({ width: THUMB_WIDTH, quality: 'best' }) : image
  return sized.toJPEG(86)
}

/** The image as sent to a model: PNG, scaled down so it stays cheap to read. */
export function imageForModel(image: NativeImage): { base64: string; mediaType: 'image/png' } {
  const { width, height } = image.getSize()
  const longEdge = Math.max(width, height)
  const sized =
    longEdge > MODEL_LONG_EDGE
      ? image.resize(
          width >= height ? { width: MODEL_LONG_EDGE, quality: 'best' } : { height: MODEL_LONG_EDGE, quality: 'best' }
        )
      : image
  return { base64: sized.toPNG().toString('base64'), mediaType: 'image/png' }
}

export function paletteOf(image: NativeImage): string[] {
  const { width } = image.getSize()
  const small = width > PALETTE_WIDTH ? image.resize({ width: PALETTE_WIDTH, quality: 'good' }) : image
  return extractPalette(small.toBitmap(), 'bgra')
}
