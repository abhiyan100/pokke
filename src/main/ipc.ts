import { readFile } from 'node:fs/promises'
import { ClipboardItem, clipboard, ipcMain, shell, systemPreferences } from 'electron'
import { CHANNEL } from '@shared/api'
import { isPocketId } from '@shared/pockets'
import {
  DOUBLE_TAP_KEYS,
  PROVIDER_IDS,
  type CopyKind,
  type DoubleTapKey,
  type Permissions,
  type ProviderId,
  type Rect,
  type SettingsPatch,
  type SettingsView,
  type Snip,
  type SnipPatch,
  type SnipRecord
} from '@shared/types'
import { PROVIDER_BY_ID, type Analyst } from './ai/analyst'
import { screenAccessGranted, type CaptureSession } from './capture'
import { isMac, isTest } from './env'
import type { Hotkeys } from './hotkey'
import { activeDisplay, releaseShot, shootDisplay } from './screen'
import type { Library } from './store/library'
import type { SettingsStore } from './store/settings'
import type { Toast } from './toast'

export interface IpcContext {
  library: Library
  settings: SettingsStore
  analyst: Analyst
  capture: CaptureSession
  toast: Toast
  hotkeys: Hotkeys
  toSnip(record: SnipRecord): Snip
  openSnip(id: string): void
  /** Starts a snip asked for from the library window itself. */
  snipFromLibrary(): Promise<void>
  /** Applies hotkey settings after they change. */
  applyHotkeys(view: SettingsView): void
}

const SETTINGS_PANE = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

/**
 * Wires every UI request to the main process. Arguments arrive from a
 * renderer, so each handler checks what it is given before acting on it.
 */
export function registerIpc(context: IpcContext): void {
  const { library, settings, analyst, capture, toast, hotkeys } = context

  ipcMain.handle(CHANNEL.snipsList, () => library.list().map(context.toSnip))

  ipcMain.handle(CHANNEL.snipsUpdate, async (_event, id: unknown, patch: unknown) => {
    await library.update(asId(id), cleanPatch(patch))
  })

  ipcMain.handle(CHANNEL.snipsRemove, async (_event, id: unknown) => {
    await library.remove(asId(id))
  })

  ipcMain.handle(CHANNEL.snipsAnalyze, (_event, id: unknown) => {
    if (!analyst.isConfigured()) throw new Error('Choose a model in Settings first.')
    analyst.enqueue(asId(id))
  })

  ipcMain.handle(CHANNEL.snipsCopy, async (_event, id: unknown, kind: unknown) => {
    const record = library.get(asId(id))
    if (!record) throw new Error('That snip no longer exists.')
    if ((kind as CopyKind) === 'image') {
      const png = await readFile(library.imagePath(record.id))
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
    } else {
      // Never replace what is on the clipboard with nothing.
      if (!record.prompt) throw new Error('This snip has no prompt yet.')
      await clipboard.writeText(record.prompt)
    }
  })

  ipcMain.handle(CHANNEL.snipsReveal, (_event, id: unknown) => {
    shell.showItemInFolder(library.imagePath(asId(id)))
  })

  ipcMain.handle(CHANNEL.settingsGet, () => settings.view())

  ipcMain.handle(CHANNEL.settingsSave, async (_event, patch: unknown) => {
    const before = settings.view()
    const view = await settings.save(cleanSettings(patch))
    if (view.doubleTap !== before.doubleTap || view.doubleTapKey !== before.doubleTapKey || view.shortcut !== before.shortcut) {
      context.applyHotkeys(view)
    }
    // A newly usable model picks up everything saved while there was none.
    analyst.enqueueWaiting()
    return view
  })

  ipcMain.handle(CHANNEL.settingsSetKey, async (_event, provider: unknown, key: unknown) => {
    const view = await settings.setKey(asProvider(provider), typeof key === 'string' ? key : '')
    analyst.enqueueWaiting()
    return view
  })

  ipcMain.handle(CHANNEL.settingsModels, (_event, provider: unknown) => {
    const id = asProvider(provider)
    // The address comes from saved settings, never from the page asking.
    return PROVIDER_BY_ID[id].listModels({ apiKey: settings.key(id), baseUrl: settings.address(id) })
  })

  ipcMain.handle(CHANNEL.settingsPermissions, (): Permissions => {
    return {
      screen: screenAccessGranted(),
      accessibility: !isMac || systemPreferences.isTrustedAccessibilityClient(false),
      doubleTapAvailable: hotkeys.doubleTapAvailable,
      doubleTapActive: hotkeys.doubleTapActive,
      shortcutActive: isTest || hotkeys.shortcutActive
    }
  })

  ipcMain.handle(CHANNEL.settingsAskPermission, async (_event, kind: unknown) => {
    if (!isMac || isTest) return
    if (kind === 'screen') {
      // macOS only lists the app under Screen Recording after a real attempt.
      // The grab itself is not wanted, so it is deleted straight away.
      const shot = await shootDisplay(activeDisplay()).catch(() => null)
      if (shot) await releaseShot(shot)
      await shell.openExternal(SETTINGS_PANE.screen)
    } else if (kind === 'accessibility') {
      systemPreferences.isTrustedAccessibilityClient(true)
      await shell.openExternal(SETTINGS_PANE.accessibility)
    }
  })

  ipcMain.handle(CHANNEL.captureStart, () => context.snipFromLibrary())
  ipcMain.on(CHANNEL.captureReady, () => capture.reveal())
  ipcMain.handle(CHANNEL.captureSave, async (_event, rect: unknown, note: unknown) => {
    return context.toSnip(await capture.save(asRect(rect), typeof note === 'string' ? note : ''))
  })
  ipcMain.on(CHANNEL.captureFinish, () => void capture.finish())
  ipcMain.on(CHANNEL.captureCancel, () => void capture.cancel())

  ipcMain.on(CHANNEL.toastOpen, (_event, id: unknown) => {
    toast.dismiss()
    if (typeof id === 'string') context.openSnip(id)
  })
  ipcMain.on(CHANNEL.toastDismiss, () => toast.dismiss())
}

