/**
 * Tableau Online（Tableau Cloud）连接配置
 * ⚠️ 测试环境专用：凭据明文嵌入代码（用户明确要求）。生产环境请改为后端/环境变量注入。
 */
export const TABLEAU_CONFIG = {
  serverUrl: 'https://10ax.online.tableau.com',
  siteName: 'xilejun_china',
  siteContentUrl: 'xilejunchina',
  clientId: 'bf73c68a-22bc-4769-9f73-b8b8d914c087',
  secretId: '2a88d603-291c-4adc-9b11-41a16fbb81fa',
  secretValue: 'A6jXGf0aI4C8/kBkFrbTEKkkqM8ZPRbNcNhX0x8qQRs=',
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
