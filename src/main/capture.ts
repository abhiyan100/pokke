import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { net, systemPreferences, type BrowserWindow, type Display } from 'electron'
import { CHANNEL } from '@shared/api'
import type { CaptureFrame, Rect, SnipRecord } from '@shared/types'
import type { Analyst } from './ai/analyst'
import { isMac } from './env'
import { activeDisplay, cropImage, paletteOf, releaseShot, releaseShotNow, shootDisplay, thumbnailOf, type Shot } from './screen'
import type { Library } from './store/library'
import { createOverlayWindow, present, toastBounds } from './windows'

/** How long to wait for the overlay page to report it has painted before showing it anyway. */
const REVEAL_GRACE_MS = 900
/** How long the save animation may run before the overlay is hidden regardless. */
const FINISH_GRACE_MS = 1600

interface CaptureHooks {
  /** A snip was saved and the overlay is gone. */
  onSaved(id: string, display: Display): void
  /** The screen could not be read, usually because permission is missing. */
  onBlocked(): void
  /** The overlay has closed, whether the snip was saved or cancelled. */
  onClosed(): void
}

/** True when the app may read the screen. Only macOS gates this; a fixture image needs no access. */
export function screenAccessGranted(): boolean {
  if (!isMac || process.env.XTRACTOR_FIXTURE) return true
  return systemPreferences.getMediaAccessStatus('screen') === 'granted'
}

/**
 * One snip from hotkey to saved file: freeze the display, show the overlay,
 * take the selection, write it to the library and hand it to the analyst.
 */
export class CaptureSession {
  private overlay: BrowserWindow | null = null
  private overlayLoaded: Promise<void> = Promise.resolve()
  private shot: Shot | null = null
  private frameJpeg: Buffer | null = null
  private state: 'idle' | 'selecting' | 'saving' | 'saved' = 'idle'
  private frameCount = 0
  private timer: NodeJS.Timeout | null = null
  private savedId: string | null = null

  constructor(
    private readonly library: Library,
    private readonly analyst: Analyst,
    private readonly hooks: CaptureHooks
  ) {}

  /** Creates the overlay window ahead of time so the first snip is instant. */
  prepare(): void {
    if (this.overlay && !this.overlay.isDestroyed()) return
    const overlay = createOverlayWindow()
    this.overlay = overlay
    this.overlayLoaded = new Promise((resolve) => overlay.webContents.once('did-finish-load', () => resolve()))
    overlay.on('closed', () => {
      this.overlay = null
      // If the window goes away mid-snip, end the session so the next hotkey starts a fresh one.
      void this.reset()
    })
  }

  async begin(): Promise<void> {
    if (this.state !== 'idle') return
    this.state = 'selecting'

    try {
      const display = activeDisplay()
      const shot = await shootDisplay(display)
      // On first use this attempt is what makes macOS list the app under Screen Recording.
      if (!screenAccessGranted()) {
        await releaseShot(shot)
        this.state = 'idle'
        this.hooks.onBlocked()
        return
      }

      this.shot = shot
      this.frameJpeg = null
      this.prepare()
      await this.overlayLoaded
      const overlay = this.overlay
      if (!overlay) throw new Error('The capture overlay closed unexpectedly.')

      overlay.setBounds(display.bounds)
      // On Windows a window moved to a display with a different scale can keep
      // the old display's size; setting the bounds again once it is there fixes that.
      if (process.platform === 'win32') overlay.setBounds(display.bounds)
      const toast = toastBounds(display)
      const frame: CaptureFrame = {
        imageUrl: `xtractor://frame/${++this.frameCount}`,
        width: display.bounds.width,
        height: display.bounds.height,
        toast: {
          x: toast.x - display.bounds.x,
          y: toast.y - display.bounds.y,
          width: toast.width,
          height: toast.height
        }
      }
      overlay.webContents.send(CHANNEL.captureFrame, frame)
      this.setTimer(() => this.reveal(), REVEAL_GRACE_MS)
    } catch {
      await this.reset()
      this.hooks.onBlocked()
    }
  }

  /** The overlay page has painted the frozen frame. */
  reveal(): void {
    this.clearTimer()
    if (this.state === 'selecting' && this.overlay) present(this.overlay)
  }

  /** The frozen frame for the overlay page, as an HTTP-style response. */
  async frameResponse(): Promise<Response> {
    if (!this.shot) return new Response(null, { status: 404 })
    if (this.shot.file) return net.fetch(pathToFileURL(this.shot.file).toString())
    this.frameJpeg ??= this.shot.image().toJPEG(92)
    return new Response(new Uint8Array(this.frameJpeg), { headers: { 'content-type': 'image/jpeg' } })
  }

  async save(rect: Rect, note: string): Promise<SnipRecord> {
    if (this.state !== 'selecting' || !this.shot) throw new Error('There is no capture in progress.')
    const shot = this.shot
    // A second Enter while this one is being written must not save twice.
    this.state = 'saving'
    try {
      return await this.write(shot, rect, note)
    } catch (error) {
      if (this.shot === shot) this.state = 'selecting'
      throw error
    }
  }

  private async write(shot: Shot, rect: Rect, note: string): Promise<SnipRecord> {
    const image = cropImage(shot.image(), shot.display, rect)
    const size = image.getSize()
    const record: SnipRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      note: note.trim(),
      width: size.width,
      height: size.height,
      palette: paletteOf(image),
      status: 'waiting',
      pocket: 'loose',
      title: '',
      tags: [],
      summary: '',
      extractedText: '',
      prompt: ''
    }
    await this.library.add(record, image.toPNG(), thumbnailOf(image))
    this.state = 'saved'
    this.savedId = record.id
    this.analyst.enqueue(record.id)
    this.setTimer(() => void this.finish(), FINISH_GRACE_MS)
    return record
  }

  /** Hides the overlay after a save and announces the new snip. */
  async finish(): Promise<void> {
    if (this.state !== 'saved') return
    const id = this.savedId
    const display = this.shot?.display
    await this.reset()
    if (id && display) this.hooks.onSaved(id, display)
  }

  async cancel(): Promise<void> {
    if (this.state === 'selecting') await this.reset()
  }

  /** Called as the app quits: the frozen screen must not be left in the temp folder. */
  dispose(): void {
    this.clearTimer()
    if (this.shot) releaseShotNow(this.shot)
    this.shot = null
    this.state = 'idle'
  }

  private async reset(): Promise<void> {
    this.clearTimer()
    this.overlay?.hide()
    const shot = this.shot
    this.shot = null
    this.frameJpeg = null
    this.savedId = null
    this.state = 'idle'
    if (shot) await releaseShot(shot)
    this.hooks.onClosed()
  }

  private setTimer(run: () => void, ms: number): void {
    this.clearTimer()
    this.timer = setTimeout(run, ms)
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