function asId(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{1,64}$/.test(value)) throw new Error('Invalid snip id.')
  return value
}

function asProvider(value: unknown): ProviderId {
  if (!PROVIDER_IDS.includes(value as ProviderId)) throw new Error('Unknown provider.')
  return value as ProviderId
}

function asRect(value: unknown): Rect {
  const rect = value as Partial<Rect> | null
  const numbers = [rect?.x, rect?.y, rect?.width, rect?.height]
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) throw new Error('Invalid selection.')
  if (rect!.width! < 1 || rect!.height! < 1) throw new Error('The selection is empty.')
  return { x: rect!.x!, y: rect!.y!, width: rect!.width!, height: rect!.height! }
}

function cleanPatch(value: unknown): SnipPatch {
  const input = (value ?? {}) as Record<string, unknown>
  const patch: SnipPatch = {}
  if (typeof input.note === 'string') patch.note = input.note
  if (typeof input.title === 'string') patch.title = input.title.trim()
  if (typeof input.prompt === 'string') patch.prompt = input.prompt
  if (isPocketId(input.pocket)) patch.pocket = input.pocket
  if (Array.isArray(input.tags)) {
    patch.tags = input.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
  }
  return patch
}

function cleanSettings(value: unknown): SettingsPatch {
  const input = (value ?? {}) as Record<string, unknown>
  const patch: SettingsPatch = {}
  if (input.provider === null) patch.provider = null
  else if (PROVIDER_IDS.includes(input.provider as ProviderId)) patch.provider = input.provider as ProviderId
  if (typeof input.model === 'string') patch.model = input.model.trim()
  if (typeof input.baseUrl === 'string') patch.baseUrl = input.baseUrl.trim()
  if (typeof input.doubleTap === 'boolean') patch.doubleTap = input.doubleTap
  if (DOUBLE_TAP_KEYS.includes(input.doubleTapKey as DoubleTapKey)) patch.doubleTapKey = input.doubleTapKey as DoubleTapKey
  if (typeof input.shortcut === 'string') patch.shortcut = input.shortcut
  if (typeof input.welcomed === 'boolean') patch.welcomed = input.welcomed
  return patch
}
