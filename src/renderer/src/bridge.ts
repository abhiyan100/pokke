import type { XtractorApi } from '@shared/api'
import type { DoubleTapKey } from '@shared/types'

declare global {
  interface Window {
    /** Present inside the app; absent in a plain browser. */
    xtractor?: XtractorApi
  }
}

/**
 * The app bridge. Inside Electron it is the preload API; anywhere else the
 * mock is loaded on demand, so its sample data never ships in the app's path.
 */
export const api: XtractorApi = window.xtractor ?? (await import('./mock/api')).createMockApi()

export const isMac = api.platform === 'darwin'

/** The modifier glyphs for this platform, for showing shortcuts. */
export const KEY = {
  mod: isMac ? '⌘' : 'Ctrl',
  shift: isMac ? '⇧' : 'Shift'
}

/** How the double-tap key is written on this platform's keyboard. */
export function doubleTapLabel(key: DoubleTapKey): string {
  const names = isMac ? { meta: 'Right ⌘', alt: 'Right ⌥', ctrl: 'Right ⌃' } : { meta: 'Right Win', alt: 'Right Alt', ctrl: 'Right Ctrl' }
  return names[key]
}

/** Turns an Electron accelerator such as "CommandOrControl+Shift+2" into keycap labels. */
export function shortcutKeys(accelerator: string): string[] {
  return accelerator
    .split('+')
    .filter(Boolean)
    .map((part) => {
      if (/^(CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl)$/i.test(part)) return KEY.mod
      if (/^Shift$/i.test(part)) return KEY.shift
      if (/^(Alt|Option)$/i.test(part)) return isMac ? '⌥' : 'Alt'
      return part.length === 1 ? part.toUpperCase() : part
    })
}
