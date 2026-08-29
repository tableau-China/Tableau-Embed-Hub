/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Tableau Cloud Connected App 凭据（可选覆盖；缺省时使用内置混淆开发凭据）。
   * 来自 .env（已被 .gitignore 排除），模板见 .env.example。
   */
  readonly VITE_TABLEAU_CLIENT_ID: string
  readonly VITE_TABLEAU_SECRET_ID: string
  readonly VITE_TABLEAU_SECRET_VALUE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
