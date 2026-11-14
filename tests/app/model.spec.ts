import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { POCKET_IDS } from '../../src/shared/pockets'
import { freeze } from './helpers'

/**
 * One real model call, end to end: a snip of the sample desktop is filed by
 * a model running in Ollama on this computer. It needs a model that can read
 * images, so it only runs when one is named:
 *
 *   XTRACTOR_TEST_OLLAMA_MODEL=gemma3:4b npm run test:app
 *
 * What the model wrote is saved next to the test results for a person to read.
 */

const root = resolve(import.meta.dirname, '../..')
const model = process.env.XTRACTOR_TEST_OLLAMA_MODEL ?? ''

/**
 * Ollama speaks two protocols. Its own exercises the Ollama provider; its
 * OpenAI-compatible one exercises the code shared by the OpenAI and "Other"
 * providers against a real server.
 */
const ROUTES = [
  { name: 'the Ollama protocol', settings: { provider: 'ollama' as const } },
  { name: 'the OpenAI-compatible protocol', settings: { provider: 'custom' as const, baseUrl: 'http://localhost:11434/v1' } }
]

for (const route of ROUTES) test(`a real local model files a snip over ${route.name}`, async () => {
  test.skip(!model, 'Names no Ollama model; opt in to run.')
  test.setTimeout(300_000)

  const dataDir = await mkdtemp(join(tmpdir(), 'xtractor-model-'))
  const app = await electron.launch({
    args: [root],
    env: { ...process.env, XTRACTOR_TEST: '1', XTRACTOR_DATA_DIR: dataDir, XTRACTOR_FIXTURE: join(root, 'tests/fixtures/screen.png') }
  })

  try {
    const page = async (name: string) => {
      await expect.poll(() => app.windows().some((candidate) => candidate.url().includes(`${name}.html`))).toBe(true)
      return app.windows().find((candidate) => candidate.url().includes(`${name}.html`))!
    }
    const library = await page('library')
    const overlay = await page('overlay')

    await library.evaluate((settings) => window.xtractor!.settings.save(settings), route.settings)
    await library.evaluate((id) => window.xtractor!.settings.save({ model: id }), model)

    // The design in the first post of the sample desktop, which is drawn at 1440 x 900.
    const display = await app.evaluate(({ screen }) => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).size)
    const at = (x: number, y: number): [number, number] => [(x / 1440) * display.width, (y / 900) * display.height]

    await freeze(library, overlay)
    await overlay.mouse.move(...at(452, 244))
    await overlay.mouse.down()
    await overlay.mouse.move(...at(700, 400), { steps: 4 })
    await overlay.mouse.move(...at(904, 530), { steps: 4 })
    await overlay.mouse.up()
    await overlay.getByLabel('Note for this snip').fill('this hero for my portfolio relaunch')
    await overlay.keyboard.press('Enter')

    const first = async () => (await library.evaluate(() => window.xtractor!.snips.list()))[0]
    await expect.poll(async () => (await first())?.status, { timeout: 280_000, intervals: [1000] }).not.toBe('analyzing')
    const snip = (await first())!

    await writeFile(
      test.info().outputPath('filed.json'),
      JSON.stringify({ model, route: route.name, status: snip.status, error: snip.error, pocket: snip.pocket, title: snip.title, tags: snip.tags, summary: snip.summary, extractedText: snip.extractedText, prompt: snip.prompt }, null, 2)
    )

    expect(snip.error).toBeUndefined()
    expect(snip.status).toBe('ready')
    expect(POCKET_IDS).toContain(snip.pocket)
    expect(snip.title.length).toBeGreaterThan(3)
    expect(snip.prompt.length).toBeGreaterThan(80)
  } finally {
    await app.close()
    await rm(dataDir, { recursive: true, force: true })
  }
})
