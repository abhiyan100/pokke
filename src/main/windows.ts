import { BrowserWindow, shell, type BrowserWindowConstructorOptions, type Display, type Rectangle } from 'electron'
import { TOAST } from '@shared/toastLayout'
import { devServerUrl, isMac, isTest, preloadPath, rendererFile } from './env'

/** Deepest indigo of the palette; painted before the page loads so nothing flashes white. */
const GROUND = '#181B39'

const TOAST_SIZE = { width: TOAST.width, height: TOAST.height }
/** The toast window pads its own content, so it sits flush with the corner. */
const TOAST_MARGIN = 4

const webPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
  preload: preloadPath,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  // Hidden windows must keep painting so the overlay is ready the moment it is shown.
  backgroundThrottling: false
}

function create(page: 'library' | 'overlay' | 'toast', options: BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({ show: false, ...options, webPreferences })

  // The pages never open or navigate to anything else; links go to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  if (devServerUrl) void win.loadURL(`${devServerUrl}/${page}.html`)
  else void win.loadFile(rendererFile(page))
  return win
}

/** Shows a window, except in test mode where nothing may reach the screen. */
export function present(win: BrowserWindow, { focus = true } = {}): void {
  if (isTest) return
  if (focus) {
    win.show()
    win.focus()
  } else {
    win.showInactive()
  }
}

export function createLibraryWindow(): BrowserWindow {
  return create('library', {
    width: 1220,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    title: 'Pokke',
    backgroundColor: GROUND,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 22 } }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: GROUND, symbolColor: '#FBFAF5', height: 52 }
        })
  })
}

/**
 * The capture overlay: a borderless window that covers one whole display,
 * menu bar and Dock included, without creating a new Space.
 */
export function createOverlayWindow(): BrowserWindow {
  const win = create('overlay', {
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    roundedCorners: false,
    backgroundColor: GROUND,
    // macOS only lets a frameless window sit over the menu bar with this set.
    enableLargerThanScreen: true,
    type: isMac ? 'panel' : 'toolbar'
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  if (isMac) {
    // skipTransformProcessType stops the Dock icon flickering on every call.
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  }
  return win
}

/** The corner thumbnail shown after a snip is saved. Never takes focus. */
export function createToastWindow(): BrowserWindow {
  const win = create('toast', {
    ...TOAST_SIZE,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    type: isMac ? 'panel' : 'toolbar'
  })
  win.setAlwaysOnTop(true, 'floating')
  if (isMac) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  }
  return win
}

/** Where the toast sits: the bottom-right corner of a display's usable area. */
export function toastBounds(display: Display): Rectangle {
  const area = display.workArea
  return {
    x: area.x + area.width - TOAST_SIZE.width - TOAST_MARGIN,
    y: area.y + area.height - TOAST_SIZE.height - TOAST_MARGIN,
    ...TOAST_SIZE
  }
}
