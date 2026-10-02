import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/** 与 src/config/tableau.ts 的缺省值保持一致（演示站点） */
const DEFAULT_SERVER_URL = 'https://10ax.online.tableau.com'
const DEFAULT_API_BASE = '/tableau-proxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 从 .env 读取与运行时**同一份**配置：这样换站点只改 .env，不必回来改这个文件
  // （历史上这里硬编码过 serverUrl，是 src/config/tableau.ts 的第二份拷贝，改一处忘一处就会代理到旧站点）
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const serverUrl = env.VITE_TABLEAU_SERVER_URL?.trim() || DEFAULT_SERVER_URL
  const apiBase = env.VITE_TABLEAU_API_BASE?.trim() || DEFAULT_API_BASE

  return {
    plugins: [
      // autoCodeSplitting：路由级代码分割（**路由文件不用改**）——
      // 插件把每个路由的 component 拆成独立 chunk，首屏只加载当前路由需要的代码。
      // 实测：入口 chunk 从 1.14MB 降到 ~0.5MB（详见 CHANGELOG）。
      tanstackRouter({ autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      // 固定端口 5174：同机常跑多个 Vite 项目，5173 已被占用时默认会静默换端口，
      // 结果"以为在 5173、其实在 5175"。显式固定在 5174 并只监听 IPv4 环回
      // （默认只监听 localhost 的 IPv6 ::1 时，127.0.0.1 直连会不通）。
      host: '127.0.0.1',
      port: 5174,
      proxy: {
        // Tableau Cloud REST API 不支持 CORS（实测：无 ACAO 头、OPTIONS 预检 405），
        // 开发环境通过本代理同源转发；生产部署请在网关/nginx 配置**相同路径**的反代
        // （样例见 deploy/nginx.conf.example）。
        [apiBase]: {
          target: serverUrl,
          changeOrigin: true,
          // 去掉路径前缀后转发给 Tableau（字符串 replace 只替换首次出现，正好是前缀）
          rewrite: (p) => p.replace(apiBase, ''),
        },
      },
    },
  }
})
