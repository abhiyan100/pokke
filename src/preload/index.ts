import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNEL, type XtractorApi } from '@shared/api'
import type { Platform } from '@shared/types'

/** Subscribes to a channel and returns the function that unsubscribes. */
function listen<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: XtractorApi = {
  platform: process.platform as Platform,

  snips: {
    list: () => ipcRenderer.invoke(CHANNEL.snipsList),
    update: (id, patch) => ipcRenderer.invoke(CHANNEL.snipsUpdate, id, patch),
    remove: (id) => ipcRenderer.invoke(CHANNEL.snipsRemove, id),
    analyze: (id) => ipcRenderer.invoke(CHANNEL.snipsAnalyze, id),
    copy: (id, kind) => ipcRenderer.invoke(CHANNEL.snipsCopy, id, kind),
    reveal: (id) => ipcRenderer.invoke(CHANNEL.snipsReveal, id),
    onChange: (listener) => listen(CHANNEL.snipsChanged, listener)
  },

  settings: {
    get: () => ipcRenderer.invoke(CHANNEL.settingsGet),
    save: (patch) => ipcRenderer.invoke(CHANNEL.settingsSave, patch),
    setKey: (provider, key) => ipcRenderer.invoke(CHANNEL.settingsSetKey, provider, key),
    models: (provider) => ipcRenderer.invoke(CHANNEL.settingsModels, provider),
    permissions: () => ipcRenderer.invoke(CHANNEL.settingsPermissions),
    askPermission: (kind) => ipcRenderer.invoke(CHANNEL.settingsAskPermission, kind)
  },

  capture: {
    start: () => ipcRenderer.invoke(CHANNEL.captureStart),
    onFrame: (listener) => listen(CHANNEL.captureFrame, listener),
    ready: () => ipcRenderer.send(CHANNEL.captureReady),
    save: (rect, note) => ipcRenderer.invoke(CHANNEL.captureSave, rect, note),
    finish: () => ipcRenderer.send(CHANNEL.captureFinish),
    cancel: () => ipcRenderer.send(CHANNEL.captureCancel)
  },

  toast: {
    onSnip: (listener) => listen(CHANNEL.toastSnip, listener),
    open: (id) => ipcRenderer.send(CHANNEL.toastOpen, id),
    dismiss: () => ipcRenderer.send(CHANNEL.toastDismiss)
  },

  nav: {
    onOpen: (listener) => {
      const unsubscribe = listen(CHANNEL.navOpen, listener)
      // Tells the app the page can now receive targets, so none sent earlier is lost.
      ipcRenderer.send(CHANNEL.navReady)
      return unsubscribe
    }
  }
}

contextBridge.exposeInMainWorld('xtractor', api)
