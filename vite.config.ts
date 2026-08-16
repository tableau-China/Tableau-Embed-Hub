import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tanstackRouter(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Tableau Cloud REST API 不支持 CORS（实测：无 ACAO 头、OPTIONS 预检 405），
      // 开发环境通过本代理同源转发；生产部署请在网关/nginx 配置相同路径反代。
      '/tableau-proxy': {
        target: 'https://10ax.online.tableau.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tableau-proxy/, ''),
      },
    },
  },
})
