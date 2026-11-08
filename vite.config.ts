import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built game can be hosted from any path
// (and later loaded into the 3D handheld as a texture source).
export default defineConfig({
  plugins: [react()],
  base: './',
})
