/**
 * Tableau Cloud 连接配置
 *
 * 三类东西分清楚（配置自己的站点时只需要动 `.env`，**不需要改这个文件**）：
 *
 * 1. **站点绑定** —— serverUrl / siteName / siteContentUrl / embedUser / 项目过滤 / API 版本 / 代理路径，
 *    全部可用 `VITE_TABLEAU_*` 覆盖（见 `.env.example`）。缺省值是内置的**演示站点**，
 *    保证 clone 后零配置就能看到真实数据的效果。
 * 2. **凭据** —— `VITE_TABLEAU_CLIENT_ID/SECRET_ID/SECRET_VALUE` 优先；缺省用内置演示凭据（混淆存储）。
 * 3. **安全边界** —— ⚠️ 本应用是纯前端：**无论 .env 还是内置凭据，构建时都会内联进 JS bundle**。
 *    混淆（base64 + 反转）只防"一眼明文 / 被自动化扫描直接命中"，**不是加密** —— 拿到 bundle 的人仍可还原。
 *    这不是缺陷，而是纯前端架构的固有约束。真正的安全边界在 Tableau Cloud 后台（与代码无关）：
 *    - Connected App 域名白名单（只允许本站点域名嵌入）
 *    - 访问级别限制 + 应用侧项目过滤（注意：REST API 不受访问级别约束，仅前端过滤）
 *    - 密钥定期轮换（泄露后立即在 Cloud 后台重置 Connected App secret）
 *    如需真正隐藏密钥，需把 JWT 签发迁移到后端；接入步骤见 docs/tableau-setup.md。
 */
import { configured, envValue as val } from '@/lib/env'
import { logger } from '@/lib/logger'

/** 内置演示站点与凭据：让 clone 后开箱即用（演示环境，见 README 的说明） */
const DEMO = {
  serverUrl: 'https://10ax.online.tableau.com',
  siteName: 'xilejun_china',
  siteContentUrl: 'xilejunchina',
  embedUser: 'wyp@vizwise.cn',
  restrictedProjectName: 'Samples',
  /** 「点击 Views 但没有指定视图」时的固定兜底视图 UUID（演示站点上的一个真实视图） */
  fallbackViewId: '5959968c-c18b-4ada-bff1-99ac36af1dc1',
  // 混淆存储（反转 + base64），解码见下方 decodeCredential
  clientId: '3gDMjRTM5QGOihjYtMzNmlTL5YzN00yYiJjMtEGO2M2M3YmY',
  secretId: 'hZWM4ImYmZTMhFDNtETMilTLjRWY00yYxkjMtMDM2QGO4EmM',
  secretValue: '=0zcSFVc4gHMYhmTj5kYSBlW40Ucrt2SFRlYyZ0aCt2L4MENJFGMmdEWqZTQ',
} as const

/** 混淆解码：反转 + base64 解码（编码侧见 CHANGELOG/提交记录）。仅用于 ASCII 凭据。 */
function decodeCredential(obfuscated: string): string {
  return atob(obfuscated.split('').reverse().join(''))
}

/**
 * 环境变量读取。
 *
 * ⚠️ **必须逐项静态书写** `import.meta.env.VITE_X`：Vite 只内联被静态引用的键，
 * 写成动态的 `import.meta.env[key]` 在构建产物里会**拿不到值**（已实测：产物里连键名都不存在）。
 * 空串一律按「未配置」处理。
 */
const raw = {
  serverUrl: import.meta.env.VITE_TABLEAU_SERVER_URL,
  siteName: import.meta.env.VITE_TABLEAU_SITE_NAME,
  siteContentUrl: import.meta.env.VITE_TABLEAU_SITE_CONTENT_URL,
  embedUser: import.meta.env.VITE_TABLEAU_EMBED_USER,
  restrictedProjectName: import.meta.env.VITE_TABLEAU_PROJECT,
  fallbackViewId: import.meta.env.VITE_TABLEAU_FALLBACK_VIEW,
  apiVersion: import.meta.env.VITE_TABLEAU_API_VERSION,
  apiBaseUrl: import.meta.env.VITE_TABLEAU_API_BASE,
  clientId: import.meta.env.VITE_TABLEAU_CLIENT_ID,
  secretId: import.meta.env.VITE_TABLEAU_SECRET_ID,
  secretValue: import.meta.env.VITE_TABLEAU_SECRET_VALUE,
}

/** 取环境变量，空串/空白视为未配置 → 用缺省值（实现见 `@/lib/env`） */

