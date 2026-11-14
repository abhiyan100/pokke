import type { PocketId } from './pockets'

/**
 * waiting   saved, but no model is set up yet (or its key is missing)
 * analyzing the model is looking at it now
 * ready     filed, with a prompt
 * failed    the model call failed; `error` says why and it can be retried
 */
export type SnipStatus = 'waiting' | 'analyzing' | 'ready' | 'failed'

/** What the model returns for a snip. */
export interface Analysis {
  pocket: PocketId
  title: string
  tags: string[]
  summary: string
  extractedText: string
  prompt: string
}

/** A snip as stored on disk. */
export interface SnipRecord extends Analysis {
  id: string
  createdAt: number
  note: string
  /** Image size in pixels. */
  width: number
  height: number
  /** Dominant colours as hex, found locally without a model. */
  palette: string[]
  status: SnipStatus
  error?: string
}

/** A snip as the UI sees it: the record plus URLs it can load. */
export interface Snip extends SnipRecord {
  imageUrl: string
  thumbUrl: string
}

/** Fields the user can edit by hand. */
export type SnipPatch = Partial<Pick<SnipRecord, 'note' | 'pocket' | 'title' | 'tags' | 'prompt'>>

export const PROVIDER_IDS = ['anthropic', 'openai', 'gemini', 'ollama', 'custom'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface ProviderInfo {
  id: ProviderId
  name: string
  /** One line under the name in settings. */
  blurb: string
  /** required: cannot be called without a key. optional: some servers want one. none: never. */
  key: 'required' | 'optional' | 'none'
  /** Whether the user can point it at another address. */
  editableUrl: boolean
  defaultBaseUrl: string
  defaultModel: string
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    blurb: 'Anthropic API key',
    key: 'required',
    editableUrl: false,
    defaultBaseUrl: '',
    defaultModel: 'claude-opus-5-5'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    blurb: 'OpenAI API key',
    key: 'required',
    editableUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: ''
  },
  {
    id: 'gemini',
    name: 'Gemini',
    blurb: 'Google AI Studio key',
    key: 'required',
    editableUrl: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: ''
  },
  {
    id: 'ollama',
    name: 'Ollama',
    blurb: 'Runs on this computer, no key',
    key: 'none',
    editableUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: ''
  },
  {
    id: 'custom',
    name: 'Other',
    blurb: 'Any OpenAI-compatible address',
    key: 'optional',
    editableUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModel: ''
  }
]

export function providerInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id)!
}

/**
 * The address a provider is actually called at. Only providers with an
 * editable address honour a custom one; the rest always use their own, so a
 * saved key can never be sent anywhere else.
 */
export function providerAddress(id: ProviderId, custom: string): string {
  const info = providerInfo(id)
  return (info.editableUrl && custom.trim()) || info.defaultBaseUrl
}

/**
 * The right-hand modifier that starts a snip when tapped twice. Right ⌘ is the
 * default on macOS, but macOS can give "either Command key twice" to Siri, so
 * the others are offered as a way out of that clash.
 */
export const DOUBLE_TAP_KEYS = ['meta', 'alt', 'ctrl'] as const
export type DoubleTapKey = (typeof DOUBLE_TAP_KEYS)[number]

/** The keys offered on a platform, default first. Right Win is left out: Windows owns it. */
export function doubleTapKeysFor(platform: Platform): DoubleTapKey[] {
  return platform === 'darwin' ? ['meta', 'alt', 'ctrl'] : ['ctrl', 'alt']
}

/** Settings as the UI sees them. Keys never leave the main process. */
export interface SettingsView {
  provider: ProviderId | null
  model: string
  baseUrl: string
  keySaved: Record<ProviderId, boolean>
  /** Whether a double-tap of `doubleTapKey` starts a snip. */
  doubleTap: boolean
  doubleTapKey: DoubleTapKey
  /** Regular shortcut that always works, in Electron accelerator form. */
  shortcut: string
  /** The first-run guide has been finished or skipped. */
  welcomed: boolean
}

export type SettingsPatch = Partial<Omit<SettingsView, 'keySaved'>>

export type Platform = 'darwin' | 'win32' | 'linux'

export interface Permissions {
  /** The app may read the screen. Always true off macOS. */
  screen: boolean
  /** The app may see the double-tap. Always true off macOS. */
  accessibility: boolean
  /** The native key hook loaded; false means only the regular shortcut works. */
  doubleTapAvailable: boolean
  /** The key hook is running and will see a double-tap right now. */
  doubleTapActive: boolean
  /** The regular shortcut is registered; false when another app already holds it. */
  shortcutActive: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The frozen screen handed to the overlay. Sizes are in CSS pixels. */
export interface CaptureFrame {
  imageUrl: string
  width: number
  height: number
  /** Where the corner thumbnail will appear, so the saved snip can fly to it. */
  toast: Rect
}

export type CopyKind = 'prompt' | 'image'

export type NavTarget = { view: 'snip'; id: string } | { view: 'settings' }
