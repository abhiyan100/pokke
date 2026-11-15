import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Library } from '../../src/main/store/library'
import { SettingsStore, type Cipher } from '../../src/main/store/settings'
import type { SnipRecord } from '../../src/shared/types'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pokke-unit-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function record(id: string, patch: Partial<SnipRecord> = {}): SnipRecord {
  return {
    id,
    createdAt: 1,
    note: '',
    width: 10,
    height: 10,
    palette: [],
    status: 'waiting',
    pocket: 'loose',
    title: '',
    tags: [],
    summary: '',
    extractedText: '',
    prompt: '',
    ...patch
  }
}

describe('library', () => {
  it('keeps snips across restarts, newest first, and removes their files with them', async () => {
    const library = new Library(dir)
    await library.open()
    await library.add(record('old', { createdAt: 1 }), Buffer.from('png'), Buffer.from('jpg'))
    await library.add(record('new', { createdAt: 2 }), Buffer.from('png'), Buffer.from('jpg'))
    await library.update('old', { title: 'Renamed', pocket: 'design' })

    const reopened = new Library(dir)
    await reopened.open()
    expect(reopened.list().map((snip) => snip.id)).toEqual(['new', 'old'])
    expect(reopened.get('old')).toMatchObject({ title: 'Renamed', pocket: 'design' })

    await reopened.remove('new')
    expect(await readdir(join(dir, 'images'))).toEqual(['old.png'])
    expect(await readdir(join(dir, 'thumbs'))).toEqual(['old.jpg'])
  })

  it.skipIf(process.platform === 'win32')('finishes a delete that failed the first time, and clears files no snip points to', async () => {
    const library = new Library(dir)
    await library.open()
    await library.add(record('a'), Buffer.from('p'), Buffer.from('j'))

    // The index cannot be rewritten while the folder is read-only, so the delete fails...
    await chmod(dir, 0o555)
    await expect(library.remove('a')).rejects.toThrow()
    await chmod(dir, 0o755)
    expect(library.get('a')).toBeDefined()

    // ...and trying again completes it.
    await library.remove('a')
    expect(await readdir(join(dir, 'images'))).toEqual([])

    // A file left behind by an interrupted delete is cleared the next time the library opens.
    await library.add(record('b'), Buffer.from('p'), Buffer.from('j'))
    await writeFile(join(dir, 'images', 'gone.png'), 'left over')
    const reopened = new Library(dir)
    await reopened.open()
    expect(await readdir(join(dir, 'images'))).toEqual(['b.png'])
  })

  it('puts a snip that was mid-analysis when the app quit back to waiting', async () => {
    const library = new Library(dir)
    await library.open()
    await library.add(record('a', { status: 'analyzing' }), Buffer.from('p'), Buffer.from('j'))

    const reopened = new Library(dir)
    await reopened.open()
    expect(reopened.get('a')?.status).toBe('waiting')
  })

  it('sets an unreadable index aside instead of overwriting it', async () => {
    await writeFile(join(dir, 'index.json'), '{ not json')
    const library = new Library(dir)
    await library.open()
    expect(library.list()).toEqual([])
    expect((await readdir(dir)).some((name) => name.startsWith('index.json.unreadable-'))).toBe(true)
  })
})

describe('settings', () => {
  const cipher: Cipher = {
    encrypt: (plain) => `enc(${plain})`,
    decrypt: (stored) => stored.slice(4, -1)
  }

  it('stores keys encrypted and never exposes them in the view', async () => {
    const file = join(dir, 'settings.json')
    const settings = new SettingsStore(file, cipher)
    await settings.open()
    const view = await settings.setKey('openai', '  sk-secret  ')

    expect(view.keySaved.openai).toBe(true)
    expect(JSON.stringify(view)).not.toContain('sk-secret')

    const reopened = new SettingsStore(file, cipher)
    await reopened.open()
    expect(reopened.key('openai')).toBe('sk-secret')
    expect((await reopened.setKey('openai', '')).keySaved.openai).toBe(false)
  })

  it('only ever releases a key for the address it was entered for', async () => {
    const settings = new SettingsStore(join(dir, 'settings.json'), cipher)
    await settings.open()
    await settings.save({ provider: 'custom', baseUrl: 'http://localhost:1234/v1' })
    await settings.setKey('custom', 'sk-router')
    expect(settings.key('custom')).toBe('sk-router')

    // Pointing the provider elsewhere, in any way, withholds the key.
    expect((await settings.save({ baseUrl: 'https://elsewhere.example/v1' })).keySaved.custom).toBe(false)
    expect(settings.key('custom')).toBe('')
    await settings.save({ provider: 'ollama' })
    await settings.save({ provider: 'custom', baseUrl: 'https://elsewhere.example/v1' })
    expect(settings.key('custom')).toBe('')
    await settings.save({ baseUrl: 'http://localhost:1234/v1' })
    expect(settings.key('custom')).toBe('sk-router')

    // A provider with a fixed address cannot be pointed anywhere else at all.
    await settings.save({ provider: 'openai' })
    await settings.setKey('openai', 'sk-1')
    const view = await settings.save({ baseUrl: 'https://elsewhere.example/v1' })
    expect(view.baseUrl).toBe('https://api.openai.com/v1')
    expect(settings.key('openai')).toBe('sk-1')
  })

  it('sets damaged settings aside instead of overwriting the saved keys', async () => {
    const file = join(dir, 'settings.json')
    await writeFile(file, '{ "provider": "openai", "keys": ')
    const settings = new SettingsStore(file, cipher)
    await settings.open()
    await settings.save({ welcomed: true })

    const kept = (await readdir(dir)).find((name) => name.startsWith('settings.json.unreadable-'))
    expect(kept).toBeDefined()
  })

  it('resets the model and address when the provider changes', async () => {
    const settings = new SettingsStore(join(dir, 'settings.json'), cipher)
    await settings.open()
    await settings.save({ provider: 'ollama', model: 'llava', baseUrl: 'http://box:11434' })
    const view = await settings.save({ provider: 'anthropic' })
    expect(view).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', baseUrl: '' })
  })
})