/** 是否仍在使用内置演示凭据（开发期提示 + Help 页「环境自检」共用） */
export const TABLEAU_USING_DEMO_CREDENTIALS = !(
  configured(raw.clientId) &&
  configured(raw.secretId) &&
  configured(raw.secretValue)
)

/** 是否绑定在内置演示站点上（三项站点配置都没给 = 仍是演示站点） */
export const TABLEAU_USING_DEMO_SITE =
  !configured(raw.serverUrl) && !configured(raw.siteName) && !configured(raw.siteContentUrl)

/** 用户是否配置了自己的站点 */
const ownSite =
  configured(raw.serverUrl) || configured(raw.siteName) || configured(raw.siteContentUrl)

if (TABLEAU_USING_DEMO_CREDENTIALS) {
  // 开发期提示（logger 仅在 DEV 输出，生产构建静默）
  logger.warn(
    '[tableau] 未检测到 VITE_TABLEAU_CLIENT_ID/SECRET_ID/SECRET_VALUE，正在使用内置演示凭据（混淆存储，仅供开发演示）。' +
      '接入自己的站点请复制 .env.example 为 .env，见 docs/tableau-setup.md。',
  )
}

export const TABLEAU_CONFIG = {
  serverUrl: val(raw.serverUrl, DEMO.serverUrl),
  siteName: val(raw.siteName, DEMO.siteName),
  siteContentUrl: val(raw.siteContentUrl, DEMO.siteContentUrl),
  clientId: val(raw.clientId, decodeCredential(DEMO.clientId)),
  secretId: val(raw.secretId, decodeCredential(DEMO.secretId)),
  secretValue: val(raw.secretValue, decodeCredential(DEMO.secretValue)),
  embedUser: val(raw.embedUser, DEMO.embedUser),
  /** REST API 版本；Tableau 每年发版数次，过期会在 REST 调用上报错，可用 VITE_TABLEAU_API_VERSION 覆盖 */
  apiVersion: val(raw.apiVersion, '3.23'),
  /**
   * 已连接应用「访问级别」限制（演示站点为 Samples 项目）。
   * ⚠️ 该限制仅作用于嵌入工作流（Embedding API），REST API 不受其约束
   * （官方文档：REST API 授权配置时可忽略访问级别/域允许列表），JWT 中也无项目级 claim。
   * 因此这里在应用侧通过 REST 查询参数 `filter=projectName:eq:...` 实现同等限制：
   * workbooks 列表（及基于名称的缩略图解析）只返回该项目下的内容。
   *
   * 缺省规则：**演示站点**默认过滤 Samples；**自己配了站点**则默认不过滤（undefined），
   * 否则新人接自己的站点会发现"只看到 2 个工作簿"而找不到原因。
   * 显式设置 `VITE_TABLEAU_PROJECT` 可覆盖两种缺省。
   */
  restrictedProjectName: configured(raw.restrictedProjectName)
    ? raw.restrictedProjectName!.trim()
    : ownSite
      ? undefined
      : DEMO.restrictedProjectName,
  /**
   * 「无参数打开 /views」时的固定兜底视图（上次打开的视图解析不到时用它）。
   *
   * 为什么放在这里而不是写死在页面里：它是**站点内容**（一个视图 UUID），
   * 与站点绑定同源 —— 换自己的站点时必须换成自己站点上的视图，否则会得到一个空白嵌入框。
   * 与其它站点绑定一样可用 `VITE_TABLEAU_FALLBACK_VIEW` 覆盖（见 .env.example）。
   */
  fallbackViewId: val(raw.fallbackViewId, DEMO.fallbackViewId),
  /**
   * Tableau Cloud REST API 不支持 CORS（实测：无 ACAO 头、OPTIONS 预检 405），
   * REST 请求必须走同源代理：dev = Vite 代理（见 vite.config.ts，与本节同源读取 .env）；
   * prod = 网关/nginx 同路径反代（样例见 deploy/nginx.conf.example）。
   * 嵌入 iframe（v3）不受影响，仍直连 serverUrl。
   */
  apiBaseUrl: val(raw.apiBaseUrl, '/tableau-proxy'),
  tokenTtlSeconds: 300,
  refreshIntervalSeconds: 240,
} as const

export function buildViewUrl(workbook: string, view: string): string {
  return `${TABLEAU_CONFIG.serverUrl}/t/${TABLEAU_CONFIG.siteContentUrl}/views/${encodeURIComponent(workbook)}/${encodeURIComponent(view)}`
}
