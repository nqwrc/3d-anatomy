import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  plugins: [glsl()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 0
  },
  server: {
    port: 3000,
    open: true
  }
})