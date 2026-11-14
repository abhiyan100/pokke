import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the renderer pages in a plain browser. With no Electron bridge present
 * the pages fall back to the mock bridge, which is how the UI is tested
 * headlessly without opening an app window.
 */
const root = import.meta.dirname

export default defineConfig({
  root: resolve(root, 'src/renderer'),
  resolve: { alias: { '@shared': resolve(root, 'src/shared') } },
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true }
})
