import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, app, ipcMain, nativeImage, net, protocol, safeStorage, type Tray } from 'electron'
import { CHANNEL } from '@shared/api'
import type { NavTarget, SettingsView, Snip, SnipRecord } from '@shared/types'
import { Analyst } from './ai/analyst'
import { CaptureSession } from './capture'
import { isMac, isTest, resourcePath, testHotkey } from './env'
import { Hotkeys } from './hotkey'
import { registerIpc } from './ipc'
import { imageForModel, sweepAbandonedShots } from './screen'
import { Library } from './store/library'
import { SettingsStore, type Cipher } from './store/settings'
import { Toast } from './toast'
import { createTray } from './tray'
import { createLibraryWindow, present } from './windows'

const SCHEME = 'xtractor'
/** Long enough for the library window to finish disappearing before the screen is frozen. */
const LIBRARY_HIDE_MS = 260

// Must run before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

if (isTest) {
  if (process.env.XTRACTOR_DATA_DIR) app.setPath('userData', process.env.XTRACTOR_DATA_DIR)
  app.dock?.hide()
}

/** API keys are encrypted with the OS keychain; test mode must not touch it. */
const cipher: Cipher = isTest
  ? { encrypt: (plain) => plain, decrypt: (stored) => stored }
  : {
      encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
      decrypt: (stored) => safeStorage.decryptString(Buffer.from(stored, 'base64'))
    }

function toSnip(record: SnipRecord): Snip {
  return {
    ...record,
    imageUrl: `${SCHEME}://snip/${record.id}/image`,
    thumbUrl: `${SCHEME}://snip/${record.id}/thumb`
  }
}

async function main(): Promise<void> {
  // Windows groups taskbar windows and notifications by this id.
  if (process.platform === 'win32') app.setAppUserModelId('com.xtractor.app')
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  await app.whenReady()

  const dataDir = app.getPath('userData')
  const library = new Library(join(dataDir, 'library'))
  const settings = new SettingsStore(join(dataDir, 'settings.json'), cipher)
  await Promise.all([library.open(), settings.open()])

  const analyst = new Analyst(library, settings, async (id) =>
    imageForModel(nativeImage.createFromPath(library.imagePath(id)))
  )
  const toast = new Toast(library, toSnip)

  let libraryWindow: BrowserWindow | null = null
  // A target asked for before the library page is listening waits here.
  let pendingTarget: NavTarget | null = null
  let libraryListening = false

  const deliver = (target: NavTarget | undefined): void => {
    if (!target) return
    if (libraryListening && libraryWindow && !libraryWindow.isDestroyed()) {
      libraryWindow.webContents.send(CHANNEL.navOpen, target)
    } else {
      pendingTarget = target
    }
  }

  ipcMain.on(CHANNEL.navReady, (event) => {
    if (!libraryWindow || event.sender !== libraryWindow.webContents) return
    libraryListening = true
    const target = pendingTarget
    pendingTarget = null
    deliver(target ?? undefined)
  })

  const openLibrary = (target?: NavTarget): void => {
    if (!libraryWindow || libraryWindow.isDestroyed()) {
      const win = createLibraryWindow()
      libraryWindow = win
      libraryListening = false
      pendingTarget = target ?? null
      win.once('ready-to-show', () => {
        present(win)
        if (!isTest) void app.dock?.show()
      })
      win.on('closed', () => {
        libraryWindow = null
        libraryListening = false
        // With no window open the app lives in the menu bar only.
        app.dock?.hide()
      })
      return
    }
    if (libraryWindow.isMinimized()) libraryWindow.restore()
    present(libraryWindow)
    deliver(target)
  }

  // Snipping from the library's own button: the window steps aside so it is not in the picture.
  let libraryHiddenForSnip = false
  const snipFromLibrary = async (): Promise<void> => {
    if (!isTest && libraryWindow?.isVisible()) {
      libraryHiddenForSnip = true
      libraryWindow.hide()
      await new Promise((resolve) => setTimeout(resolve, LIBRARY_HIDE_MS))
    }
    await capture.begin()
  }

  const capture = new CaptureSession(library, analyst, {
    onSaved: (id, display) => toast.show(id, display),
    onBlocked: () => {
      libraryHiddenForSnip = false
      openLibrary({ view: 'settings' })
    },
    onClosed: () => {
      if (!libraryHiddenForSnip) return
      libraryHiddenForSnip = false
      if (libraryWindow && !libraryWindow.isDestroyed()) present(libraryWindow)
    }
  })
  const hotkeys = new Hotkeys(() => void capture.begin())

  const applyHotkeys = (view: SettingsView): void => {
    if (isTest) {
      if (testHotkey) hotkeys.setDoubleTap(view.doubleTap, view.doubleTapKey)
      return
    }
    hotkeys.setShortcut(view.shortcut)
    hotkeys.setDoubleTap(view.doubleTap, view.doubleTapKey)
  }

  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host === 'frame') return capture.frameResponse()
    if (url.host === 'snip') {
      const [, id, kind] = url.pathname.split('/')
      if (id && library.get(id)) {
        const file = kind === 'thumb' ? library.thumbPath(id) : library.imagePath(id)
        return net.fetch(pathToFileURL(file).toString())
      }
    }
    return new Response(null, { status: 404 })
  })

  library.on('changed', () => {
    const snips = library.list().map(toSnip)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(CHANNEL.snipsChanged, snips)
    }
  })

  registerIpc({
    library,
    settings,
    analyst,
    capture,
    toast,
    hotkeys,
    toSnip,
    applyHotkeys,
    snipFromLibrary,
    openSnip: (id) => openLibrary({ view: 'snip', id })
  })

  void sweepAbandonedShots()
  capture.prepare()
  toast.prepare()
  applyHotkeys(settings.view())
  analyst.enqueueWaiting()

  let tray: Tray | null = null
  if (!isTest) {
    if (isMac) app.dock?.setIcon(nativeImage.createFromPath(resourcePath('icon.png')))
    tray = createTray(
      {
        snip: () => void capture.begin(),
        openLibrary: () => openLibrary(),
        openSettings: () => openLibrary({ view: 'settings' })
      },
      settings.view().shortcut
    )
  }

  openLibrary()

  app.on('second-instance', () => openLibrary())
  app.on('activate', () => openLibrary())
  // Closing the library leaves the app running in the menu bar.
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', () => {
    capture.dispose()
    hotkeys.dispose()
    tray?.destroy()
  })
}

void main().catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})
