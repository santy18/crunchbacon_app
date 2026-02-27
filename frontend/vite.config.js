import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws/stream': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/export-project': 'http://localhost:8000',
      '/export-edited-video': 'http://localhost:8000',
      '/generate-voiceover': 'http://localhost:8000',
      '/generate': 'http://localhost:8000',
      '/voices': 'http://localhost:8000',
      '/projects': 'http://localhost:8000',
      '/scripts': 'http://localhost:8000',
      '/transcriptions': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/generations': 'http://localhost:8000',
    },
  },
})
