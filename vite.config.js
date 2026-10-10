import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'

const htmlPages = Object.fromEntries(
  readdirSync(__dirname)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(__dirname, f)])
)

export default defineConfig({
  appType: 'mpa',
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        xfwd: true
      }
    }
  },
  plugins: [
    {
      name: 'html-no-ext',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url || req.url.startsWith('/api') || req.url.startsWith('/@') || req.url.startsWith('/src') || req.url.startsWith('/node_modules')) {
            next()
            return
          }
          const [path, query] = req.url.split('?')
          if (path !== '/' && !path.includes('.') && !path.endsWith('/')) {
            req.url = path + '.html' + (query ? '?' + query : '')
          }
          next()
        })
      }
    }
  ],
  build: {
    rollupOptions: {
      input: htmlPages
    }
  }
})
