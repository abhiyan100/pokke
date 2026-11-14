import { readFile, rename } from 'node:fs/promises'
import {
  PROVIDER_IDS,
  doubleTapKeysFor,
  providerAddress,
  providerInfo,
  type Platform,
  type ProviderId,
  type SettingsPatch,
  type SettingsView
} from '@shared/types'
import { createSerialQueue, writeFileAtomic } from './atomic'

/** Turns an API key into something safe to keep in a file, and back. */
export interface Cipher {
  encrypt(plain: string): string
  decrypt(stored: string): string
}

/** An encrypted key, with the address it was entered for. */
interface StoredKey {
  cipher: string
  address: string
}

interface StoredSettings extends Omit<SettingsView, 'keySaved'> {
  keys: Partial<Record<ProviderId, StoredKey>>
}

export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+2'

const DEFAULTS: StoredSettings = {
  provider: null,
  model: '',
  baseUrl: '',
  keys: {},
  doubleTap: true,
  doubleTapKey: doubleTapKeysFor(process.platform as Platform)[0]!,
  shortcut: DEFAULT_SHORTCUT,
  welcomed: false
}

export class SettingsStore {
  private data: StoredSettings = { ...DEFAULTS }
  private readonly enqueue = createSerialQueue()

  constructor(
    private readonly file: string,
    private readonly cipher: Cipher
  ) {}

  async open(): Promise<void> {
    this.data = { ...DEFAULTS }
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      // No settings yet is normal. Any other read failure is not: starting from
      // defaults would overwrite the saved keys on the next change.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    try {
      const parsed = JSON.parse(text) as Partial<StoredSettings>
      if (typeof parsed !== 'object' || parsed === null) throw new Error('settings are not an object')
      this.data = { ...DEFAULTS, ...parsed, keys: { ...parsed.keys } }
    } catch {
      // Keep the damaged file for the user rather than overwriting it.
      await rename(this.file, `${this.file}.unreadable-${Date.now()}`)
    }
  }

  view(): SettingsView {
    const { keys, ...rest } = this.data
    const keySaved = Object.fromEntries(
      PROVIDER_IDS.map((id) => [id, keys[id]?.address === this.address(id)])
    ) as Record<ProviderId, boolean>
    return { ...rest, keySaved }
  }

  async save(patch: SettingsPatch): Promise<SettingsView> {
    const next = { ...this.data, ...patch }
    // Switching provider resets the model and address to that provider's defaults
    // unless the same patch sets them.
    if (patch.provider && patch.provider !== this.data.provider) {
      const info = providerInfo(patch.provider)
      next.model = patch.model ?? info.defaultModel
      next.baseUrl = patch.baseUrl ?? info.defaultBaseUrl
    }
    if (next.provider) next.baseUrl = providerAddress(next.provider, next.baseUrl)
    this.data = next
    await this.persist()
    return this.view()
  }

  async setKey(provider: ProviderId, key: string): Promise<SettingsView> {
    const keys = { ...this.data.keys }
    const trimmed = key.trim()
    if (trimmed) keys[provider] = { cipher: this.cipher.encrypt(trimmed), address: this.address(provider) }
    else delete keys[provider]
    this.data = { ...this.data, keys }
    await this.persist()
    return this.view()
  }

  /**
   * The decrypted key, or an empty string when none is usable. A key belongs
   * to the address it was entered for: if the provider now points somewhere
   * else, the key is withheld rather than sent to the new place.
   */
  key(provider: ProviderId): string {
    const stored = this.data.keys[provider]
    if (!stored || stored.address !== this.address(provider)) return ''
    try {
      return this.cipher.decrypt(stored.cipher)
    } catch {
      return ''
    }
  }

  /** Where a provider is called right now: its saved address if it is the chosen one, else its default. */
  address(provider: ProviderId): string {
    return providerAddress(provider, this.data.provider === provider ? this.data.baseUrl : '')
  }

  private persist(): Promise<void> {
    return this.enqueue(() => writeFileAtomic(this.file, JSON.stringify(this.data, null, 2)))
  }
}
