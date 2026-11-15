import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Analyst, PROVIDER_BY_ID } from '../../src/main/ai/analyst'
import { ProviderError, type Provider } from '../../src/main/ai/provider'
import { Library } from '../../src/main/store/library'
import { SettingsStore } from '../../src/main/store/settings'
import type { SnipRecord } from '../../src/shared/types'

const plain = { encrypt: (text: string) => text, decrypt: (text: string) => text }
const image = { base64: 'aGk=', mediaType: 'image/png' as const }

let dir: string
let library: Library
let settings: SettingsStore

const snip: SnipRecord = {
  id: 's1',
  createdAt: 1,
  note: 'for the homepage',
  width: 10,
  height: 10,
  palette: [],
  status: 'waiting',
  pocket: 'loose',
  title: '',
  tags: [],
  summary: '',
  extractedText: '',
  prompt: ''
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pokke-unit-'))
  library = new Library(join(dir, 'library'))
  settings = new SettingsStore(join(dir, 'settings.json'), plain)
  await Promise.all([library.open(), settings.open()])
  await library.add(snip, Buffer.from('p'), Buffer.from('j'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function analystWith(analyze: Provider['analyze']): Analyst {
  const provider: Provider = { analyze, listModels: async () => [] }
  return new Analyst(library, settings, async () => image, { ...PROVIDER_BY_ID, openai: provider })
}

/** Waits until the model's answer (or its failure) has been written back. */
const settled = () => vi.waitFor(() => expect(['ready', 'failed']).toContain(library.get('s1')?.status))

describe('analyst', () => {
  it('leaves a snip waiting until a model with a key is chosen', async () => {
    const analyze = vi.fn()
    const analyst = analystWith(analyze)
    await settings.save({ provider: 'openai', model: 'some-model' })

    const changed = vi.fn()
    library.on('changed', changed)
    analyst.enqueue('s1')
    analyst.enqueueWaiting()
    expect(analyst.isConfigured()).toBe(false)
    expect(library.get('s1')?.status).toBe('waiting')
    expect(analyze).not.toHaveBeenCalled()
    // Nothing changed, so nothing is rewritten or announced.
    expect(changed).not.toHaveBeenCalled()
  })

  it('files a waiting snip once the model is usable, passing the note, image and key', async () => {
    const analyze = vi.fn(async () => ({ pocket: 'design', title: 'Hero', tags: ['hero'], summary: 's', extractedText: '', prompt: 'Build it' }))
    const analyst = analystWith(analyze)
    await settings.save({ provider: 'openai', model: 'some-model' })
    await settings.setKey('openai', 'sk-1')

    analyst.enqueueWaiting()
    await settled()

    expect(library.get('s1')).toMatchObject({ status: 'ready', pocket: 'design', title: 'Hero', prompt: 'Build it' })
    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'some-model', apiKey: 'sk-1', note: 'for the homepage', image, baseUrl: 'https://api.openai.com/v1' })
    )
  })

  it('does not overwrite an edit made while the model was still working', async () => {
    let answer: (value: unknown) => void = () => undefined
    const analyst = analystWith(() => new Promise((resolve) => (answer = resolve)))
    await settings.save({ provider: 'openai', model: 'some-model' })
    await settings.setKey('openai', 'sk-1')

    analyst.enqueue('s1')
    await vi.waitFor(() => expect(library.get('s1')?.status).toBe('analyzing'))
    await library.update('s1', { title: 'My own title', prompt: 'My edited prompt' })
    answer({ pocket: 'design', title: 'Generated title', tags: ['hero'], summary: 's', extractedText: '', prompt: 'Generated prompt' })
    await settled()

    expect(library.get('s1')).toMatchObject({
      status: 'ready',
      title: 'My own title',
      prompt: 'My edited prompt',
      pocket: 'design',
      tags: ['hero']
    })
  })

  it('keeps the snip and records a readable reason when the model call fails', async () => {
    const analyst = analystWith(async () => {
      throw new ProviderError('OpenAI rejected the API key.')
    })
    await settings.save({ provider: 'openai', model: 'some-model' })
    await settings.setKey('openai', 'bad')

    analyst.enqueue('s1')
    await settled()

    expect(library.get('s1')).toMatchObject({ status: 'failed', error: 'OpenAI rejected the API key.', note: 'for the homepage' })
  })
})
