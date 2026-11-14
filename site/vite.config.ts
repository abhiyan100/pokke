import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The landing page. It shares the app's design system (tokens, stitches,
 * patterns) and sample images straight from the app's source, so the two
 * cannot drift apart.
 */
const root = import.meta.dirname
const repo = resolve(root, '..')

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@shared': resolve(repo, 'src/shared'),
      '@app': resolve(repo, 'src/renderer/src'),
      '@samples': resolve(repo, 'src/renderer/public/samples')
    }
  },
  plugins: [react()],
  server: { port: 5300, strictPort: true, fs: { allow: [repo] } },
  preview: { port: 5300, strictPort: true },
  build: { outDir: resolve(root, 'dist'), emptyOutDir: true }
})
