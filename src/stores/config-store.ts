import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_SMTP_CONFIG, normalizeSmtpConfig, type SmtpConfig } from '@/lib/smtp'

/**
 * 系统配置 store（Config 菜单下的页面共用）：当前只有 SMTP 一项，后续新增配置项在这里扩展。
 *
 * 与其它 store 的分工：org-store 管「谁是谁」、permission-store 管「谁能看什么」、
 * 本 store 管「系统怎么连外部服务」。三者互不依赖。
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

  /**
   * 保存 SMTP 配置。
   * @param password `undefined` = 保持已保存的密码不变；`''` = 清空密码；非空 = 覆盖。
   */
  saveSmtp: (config: SmtpConfig, password?: string) => void
  /** 清空内存中的密码（「清除密码」按钮） */
  clearSmtpPassword: () => void
  /** 恢复出厂默认（清空配置与密码） */
  resetSmtp: () => void
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      smtp: { ...DEFAULT_SMTP_CONFIG },
      smtpUpdatedAt: null,
      smtpPassword: '',

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
    }),
    {
      name: 'shadcn-admin-cn:config',
      version: 1,
      // 只落盘非敏感字段：`partialize` 把密码挡在持久化之外（不是靠注释约定，而是靠代码）
      partialize: (s) => ({ smtp: s.smtp, smtpUpdatedAt: s.smtpUpdatedAt }),
      // 反序列化统一走 normalizeSmtpConfig：旧数据缺字段、脏数据都不会让 UI 崩
      merge: (persisted, current) => {
        const saved = persisted as { smtp?: Partial<SmtpConfig>; smtpUpdatedAt?: unknown } | undefined
        return {
          ...current,
          smtp: normalizeSmtpConfig(saved?.smtp),
          smtpUpdatedAt: typeof saved?.smtpUpdatedAt === 'string' ? saved.smtpUpdatedAt : null,
        }
      },
    },
  ),
)
