import { execFile } from 'node:child_process'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { freeze } from './helpers'

/**
 * The parts a fixture cannot cover: grabbing the real screen and starting the
 * real key hook. Still hidden (test mode), but it reads the live display, so
 * it only runs when asked and only makes sense where Screen Recording and
 * Accessibility are already granted to the launching terminal:
 *
 *   POKKE_TEST_LIVE=1 npm run test:app
 *
 * The captured image stays in a temp folder that is deleted afterwards.
 */

const root = resolve(import.meta.dirname, '../..')
let app: ElectronApplication
let dataDir: string

async function pageFor(name: 'library' | 'overlay'): Promise<Page> {
  const open = () => app.windows().find((page) => !page.isClosed() && page.url().includes(`${name}.html`))
  await expect.poll(() => Boolean(open())).toBe(true)
  return open()!
}

test.beforeAll(async () => {
  test.skip(process.env.POKKE_TEST_LIVE !== '1', 'Reads the live screen; opt in to run.')
  dataDir = await mkdtemp(join(tmpdir(), 'pokke-live-'))
  app = await electron.launch({
    args: [root],
    env: { ...process.env, POKKE_TEST: '1', POKKE_TEST_HOTKEY: '1', POKKE_DATA_DIR: dataDir, POKKE_FIXTURE: '' }
  })
})

test.afterAll(async () => {
  await app?.close()
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('the real screen is captured at native resolution and cropped to the selection', async () => {
  const library = await pageFor('library')
  const overlay = await pageFor('overlay')

  const permissions = await library.evaluate(() => window.pokke!.settings.permissions())
  test.skip(!permissions.screen, 'Screen Recording is not granted to this terminal.')

  const display = await app.evaluate(({ screen }) => {
    const active = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    return { width: active.size.width, height: active.size.height, scale: active.scaleFactor }
  })

  await freeze(library, overlay)

  // The overlay window covers the whole display, menu bar included, rather than being pushed below it.
  const cover = await app.evaluate(({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('overlay.html'))!
    return { window: win.getBounds(), display: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).bounds }
  })
  expect(cover.window).toEqual(cover.display)

  // The frozen frame is the whole display at device pixels.
  const frame = await overlay.locator('.frame').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
  expect(frame).toEqual([display.width * display.scale, display.height * display.scale])

  await overlay.mouse.move(100, 120)
  await overlay.mouse.down()
  await overlay.mouse.move(250, 220, { steps: 4 })
  await overlay.mouse.move(400, 320, { steps: 4 })
  await overlay.mouse.up()
  await overlay.keyboard.press('Enter')

  await expect.poll(async () => (await library.evaluate(() => window.pokke!.snips.list())).length).toBe(1)
  const [snip] = await library.evaluate(() => window.pokke!.snips.list())
  expect([snip!.width, snip!.height]).toEqual([300 * display.scale, 200 * display.scale])
  expect((await stat(join(dataDir, 'library/images', `${snip!.id}.png`))).size).toBeGreaterThan(200)

  // Once the snip has flown to the corner, the thumbnail window sits in the bottom-right of the usable area.
  const corner = () =>
    app.evaluate(({ BrowserWindow, screen }) => {
      const win = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('toast.html'))!
      const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
      const bounds = win.getBounds()
      return { right: area.x + area.width - (bounds.x + bounds.width), bottom: area.y + area.height - (bounds.y + bounds.height) }
    })
  await expect.poll(corner).toEqual({ right: 4, bottom: 4 })

  // The temporary full-screen grabs are removed once the snip is saved.
  await expect
    .poll(async () => (await readdir(tmpdir())).filter((name) => /^pokke-\d+-\d+\.(png|jpg)$/.test(name)).length)
    .toBe(0)
})

test('the key hook for the double-tap starts', async () => {
  const library = await pageFor('library')
  const permissions = await library.evaluate(() => window.pokke!.settings.permissions())
  test.skip(!permissions.accessibility, 'Accessibility is not granted to this terminal.')

  await expect
    .poll(() => library.evaluate(() => window.pokke!.settings.permissions().then((now) => now.doubleTapActive)))
    .toBe(true)
})

/** Milliseconds since the keyboard or mouse was last used. */
async function idleMs(): Promise<number> {
  const { stdout } = await promisify(execFile)('ioreg', ['-c', 'IOHIDSystem'])
  const match = /"HIDIdleTime" = (\d+)/.exec(stdout)
  return match ? Number(match[1]) / 1e6 : 0
}

test('a double-tap of the chosen key starts a snip', async () => {
  test.skip(process.platform !== 'darwin', 'The key events are posted with a macOS program.')
  test.setTimeout(120_000)
  const library = await pageFor('library')
  const overlay = await pageFor('overlay')
  const permissions = await library.evaluate(() => window.pokke!.settings.permissions())
  test.skip(!permissions.accessibility, 'Accessibility is not granted to this terminal.')

  // Right Option, so the test cannot set off Siri or Dictation.
  await library.evaluate(() => window.pokke!.settings.save({ doubleTapKey: 'alt' }))
  await expect
    .poll(() => library.evaluate(() => window.pokke!.settings.permissions().then((now) => now.doubleTapActive)))
    .toBe(true)
  await expect(overlay.locator('.overlay')).not.toHaveAttribute('data-phase', 'aiming')

  // Built ahead of time so the taps go out the instant the keyboard is free.
  const program = test.info().outputPath('double-tap')
  await promisify(execFile)('swiftc', ['-O', join(root, 'tests/app/double-tap.swift'), '-o', program])

  // For the 40 ms of each tap the system believes Option is held, so wait for a pause in typing.
  let free = false
  for (let waited = 0; waited < 60_000 && !free; waited += 250) {
    free = (await idleMs()) > 2500
    if (!free) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  test.skip(!free, 'The keyboard was in use the whole time; not sending key events.')
  await promisify(execFile)(program)

  // The hook saw the two taps and froze the screen for a new snip.
  await expect(overlay.locator('.overlay')).toHaveAttribute('data-phase', 'aiming', { timeout: 15_000 })
  await overlay.keyboard.press('Escape')
})
