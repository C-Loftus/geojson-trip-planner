import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under any GitHub Pages subpath
  // (e.g. https://<user>.github.io/geojson-trip-planner/). The app state lives in the
  // URL hash, so there are no client-side routes to worry about.
  base: './',
})
