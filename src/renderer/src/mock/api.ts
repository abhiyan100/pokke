import type { XtractorApi } from '@shared/api'
import {
  PROVIDER_IDS,
  providerInfo,
  type CaptureFrame,
  type ProviderId,
  type SettingsView,
  type Snip
} from '@shared/types'
import { sampleSnips } from './samples'

type Listener<T> = (value: T) => void

/** A tiny event channel: subscribe returns the unsubscribe function. */
function channel<T>() {
  const listeners = new Set<Listener<T>>()
  return {
    emit: (value: T) => listeners.forEach((listener) => listener(value)),
    subscribe: (listener: Listener<T>) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MODELS: Record<ProviderId, string[]> = {
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-haiku-5-5'],
  openai: ['gpt-5.2', 'gpt-5.2-mini'],
  gemini: ['gemini-3-pro', 'gemini-3-flash'],
  ollama: ['llama3.2-vision:11b', 'gemma3:12b'],
  custom: ['local-model']
}

/**
 * Stands in for the Electron bridge when the pages run in a plain browser,
 * which is how the UI is developed and tested headlessly. It keeps everything
 * in memory and is steered by query parameters:
 *
 *   ?empty     start with no snips
 *   ?fresh     first run: nothing set up, welcome shown
 *   ?blocked   macOS permissions not granted yet
 *   ?platform= win32 or linux, to see the app as it looks off macOS
 *   ?status=   state of the snip shown by the toast page
 *
 * What the UI asked for is recorded on `window.__mock` for tests to read.
 */
export function createMockApi(): XtractorApi {
  const query = new URLSearchParams(location.search)
  const base = import.meta.env.BASE_URL
  const fresh = query.has('fresh')

  let snips: Snip[] = query.has('empty') ? [] : sampleSnips(base)
  const snipsChanged = channel<Snip[]>()
  const frames = channel<CaptureFrame>()
  const toastSnip = channel<Snip | null>()

  const record: Record<string, unknown> = {}
  ;(window as unknown as { __mock: typeof record }).__mock = record

  const settings: SettingsView = {
    provider: fresh ? null : 'anthropic',
    model: fresh ? '' : 'claude-opus-5-5',
    baseUrl: '',
    keySaved: Object.fromEntries(PROVIDER_IDS.map((id) => [id, !fresh && id === 'anthropic'])) as Record<
      ProviderId,
      boolean
    >,
    doubleTap: true,
    doubleTapKey: query.get('platform') && query.get('platform') !== 'darwin' ? 'ctrl' : 'meta',
    shortcut: 'CommandOrControl+Shift+2',
    welcomed: !fresh
  }

  const patch = (id: string, change: Partial<Snip>) => {
    snips = snips.map((snip) => (snip.id === id ? { ...snip, ...change } : snip))
    snipsChanged.emit(snips)
  }

  return {
    platform: (query.get('platform') as XtractorApi['platform'] | null) ?? 'darwin',

    snips: {
      list: async () => snips,
      update: async (id, change) => patch(id, change),
      remove: async (id) => {
        snips = snips.filter((snip) => snip.id !== id)
        snipsChanged.emit(snips)
      },
      analyze: async (id) => {
        patch(id, { status: 'analyzing', error: undefined })
        void wait(1600).then(() => patch(id, { status: 'ready' }))
      },
      copy: async (id, kind) => {
        record.copied = { id, kind }
        const snip = snips.find((candidate) => candidate.id === id)
        if (kind === 'prompt' && snip) await navigator.clipboard?.writeText(snip.prompt).catch(() => undefined)
      },
      reveal: async (id) => {
        record.revealed = id
      },
      onChange: snipsChanged.subscribe
    },

    settings: {
      get: async () => ({ ...settings }),
      save: async (change) => {
        if (change.provider && change.provider !== settings.provider) {
          settings.model = providerInfo(change.provider).defaultModel
          settings.baseUrl = providerInfo(change.provider).defaultBaseUrl
        }
        Object.assign(settings, change)
        return { ...settings }
      },
      setKey: async (provider, key) => {
        settings.keySaved = { ...settings.keySaved, [provider]: key.trim() !== '' }
        return { ...settings }
      },
      models: async (provider) => {
        await wait(350)
        if (providerInfo(provider).key === 'required' && !settings.keySaved[provider]) {
          throw new Error(`Add your ${providerInfo(provider).name} API key first.`)
        }
        return MODELS[provider]
      },
      permissions: async () => {
        const granted = !query.has('blocked') || Boolean(record.asked)
        return { screen: granted, accessibility: granted, doubleTapAvailable: true, doubleTapActive: granted, shortcutActive: true }
      },
      askPermission: async (kind) => {
        record.asked = kind
      }
    },

    capture: {
      start: async () => {
        record.captureStarted = true
      },
      onFrame: (listener) => {
        const unsubscribe = frames.subscribe(listener)
        // The overlay page shows the sample desktop as soon as it is ready.
        setTimeout(() => {
          frames.emit({
            imageUrl: `${base}samples/screen.svg`,
            width: window.innerWidth,
            height: window.innerHeight,
            toast: { x: window.innerWidth - 310, y: window.innerHeight - 250, width: 296, height: 236 }
          })
        }, 30)
        return unsubscribe
      },
      ready: () => {
        record.captureReady = true
      },
      save: async (rect, note) => {
        record.saved = { rect, note }
        await wait(60)
        const template = sampleSnips(base)[0]!
        return { ...template, id: 'sample-new', note, status: 'analyzing', title: '', prompt: '' }
      },
      finish: () => {
        document.documentElement.dataset.capture = 'finished'
      },
      cancel: () => {
        document.documentElement.dataset.capture = 'cancelled'
      }
    },

    toast: {
      onSnip: (listener) => {
        const unsubscribe = toastSnip.subscribe(listener)
        const template = sampleSnips(base)[0]!
        const status = (query.get('status') as Snip['status'] | null) ?? 'analyzing'
        const unfiled = { title: '', prompt: '', summary: '', tags: [] }
        setTimeout(() => {
          if (status === 'ready') toastSnip.emit(template)
          else if (status === 'failed') toastSnip.emit({ ...template, ...unfiled, status, error: 'Anthropic rejected the API key.' })
          else toastSnip.emit({ ...template, ...unfiled, status })
        }, 30)
        // Left alone, a working snip finishes after a moment, as it would for real.
        if (!query.has('status')) setTimeout(() => toastSnip.emit(template), 2200)
        return unsubscribe
      },
      open: (id) => {
        record.toastOpened = id
      },
      dismiss: () => {
        record.toastDismissed = true
        toastSnip.emit(null)
      }
    },

    nav: {
      onOpen: () => () => undefined
    }
  }
}
