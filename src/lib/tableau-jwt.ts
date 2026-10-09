import { SignJWT } from 'jose'

import { TABLEAU_CONFIG } from '@/config/tableau'

/**
 * JWT 的 \`scp\` 允许值 —— **只列本项目真正用到的**（写全 210 个官方值没有意义，
 * 写错一个拼写却会让整张令牌在对应端点上变成 401002）。
 *
 * 来源：各 REST 方法的 "JWT Access Scope" 属性块，以及 Connected Apps 的 scope 清单
 * （docs/tableau-setup.md 记录了本项目用到的每一项及其对应能力域）。
 * 注意 scope 的形态是 \`tableau:<资源>:<动作>\`，动作取值 create/read/run/update/download/delete；
 * 通配 \`tableau:users:*\` 是官方文档承认的写法（= get/list + add + delete + update）。
 */
export type TableauScope =
  | 'tableau:views:embed'
  | 'tableau:content:read'
  | 'tableau:views:*'
  | 'tableau:workbooks:*'
  | 'tableau:jobs:read'
  | 'tableau:tasks:read'
  | 'tableau:users:read'
  | 'tableau:users:*'

/**
 * 生成 Tableau Connected App JWT（HS256），claims 与旧后端 jsonwebtoken 实现一致。
 * 参数收 \`readonly\`：scope 集合是按能力域写死的常量表（\`TABLEAU_SCOPE_SETS\`），不该被调用方改写。
 */
export async function createTableauJwt(
  scopes: readonly TableauScope[],
  ttlSeconds: number = TABLEAU_CONFIG.tokenTtlSeconds,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const secret = new TextEncoder().encode(TABLEAU_CONFIG.secretValue)

  return new SignJWT({
    iss: TABLEAU_CONFIG.clientId,
    aud: 'tableau',
    sub: TABLEAU_CONFIG.embedUser,
    jti: crypto.randomUUID(),
    scp: scopes,
  })
    .setProtectedHeader({ alg: 'HS256', kid: TABLEAU_CONFIG.secretId })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secret)
}
