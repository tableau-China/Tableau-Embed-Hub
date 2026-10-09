import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeLoginConfig, type LoginConfig } from '@/lib/login'
import { DEFAULT_SMTP_CONFIG, normalizeSmtpConfig, type SmtpConfig } from '@/lib/smtp'
import { STORAGE_PREFIX } from '@/lib/storage-migration'

/**
 * 系统配置 store（Config 菜单下的页面共用）：SMTP 邮件服务 + 登录页。
 *
 * 与其它 store 的分工：org-store 管「谁是谁」、permission-store 管「谁能看什么」、
 * 本 store 管「系统怎么连外部服务、长什么样」。三者互不依赖。
 *
 * ## 哪些字段落盘、哪些不落盘
 *
 * 本模板是纯前端（无后端），浏览器里能做的只有 localStorage，于是按「敏感 / 非敏感」一刀切：
 *
 *   - **SMTP 密码不落盘**：见下方长注释 —— 「加密后存 localStorage」是安全剧场；
 *   - **登录配置全部落盘**：模板 id、宣传图 URL、provider 的公开参数
 *     （Client ID / 授权端点 / 回调地址 / scope）**没有一项是密钥**。
 *     Client Secret 从一开始就**不收集**（前端存它等于把它发给所有人），
 *     授权码换 token 必须由后端做 —— 见 lib/login.ts 的文件头与 docs/login-setup.md。
 *
 * ## 为什么 persist 的 version 保持 1（不跟着加字段一起升）
 *
 * 登录配置是**新增字段**：老数据里没有 `login`，`normalizeLoginConfig(undefined)` 补出厂值即可。
 * 反过来，升 version 却不写 migrate 会让 zustand 判定「无法迁移」而丢弃整份持久化数据 ——
 * 老用户已经填好的 SMTP 配置会一起消失。**形状变化能用 normalize 兜住就不要动 version。**
 *
 * ## 密码为什么不落盘（与 pg-explorer 的关键差异）
 *
 * pg-explorer 把 SMTP 密码加密后存进服务端数据库（`system_configuration` 表，AES-256-CBC）。
 * 那是**后端**的正确做法 —— 密钥在服务端环境变量里，浏览器拿不到。
 *
 * 本模板是纯前端（无后端），浏览器里能做的只有 localStorage，于是：
 *   - 「加密后存 localStorage」是**安全剧场**：解密密钥必须一起打进 JS bundle，任何人都能取；
 *   - 因此这里**只持久化非敏感字段**（host / port / encryption / username / fromEmail / fromName），
 *     密码只留在**内存**中：刷新即失效，需要重新输入。
 *
 * 接后端时把本文件替换成接口调用即可（数据形状不变）：
 *   GET  /api/config/smtp → { ...SmtpConfig, hasPassword }   （**永不回传密码**）
 *   PUT  /api/config/smtp → { ...SmtpConfig, password? }     （空 = 保持原密码）
 *   POST /api/config/smtp/test → nodemailer `transporter.verify()` 的真实握手结果
 * 密码随后只存在于服务端（加密存储），前端只持有 `hasPassword` 布尔值。
 */

interface ConfigState {
  /** SMTP 非敏感配置（localStorage 持久化） */
  smtp: SmtpConfig
  /** 上次保存时间（ISO 字符串）；null = 从未保存 */
  smtpUpdatedAt: string | null
  /** SMTP 密码 / 授权码：仅内存，刷新即丢（见文件头说明） */
  smtpPassword: string

  /** 登录页配置（样式模板 + 宣传图 + 第三方公开参数），全部非敏感 → 落盘 */
  login: LoginConfig
  /** 登录配置上次保存时间（ISO 字符串）；null = 从未保存 */
  loginUpdatedAt: string | null

  /**
   * 保存 SMTP 配置。
   * @param password `undefined` = 保持已保存的密码不变；`''` = 清空密码；非空 = 覆盖。
   */
  saveSmtp: (config: SmtpConfig, password?: string) => void
  /** 清空内存中的密码（「清除密码」按钮） */
  clearSmtpPassword: () => void
  /** 恢复出厂默认（清空配置与密码） */
  resetSmtp: () => void

  /** 保存登录配置（写入前统一过 normalizeLoginConfig，脏值不会进 store） */
  saveLogin: (config: LoginConfig) => void
  /** 恢复出厂登录配置（样式 / 宣传图 / provider 参数一起回默认） */
  resetLogin: () => void
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      smtp: { ...DEFAULT_SMTP_CONFIG },
      smtpUpdatedAt: null,
      smtpPassword: '',
      login: normalizeLoginConfig(),
      loginUpdatedAt: null,

      saveSmtp: (config, password) => {
        set((s) => ({
          smtp: normalizeSmtpConfig(config),
          smtpUpdatedAt: new Date().toISOString(),
          smtpPassword: password === undefined ? s.smtpPassword : password,
        }))
      },

      clearSmtpPassword: () => set({ smtpPassword: '' }),

      resetSmtp: () => {
        set({ smtp: { ...DEFAULT_SMTP_CONFIG }, smtpUpdatedAt: null, smtpPassword: '' })
      },

      saveLogin: (config) => {
        set({ login: normalizeLoginConfig(config), loginUpdatedAt: new Date().toISOString() })
      },

      resetLogin: () => {
        set({ login: normalizeLoginConfig(), loginUpdatedAt: null })
      },
    }),
    {
      name: `${STORAGE_PREFIX}:config`,
      version: 1,
      // 只落盘非敏感字段：`partialize` 把密码挡在持久化之外（不是靠注释约定，而是靠代码）
      partialize: (s) => ({
        smtp: s.smtp,
        smtpUpdatedAt: s.smtpUpdatedAt,
        login: s.login,
        loginUpdatedAt: s.loginUpdatedAt,
      }),
      // 反序列化统一走 normalize*：旧数据缺字段、脏数据都不会让 UI 崩
      merge: (persisted, current) => {
        const saved = persisted as
          | {
              smtp?: Partial<SmtpConfig>
              smtpUpdatedAt?: unknown
              login?: Partial<LoginConfig>
              loginUpdatedAt?: unknown
            }
          | undefined
        return {
          ...current,
          smtp: normalizeSmtpConfig(saved?.smtp),
          smtpUpdatedAt: typeof saved?.smtpUpdatedAt === 'string' ? saved.smtpUpdatedAt : null,
          login: normalizeLoginConfig(saved?.login),
          loginUpdatedAt: typeof saved?.loginUpdatedAt === 'string' ? saved.loginUpdatedAt : null,
        }
      },
    },
  ),
)
