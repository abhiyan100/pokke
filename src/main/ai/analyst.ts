import { providerInfo, type Analysis, type ProviderId, type SnipRecord } from '@shared/types'
import type { Library } from '../store/library'
import type { SettingsStore } from '../store/settings'
import { normalizeAnalysis } from './brief'
import { ProviderError, type AnalyzeRequest, type Provider } from './provider'
import { anthropic } from './providers/anthropic'
import { gemini } from './providers/gemini'
import { ollama } from './providers/ollama'
import { custom, openai } from './providers/openai'

export const PROVIDER_BY_ID: Record<ProviderId, Provider> = { anthropic, openai, gemini, ollama, custom }

export type LoadImage = (id: string) => Promise<AnalyzeRequest['image']>

const CONCURRENCY = 2

/**
 * Sends snips to the chosen model in the background and writes the result
 * back to the library. A snip is never lost to a failed call: it stays saved
 * and is marked so it can be retried.
 */
export class Analyst {
  private readonly pending: string[] = []
  private running = 0

  constructor(
    private readonly library: Library,
    private readonly settings: SettingsStore,
    private readonly loadImage: LoadImage,
    private readonly providers: Record<ProviderId, Provider> = PROVIDER_BY_ID
  ) {}

  /** True when a provider is chosen and has what it needs to be called. */
  isConfigured(): boolean {
    const { provider, model } = this.settings.view()
    if (!provider || !model) return false
    return providerInfo(provider).key !== 'required' || Boolean(this.settings.key(provider))
  }

  /** Queues one snip. Without a usable model it is left waiting instead. */
  enqueue(id: string): void {
    if (!this.isConfigured()) {
      if (this.library.get(id)?.status !== 'waiting') void this.library.update(id, { status: 'waiting', error: undefined })
      return
    }
    if (!this.pending.includes(id)) this.pending.push(id)
    void this.library.update(id, { status: 'analyzing', error: undefined })
    this.drain()
  }

  /** Queues every snip that was saved before a model was available. */
  enqueueWaiting(): void {
    if (!this.isConfigured()) return
    for (const record of this.library.list()) {
      if (record.status === 'waiting') this.enqueue(record.id)
    }
  }

  private drain(): void {
    while (this.running < CONCURRENCY) {
      const id = this.pending.shift()
      if (!id) return
      this.running += 1
      void this.analyze(id).finally(() => {
        this.running -= 1
        this.drain()
      })
    }
  }

  private async analyze(id: string): Promise<void> {
    const record = this.library.get(id)
    if (!record) return
    const { provider, model } = this.settings.view()
    if (!provider) return

    try {
      const raw = await this.providers[provider].analyze({
        model,
        baseUrl: this.settings.address(provider),
        apiKey: this.settings.key(provider),
        image: await this.loadImage(id),
        note: record.note,
        palette: record.palette
      })
      const analysis = normalizeAnalysis(raw)
      // Decided against the record as it is now, inside the update, so an edit made while the model worked is kept.
      await this.library.update(id, (current) => ({
        ...keepEdits(record, current, analysis),
        status: 'ready',
        error: undefined
      }))
    } catch (error) {
      await this.library.update(id, { status: 'failed', error: readable(error) })
    }
  }
}

const ANALYSIS_FIELDS = ['pocket', 'title', 'tags', 'summary', 'extractedText', 'prompt'] as const

/**
 * The parts of a model's answer that may be written: every field the user has
 * not changed since the model was asked. `asked` is the record as sent to the
 * model, `current` is the record now.
 */
export function keepEdits(asked: SnipRecord, current: SnipRecord, analysis: Analysis): Partial<Analysis> {
  const unchanged = (field: (typeof ANALYSIS_FIELDS)[number]) =>
    JSON.stringify(asked[field]) === JSON.stringify(current[field])
  return Object.fromEntries(
    ANALYSIS_FIELDS.filter(unchanged).map((field) => [field, analysis[field]])
  ) as Partial<Analysis>
}

function readable(error: unknown): string {
  if (error instanceof ProviderError) return error.message
  if (error instanceof Error && error.message) return error.message.slice(0, 200)
  return 'The model could not analyse this snip.'
}
