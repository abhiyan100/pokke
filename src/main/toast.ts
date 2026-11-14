import type { BrowserWindow, Display } from 'electron'
import { CHANNEL } from '@shared/api'
import type { Snip, SnipRecord } from '@shared/types'
import type { Library } from './store/library'
import { createToastWindow, present, toastBounds } from './windows'

/** How long the thumbnail stays once the snip has settled (filed, waiting, or failed). */
const SETTLED_MS = 4800
/** Longest it stays while the model is still working. */
const WORKING_MS = 45_000
/** Time the page gets to play its exit before the window is hidden. */
const EXIT_MS = 240

/**
 * The corner thumbnail that appears after a save and follows the snip while
 * the model files it, like the macOS screenshot preview.
 */
export class Toast {
  private win: BrowserWindow | null = null
  private snipId: string | null = null
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly library: Library,
    private readonly toSnip: (record: SnipRecord) => Snip
  ) {
    library.on('changed', () => this.push())
  }

  prepare(): void {
    if (this.win && !this.win.isDestroyed()) return
    this.win = createToastWindow()
    this.win.on('closed', () => {
      this.win = null
    })
  }

  show(id: string, display: Display): void {
    this.prepare()
    if (!this.win) return
    this.snipId = id
    this.win.setBounds(toastBounds(display))
    this.push()
    present(this.win, { focus: false })
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.snipId) return
    this.snipId = null
    const win = this.win
    if (!win || win.isDestroyed()) return
    win.webContents.send(CHANNEL.toastSnip, null)
    setTimeout(() => {
      // A new snip may have arrived while the old one was leaving.
      if (!this.snipId && !win.isDestroyed()) win.hide()
    }, EXIT_MS)
  }

  private push(): void {
    if (!this.snipId || !this.win || this.win.isDestroyed()) return
    const record = this.library.get(this.snipId)
    if (!record) {
      this.dismiss()
      return
    }
    this.win.webContents.send(CHANNEL.toastSnip, this.toSnip(record))
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.dismiss(), record.status === 'analyzing' ? WORKING_MS : SETTLED_MS)
  }
}
