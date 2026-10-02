/// <reference types="vite/client" />

/**
 * 环境变量声明（模板见 .env.example，接入步骤见 docs/tableau-setup.md）。
 *
 * ⚠️ 这些值在**构建时**被 Vite 内联进 JS bundle，因此：
 *  - 只能放"可以公开"的东西（站点地址、站点名、嵌入用户都属此列）；
 *  - 凭据类见下方说明 —— 纯前端无法真正保密。
 * ⚠️ 代码里**必须逐项静态书写** `import.meta.env.VITE_X`，动态取值拿不到（Vite 只内联静态引用）。
 * 全部为可选：留空即用内置演示值。
 */
interface ImportMetaEnv {
  /* ---------- 站点绑定（换成自己的站点改这里，不用改代码） ---------- */

  /** 站点地址，如 https://eu-west-1a.online.tableau.com */
  readonly VITE_TABLEAU_SERVER_URL?: string
  /** 站点显示名（Tableau 后台的 Site name） */
  readonly VITE_TABLEAU_SITE_NAME?: string
  /** 站点内容 URL（URL 里 /t/<这一段>/ 的值） */
  readonly VITE_TABLEAU_SITE_CONTENT_URL?: string
  /** 签发 JWT 时使用的嵌入用户名（Connected App 里的 embed user） */
  readonly VITE_TABLEAU_EMBED_USER?: string
  /** 只显示某个项目（REST 侧 `filter=projectName:eq:`）；留空 = 不限制 */
  readonly VITE_TABLEAU_PROJECT?: string
  /** REST API 版本，如 3.23（Tableau 每年发版数次） */
  readonly VITE_TABLEAU_API_VERSION?: string
  /** REST 走同源代理的路径前缀，默认 /tableau-proxy（dev 由 vite.config.ts 代理） */
  readonly VITE_TABLEAU_API_BASE?: string

  /* ---------- Connected App 凭据（纯前端会被内联，详见 docs/tableau-setup.md） ---------- */

  readonly VITE_TABLEAU_CLIENT_ID?: string
  readonly VITE_TABLEAU_SECRET_ID?: string
  readonly VITE_TABLEAU_SECRET_VALUE?: string

  /* ---------- AI 能力（可选；留空 = 内置演示 provider） ---------- */

  /**
   * 同源代理地址（如 `/ai-proxy`），它必须实现 OpenAI 兼容的 `POST /chat/completions`（SSE 流式）。
   * **留空即演示模式**（本地流式输出，不发外部请求）。
   * ⚠️ 厂商 API Key 放代理（服务端），不要放这里 —— 本文件的值构建时会内联进 bundle。
   */
  readonly VITE_AI_PROXY_URL?: string
  /** 模型名，透传给上游（DeepSeek 默认 `deepseek-chat`） */
  readonly VITE_AI_MODEL?: string
  /** 可选：系统提示词 */
  readonly VITE_AI_SYSTEM_PROMPT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
