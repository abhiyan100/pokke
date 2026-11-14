import { globalShortcut, systemPreferences } from 'electron'
import type { DoubleTapKey } from '@shared/types'
import { createDoubleTapDetector, type KeyEvent } from './doubleTap'

const isMac = process.platform === 'darwin'
const ACCESSIBILITY_POLL_MS = 2500

interface Hook {
  uIOhook: {
    on(event: 'keydown' | 'keyup', listener: (event: { keycode: number }) => void): void
    start(): void
  }
  UiohookKey: { MetaRight: number; CtrlRight: number; AltRight: number }
}

/**
 * The two ways to start a snip: a double-tap of Right ⌘ (Right Ctrl on
 * Windows and Linux) seen through a native key hook, and an ordinary shortcut
 * that needs no special permission.
 */
export class Hotkeys {
  private hookState: 'idle' | 'running' | 'unavailable' = 'idle'
  private doubleTapEnabled = true
  private doubleTapKey: DoubleTapKey = isMac ? 'meta' : 'ctrl'
  private keycodes: Record<DoubleTapKey, number> | null = null
  private detect: (event: KeyEvent) => void = () => undefined
  private shortcut = ''
  private poll: NodeJS.Timeout | null = null

  constructor(private readonly onTrigger: () => void) {}

  /** False when the native hook could not be loaded on this machine. */
  get doubleTapAvailable(): boolean {
    return this.hookState !== 'unavailable'
  }

  /** True once the hook is running, which on macOS needs Accessibility access. */
  get doubleTapActive(): boolean {
    return this.hookState === 'running'
  }

  /** True while the regular shortcut is registered with the system. */
  get shortcutActive(): boolean {
    return this.shortcut !== ''
  }

  /**
   * Registers the regular shortcut. Returns false if it is invalid or another
   * app holds it, in which case the previous shortcut is left in place.
   */
  setShortcut(accelerator: string): boolean {
    if (accelerator === this.shortcut) return true
    if (accelerator) {
      try {
        if (!globalShortcut.register(accelerator, this.onTrigger)) return false
      } catch {
        return false
      }
    }
    if (this.shortcut) globalShortcut.unregister(this.shortcut)
    this.shortcut = accelerator
    return true
  }

  /**
   * Turns the double-tap on or off. The hook is started once and then left
   * running (restarting it can deadlock on macOS); turning it off only makes
   * the app ignore the taps.
   */
  setDoubleTap(enabled: boolean, key: DoubleTapKey = this.doubleTapKey): void {
    this.doubleTapEnabled = enabled
    this.doubleTapKey = key
    this.watchKey()
    if (enabled && this.hookState === 'idle') void this.startHook()
  }

  /** Points the detector at the chosen key. The hook itself keeps running. */
  private watchKey(): void {
    if (!this.keycodes) return
    this.detect = createDoubleTapDetector(this.keycodes[this.doubleTapKey], () => {
      if (this.doubleTapEnabled) this.onTrigger()
    })
  }

  dispose(): void {
    if (this.poll) clearInterval(this.poll)
    globalShortcut.unregisterAll()
  }

  private async startHook(): Promise<void> {
    if (isMac && !systemPreferences.isTrustedAccessibilityClient(false)) {
      // Wait quietly until the user grants access in System Settings.
      this.poll ??= setInterval(() => {
        if (this.hookState === 'idle' && systemPreferences.isTrustedAccessibilityClient(false)) {
          void this.startHook()
        }
      }, ACCESSIBILITY_POLL_MS)
      return
    }
    if (this.poll) {
      clearInterval(this.poll)
      this.poll = null
    }

    try {
      const module = (await import('uiohook-napi')) as unknown as Hook & { default?: Hook }
      const { uIOhook, UiohookKey } = module.default ?? module
      this.keycodes = { meta: UiohookKey.MetaRight, alt: UiohookKey.AltRight, ctrl: UiohookKey.CtrlRight }
      this.watchKey()
      uIOhook.on('keydown', (event) => this.detect({ type: 'down', keycode: event.keycode, time: Date.now() }))
      uIOhook.on('keyup', (event) => this.detect({ type: 'up', keycode: event.keycode, time: Date.now() }))
      uIOhook.start()
      this.hookState = 'running'
    } catch {
      // The optional native module is missing or refused to start; the regular shortcut still works.
      this.hookState = 'unavailable'
    }
  }
}
