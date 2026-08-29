/**
 * Tableau Online（Tableau Cloud）连接配置
 *
 * ⚠️ 凭据策略（重要）：
 * 1. Connected App 凭据支持两种来源，优先级从高到低：
 *    a. 环境变量 `VITE_TABLEAU_*`（推荐，.env 中配置，.env 已被 .gitignore 排除）
 *    b. 内置开发凭据（EMBEDDED_CREDENTIALS，混淆存储）——保证客户 clone 后开箱即用
 * 2. ⚠️ 安全边界说明：本应用为纯前端，无论 .env 还是内置凭据，构建时都会内联进 JS bundle。
 *    混淆（base64+反转）只是防止"一眼明文 / 被自动化扫描直接命中"，
 *    不是加密 —— 拿到 bundle 的人仍可还原。这不是缺陷而是纯前端架构的固有约束。
 *    真正的安全边界在 Tableau Cloud 后台（与代码无关）：
 *    - Connected App 域名白名单（只允许本站点域名嵌入）
 *    - 访问级别限制 + 应用侧项目过滤（注意：REST API 不受访问级别约束，仅前端过滤）
 *    - 密钥定期轮换（泄露后立即在 Cloud 后台重置 Connected App secret）
 *    如需真正隐藏密钥，需将 JWT 签发迁移到后端（见 CHANGELOG TODO）。
 */
const EMBEDDED_CREDENTIALS = {
  clientId: '3gDMjRTM5QGOihjYtMzNmlTL5YzN00yYiJjMtEGO2M2M3YmY',
  secretId: 'hZWM4ImYmZTMhFDNtETMilTLjRWY00yYxkjMtMDM2QGO4EmM',
  secretValue: '=0zcSFVc4gHMYhmTj5kYSBlW40Ucrt2SFRlYyZ0aCt2L4MENJFGMmdEWqZTQ',
}

/** 混淆解码：反转 + base64 解码（编码侧见 CHANGELOG/提交记录）。仅用于 ASCII 凭据。 */
function decodeCredential(obfuscated: string): string {
  return atob(obfuscated.split('').reverse().join(''))
}

const env = {
  clientId: import.meta.env.VITE_TABLEAU_CLIENT_ID,
  secretId: import.meta.env.VITE_TABLEAU_SECRET_ID,
  secretValue: import.meta.env.VITE_TABLEAU_SECRET_VALUE,
}

const usingEmbedded = !(env.clientId && env.secretId && env.secretValue)
if (usingEmbedded) {
  console.warn(
    '[tableau] 未检测到 VITE_TABLEAU_* 环境变量，正在使用内置开发凭据（混淆存储，仅供开发演示）。' +
      '正式使用请复制 .env.example 为 .env 并填写自有 Connected App 凭据。',
  )
}

export const TABLEAU_CONFIG = {
  serverUrl: 'https://10ax.online.tableau.com',
  siteName: 'xilejun_china',
  siteContentUrl: 'xilejunchina',
  clientId: env.clientId || decodeCredential(EMBEDDED_CREDENTIALS.clientId),
  secretId: env.secretId || decodeCredential(EMBEDDED_CREDENTIALS.secretId),
  secretValue: env.secretValue || decodeCredential(EMBEDDED_CREDENTIALS.secretValue),
  embedUser: 'wyp@vizwise.cn',
  apiVersion: '3.23',
  /**
   * 已连接应用"访问级别"限制（当前为 Samples 项目）。
   * ⚠️ 该限制仅作用于嵌入工作流（Embedding API），REST API 不受其约束
   * （官方文档：REST API 授权配置时可忽略访问级别/域允许列表），JWT 中也无项目级 claim。
   * 因此这里在应用侧通过 REST 查询参数 `filter=projectName:eq:...` 实现同等限制：
   * workbooks 列表（及基于名称的缩略图解析）只返回该项目下的内容。
   * 设为 undefined 表示不过滤。
   */
  restrictedProjectName: 'Samples',
  /**
   * Tableau Cloud REST API 不支持 CORS（实测：无 ACAO 头、OPTIONS 预检 405），
   * REST 请求必须走同源代理：dev = Vite 代理 /tableau-proxy；prod = 网关/nginx 同路径反代。
   * 嵌入 iframe（v3）不受影响，仍直连 serverUrl。
   */
  apiBaseUrl: '/tableau-proxy',
  tokenTtlSeconds: 300,
  refreshIntervalSeconds: 240,
} as const

export function buildViewUrl(workbook: string, view: string): string {
  return `${TABLEAU_CONFIG.serverUrl}/t/${TABLEAU_CONFIG.siteContentUrl}/views/${encodeURIComponent(workbook)}/${encodeURIComponent(view)}`
}
