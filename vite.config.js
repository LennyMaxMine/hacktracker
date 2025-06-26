import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        add: resolve(__dirname, 'add.html'),
        admin: resolve(__dirname, 'admin.html'),
        signin: resolve(__dirname, 'signin.html'),
        'my-events': resolve(__dirname, 'my-events.html')
      }
    }
  }
}) 