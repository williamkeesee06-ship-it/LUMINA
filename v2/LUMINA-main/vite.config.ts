import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/smartsheet': {
        target: 'https://api.smartsheet.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/smartsheet/, '')
      },
      // Proxy Nominatim geocoding to bypass CORS restrictions in dev
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
        headers: {
          // Nominatim requires a User-Agent header per its usage policy
          'User-Agent': 'LUMINA-ConstructionDashboard/1.0 (billykeesee@example.com)'
        }
      }
    }
  }
})
