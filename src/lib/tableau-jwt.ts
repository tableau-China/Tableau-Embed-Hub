import { SignJWT } from 'jose'

import { TABLEAU_CONFIG } from '@/config/tableau'

export type TableauScope =
  | 'tableau:views:embed'
  | 'tableau:content:read'
  | 'tableau:views:*'
  | 'tableau:workbooks:*'
  | 'tableau:jobs:read'

/** 生成 Tableau Connected App JWT（HS256），claims 与旧后端 jsonwebtoken 实现一致 */
export async function createTableauJwt(
  scopes: TableauScope[],
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
