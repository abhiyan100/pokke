import { join } from 'node:path'
import { app } from 'electron'

export const isMac = process.platform === 'darwin'

/**
 * Test mode keeps the app invisible and inert towards the system: no window
 * is ever shown, no tray icon, no global hotkeys, no permission prompts, no
 * keychain access. It exists so the app can be driven by automated tests
 * without touching the user's screen.
 */
export const isTest = process.env.XTRACTOR_TEST === '1'

/**
 * Lets a test start the real key hook (and only that: no shortcut is
 * registered). Used by the opt-in live test on a machine that has already
 * granted Accessibility, so it cannot cause a prompt.
 */
export const testHotkey = isTest && process.env.XTRACTOR_TEST_HOTKEY === '1'

/** Set by the dev server; absent in a production build. */
export const devServerUrl = process.env.ELECTRON_RENDERER_URL

export const preloadPath = join(import.meta.dirname, '../preload/index.cjs')

export function rendererFile(page: string): string {
  return join(import.meta.dirname, `../renderer/${page}.html`)
}

export function resourcePath(name: string): string {
  return join(app.getAppPath(), 'resources', name)
}
