import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '^/pdf-images/uploads/': {
        target: 'https://assets.leetcode.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pdf-images/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (response) => {
            response.headers['content-security-policy'] = "sandbox; default-src 'none'"
            response.headers['x-content-type-options'] = 'nosniff'
          })
        },
      },
    },
  },
})
