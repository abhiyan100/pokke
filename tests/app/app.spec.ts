import { existsSync } from 'node:fs'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import type { Snip } from '../../src/shared/types'
import { freeze } from './helpers'

/**
 * Drives the real app in test mode: windows are created but never shown, the
 * "screen" is a fixture image, data lives in a temp folder, and the model is
 * a local stand-in that speaks the Ollama protocol.
 */

const root = resolve(import.meta.dirname, '../..')

const FILED = {
  pocket: 'design',
  title: 'Residency hero with oversized numerals',
  tags: ['Landing Page', 'serif', 'serif'],
  summary: 'A landing page hero built around a large serif numeral.',
  extractedText: '',
  prompt: 'Build the hero for [what I am building] using the attached image as the reference.'
}

let app: ElectronApplication
let dataDir: string
let model: Server
let modelUrl: string
let modelRequests: { model: string; note: string; imageBytes: number }[] = []

async function pageFor(name: 'library' | 'overlay' | 'toast'): Promise<Page> {
  const open = () => app.windows().find((page) => !page.isClosed() && page.url().includes(`${name}.html`))
  await expect.poll(() => Boolean(open())).toBe(true)
  return open()!
}

const snips = (page: Page) => page.evaluate(() => window.pokke!.snips.list())

test.beforeAll(async () => {
  test.skip(!existsSync(join(root, 'out/main/index.js')), 'Run `npm run build` first.')

  model = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      response.setHeader('content-type', 'application/json')
      if (request.url === '/api/tags') {
        response.end(JSON.stringify({ models: [{ name: 'tiny-text:1b' }, { name: 'llava:7b' }] }))
      } else if (request.url === '/api/chat') {
        const sent = JSON.parse(body)
        const user = sent.messages.at(-1)
        modelRequests.push({ model: sent.model, note: user.content, imageBytes: user.images[0].length })
        // Wrapped in a code fence, as small local models often answer.
        response.end(JSON.stringify({ message: { content: '```json\n' + JSON.stringify(FILED) + '\n```' } }))
      } else {
        response.statusCode = 404
        response.end('{}')
      }
    })
  })
  await new Promise<void>((done) => model.listen(0, '127.0.0.1', done))
  modelUrl = `http://127.0.0.1:${(model.address() as AddressInfo).port}`

  dataDir = await mkdtemp(join(tmpdir(), 'pokke-test-'))
  app = await electron.launch({
    args: [root],
    env: {
      ...process.env,
      POKKE_TEST: '1',
      POKKE_DATA_DIR: dataDir,
      POKKE_FIXTURE: join(root, 'tests/fixtures/screen.png')
    }
  })
})

