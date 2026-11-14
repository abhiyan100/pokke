import { Menu, Tray, app, nativeImage } from 'electron'
import { isMac, resourcePath } from './env'

interface TrayActions {
  snip(): void
  openLibrary(): void
  openSettings(): void
}

/** The menu-bar / system-tray icon: the app's home when no window is open. */
export function createTray(actions: TrayActions, shortcut: string): Tray {
  const icon = nativeImage.createFromPath(resourcePath(isMac ? 'trayTemplate.png' : 'tray.png'))
  if (isMac) icon.setTemplateImage(true)

  const tray = new Tray(icon)
  tray.setToolTip('Xtractor')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Snip', accelerator: shortcut || undefined, click: actions.snip },
      { label: 'Open library', click: actions.openLibrary },
      { type: 'separator' },
      { label: 'Settings…', click: actions.openSettings },
      { type: 'separator' },
      { label: 'Quit Xtractor', click: () => app.quit() }
    ])
  )
  // On Windows and Linux a left click is expected to open the app; macOS shows the menu.
  if (!isMac) tray.on('click', actions.openLibrary)
  return tray
}
