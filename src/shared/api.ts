import type {
  CaptureFrame,
  CopyKind,
  NavTarget,
  Permissions,
  Platform,
  ProviderId,
  Rect,
  SettingsPatch,
  SettingsView,
  Snip,
  SnipPatch
} from './types'

type Unsubscribe = () => void

/**
 * Everything the UI can ask the app to do. The preload script implements this
 * over IPC; in a plain browser the mock bridge implements it with sample data.
 */
export interface XtractorApi {
  platform: Platform

  snips: {
    list(): Promise<Snip[]>
    update(id: string, patch: SnipPatch): Promise<void>
    remove(id: string): Promise<void>
    /** Run (or re-run) the model on one snip. */
    analyze(id: string): Promise<void>
    copy(id: string, kind: CopyKind): Promise<void>
    /** Show the image file in Finder / Explorer. */
    reveal(id: string): Promise<void>
    onChange(listener: (snips: Snip[]) => void): Unsubscribe
  }

  settings: {
    get(): Promise<SettingsView>
    save(patch: SettingsPatch): Promise<SettingsView>
    /** An empty key removes the saved one. */
    setKey(provider: ProviderId, key: string): Promise<SettingsView>
    /** Models the provider offers right now, at its saved address. Rejects with a readable message. */
    models(provider: ProviderId): Promise<string[]>
    permissions(): Promise<Permissions>
    askPermission(kind: 'screen' | 'accessibility'): Promise<void>
  }

  capture: {
    start(): Promise<void>
    onFrame(listener: (frame: CaptureFrame) => void): Unsubscribe
    /** The overlay has painted the frame and can be shown. */
    ready(): void
    save(rect: Rect, note: string): Promise<Snip>
    /** The save animation is done; hide the overlay. */
    finish(): void
    cancel(): void
  }

  toast: {
    onSnip(listener: (snip: Snip | null) => void): Unsubscribe
    open(id: string): void
    dismiss(): void
  }

  nav: {
    onOpen(listener: (target: NavTarget) => void): Unsubscribe
  }
}

/** IPC channel names, shared by preload and main so they cannot drift. */
export const CHANNEL = {
  snipsList: 'snips:list',
  snipsUpdate: 'snips:update',
  snipsRemove: 'snips:remove',
  snipsAnalyze: 'snips:analyze',
  snipsCopy: 'snips:copy',
  snipsReveal: 'snips:reveal',
  snipsChanged: 'snips:changed',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsSetKey: 'settings:set-key',
  settingsModels: 'settings:models',
  settingsPermissions: 'settings:permissions',
  settingsAskPermission: 'settings:ask-permission',
  captureStart: 'capture:start',
  captureFrame: 'capture:frame',
  captureReady: 'capture:ready',
  captureSave: 'capture:save',
  captureFinish: 'capture:finish',
  captureCancel: 'capture:cancel',
  toastSnip: 'toast:snip',
  toastOpen: 'toast:open',
  toastDismiss: 'toast:dismiss',
  navOpen: 'nav:open',
  navReady: 'nav:ready'
} as const
