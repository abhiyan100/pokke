import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const root = import.meta.dirname
const alias = { '@shared': resolve(root, 'src/shared') }

/**
 * Locks the packaged pages down to their own files plus the app's image
 * protocol. Applied to builds only: the dev server needs inline scripts for HMR.
 */
const contentSecurityPolicy = (): Plugin => ({
  name: 'xtractor-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<!--csp-->',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' xtractor: data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'" />`
    )
})

export default defineConfig({
  main: {
    resolve: { alias },
    // The native key hook is an optional dependency; keep it out of the bundle
    // so its prebuilt binary is loaded from node_modules.
    build: { externalizeDeps: { include: ['uiohook-napi'] } }
  },
  preload: {
    resolve: { alias },
    build: {
      // Sandboxed preload scripts must be a single CommonJS file.
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    resolve: { alias },
    plugins: [react(), contentSecurityPolicy()],
    build: {
      rollupOptions: {
        input: {
          library: resolve(root, 'src/renderer/library.html'),
          overlay: resolve(root, 'src/renderer/overlay.html'),
          toast: resolve(root, 'src/renderer/toast.html')
        }
      }
    }
  }
})