test.afterAll(async () => {
  await app?.close()
  model?.close()
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('snip, note, save, and have a model file it', async () => {
  const library = await pageFor('library')
  const overlay = await pageFor('overlay')
  const toast = await pageFor('toast')

  await test.step('nothing is shown on screen in test mode', async () => {
    const visible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((win) => win.isVisible()))
    expect(visible).toEqual([false, false, false])
  })

  await test.step('the tray and Dock icons ship with the app', async () => {
    const empty = await app.evaluate(({ app: electronApp, nativeImage }) => {
      const at = (name: string) => `${electronApp.getAppPath()}/resources/${name}`
      return ['trayTemplate.png', 'tray.png', 'icon.png'].map((name) => nativeImage.createFromPath(at(name)).isEmpty())
    })
    expect(empty).toEqual([false, false, false])
  })

  await test.step('first run shows the welcome card over seven empty pockets', async () => {
    await expect(library.locator('.pocket')).toHaveCount(7)
    await expect(library.getByRole('dialog', { name: 'Snip it. It files itself.' })).toBeVisible()
    await library.getByRole('button', { name: 'Start snipping' }).click()
    await expect(library.getByRole('dialog')).toHaveCount(0)
  })

  const selection = { x: 120, y: 90, width: 300, height: 200 }

  await test.step('the hotkey freezes the screen and a region can be saved with a note', async () => {
    await freeze(library, overlay)

    await overlay.mouse.move(selection.x, selection.y)
    await overlay.mouse.down()
    await overlay.mouse.move(selection.x + 150, selection.y + 100, { steps: 4 })
    await overlay.mouse.move(selection.x + selection.width, selection.y + selection.height, { steps: 4 })
    await overlay.mouse.up()

    await expect(overlay.locator('.size')).toHaveText('300 × 200')
    await overlay.getByLabel('Note for this snip').fill('hero idea for the portfolio')
    await overlay.keyboard.press('Enter')
  })

  let saved: Snip

  await test.step('the snip is on disk at screen resolution, waiting for a model', async () => {
    await expect.poll(async () => (await snips(library)).length).toBe(1)
    saved = (await snips(library))[0]!
    expect(saved.note).toBe('hero idea for the portfolio')
    expect(saved.status).toBe('waiting')

    // The fixture is mapped onto the display, so the crop is the selection scaled to image pixels.
    const display = await app.evaluate(({ screen }) => {
      const active = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      return active.size
    })
    expect(saved.width).toBeCloseTo((selection.width * 2880) / display.width, -1)
    expect(saved.height).toBeCloseTo((selection.height * 1800) / display.height, -1)
    expect(saved.palette.length).toBeGreaterThan(0)

    const image = await stat(join(dataDir, 'library/images', `${saved.id}.png`))
    const thumb = await stat(join(dataDir, 'library/thumbs', `${saved.id}.jpg`))
    expect(image.size).toBeGreaterThan(1000)
    expect(thumb.size).toBeGreaterThan(500)
  })

  await test.step('the corner thumbnail shows it and the library can load its image', async () => {
    await expect(toast.locator('.toast__tab')).toHaveText('Saved')
    await expect
      .poll(() => toast.locator('.toast__paper img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    await expect
      .poll(() => library.locator('.latest__item img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    await expect(overlay.locator('.overlay')).toHaveCount(1)
  })

  await test.step('choosing a model files the waiting snip', async () => {
    const models = await library.evaluate(
      (url) => window.pokke!.settings.save({ provider: 'ollama', baseUrl: url }).then(() => window.pokke!.settings.models('ollama')),
      modelUrl
    )
    // Vision-capable models are offered first.
    expect(models).toEqual(['llava:7b', 'tiny-text:1b'])
    await library.evaluate((id) => window.pokke!.settings.save({ model: id }), models[0]!)

    await expect.poll(async () => (await snips(library))[0]!.status, { timeout: 15_000 }).toBe('ready')
    const filed = (await snips(library))[0]!
    expect(filed.pocket).toBe('design')
    expect(filed.title).toBe(FILED.title)
    expect(filed.tags).toEqual(['landing page', 'serif'])
    expect(filed.prompt).toBe(FILED.prompt)

    expect(modelRequests).toHaveLength(1)
    expect(modelRequests[0]!.model).toBe('llava:7b')
    expect(modelRequests[0]!.note).toContain('hero idea for the portfolio')
    expect(modelRequests[0]!.imageBytes).toBeGreaterThan(1000)

    await expect(library.locator('.pocket[data-pocket="design"] .pocket__count')).toHaveText('1')
  })

  await test.step('the real window renders (captured off screen for review)', async () => {
    const png = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL().includes('library.html'))
      return (await win!.webContents.capturePage()).toPNG().toString('base64')
    })
    const file = test.info().outputPath('library.png')
    await writeFile(file, Buffer.from(png, 'base64'))
    expect(Buffer.from(png, 'base64').length).toBeGreaterThan(10_000)
  })

  await test.step('deleting removes the files', async () => {
    await library.evaluate((id) => window.pokke!.snips.remove(id), saved.id)
    await expect.poll(async () => (await snips(library)).length).toBe(0)
    expect(existsSync(join(dataDir, 'library/images', `${saved.id}.png`))).toBe(false)
  })

  await test.step('losing the overlay window mid-snip does not block the next snip', async () => {
    await freeze(library, overlay)
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((win) => win.webContents.getURL().includes('overlay.html'))!
        .destroy()
    })
    await expect.poll(() => overlay.isClosed()).toBe(true)

    // The app makes a fresh overlay window for the next snip.
    await library.evaluate(() => window.pokke!.capture.start())
    const reopened = await pageFor('overlay')
    await expect(reopened.locator('.overlay')).toHaveAttribute('data-phase', 'aiming')
    await reopened.keyboard.press('Escape')
  })
})

/**
 * Copying replaces whatever is on the clipboard, so this only runs when asked:
 * POKKE_TEST_CLIPBOARD=1 npm run test:app
 */
test('copy puts the prompt, then the image, on the clipboard', async () => {
  test.skip(process.env.POKKE_TEST_CLIPBOARD !== '1', 'Touches the system clipboard; opt in to run.')
  const library = await pageFor('library')
  const overlay = await pageFor('overlay')

  // Whatever is on the clipboard is copied into the main process and put back afterwards.
  await app.evaluate(async ({ clipboard }) => {
    const saved: Record<string, Blob | string>[] = []
    for (const item of await clipboard.read()) {
      const entry: Record<string, Blob | string> = {}
      for (const type of item.types) {
        const value = await item.getType(type).catch(() => null)
        if (value instanceof Blob) entry[type] = value
      }
      saved.push(entry)
    }
    Object.assign(globalThis, { savedClipboard: saved, savedClipboardText: await clipboard.readText().catch(() => '') })
  })
  try {
    await freeze(library, overlay)
    await overlay.mouse.move(200, 200)
    await overlay.mouse.down()
    await overlay.mouse.move(420, 360, { steps: 4 })
    await overlay.mouse.up()
    await overlay.keyboard.press('Enter')
    await expect.poll(async () => (await snips(library))[0]?.status, { timeout: 15_000 }).toBe('ready')
    const id = (await snips(library))[0]!.id

    await library.evaluate((snipId) => window.pokke!.snips.copy(snipId, 'prompt'), id)
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(FILED.prompt)

    await library.evaluate((snipId) => window.pokke!.snips.copy(snipId, 'image'), id)
    expect(await app.evaluate(({ clipboard }) => clipboard.has('image/png'))).toBe(true)
  } finally {
    await app.evaluate(async ({ clipboard, ClipboardItem }) => {
      const { savedClipboard = [], savedClipboardText = '' } = globalThis as {
        savedClipboard?: Record<string, Blob | string>[]
        savedClipboardText?: string
      }
      const items = savedClipboard.filter((entry) => Object.keys(entry).length > 0).map((entry) => new ClipboardItem(entry))
      try {
        if (items.length > 0) await clipboard.write(items)
        else clipboard.clear()
      } catch {
        await clipboard.writeText(savedClipboardText)
      }
    })
  }
})
