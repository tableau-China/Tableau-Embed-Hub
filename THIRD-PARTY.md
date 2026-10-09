# Third-party notices（第三方组件与商标声明）

本文件记录本项目**依赖或分发**的第三方组件中，需要使用者特别注意的许可与商标信息。
本项目自身代码适用 [LICENSE](./LICENSE)（MIT）。

## 商标

- **Tableau**、**Tableau Cloud**、**Tableau Server** 是 Salesforce, Inc. 的商标。
- 本项目是**非官方**的第三方开源项目：与 Salesforce, Inc. 无隶属、授权或赞助关系，也未获其背书。
  项目名称中的 "Tableau" 仅用于**指明所集成的产品**（指代性使用），不代表任何官方身份。
- 请勿使用本项目暗示官方、认证或背书关系；也请勿使用 Salesforce / Tableau 的 logo、品牌配色或字体。

你与 Salesforce, Inc. 之间的关系由**你自己的** Tableau 许可与条款决定，与本项目的 MIT 许可无关。

## 需要特别注意的依赖

### `@tableau/embedding-api`

| 项 | 内容 |
| --- | --- |
| 版权 | Salesforce, Inc. |
| 许可 | **Salesforce Binary Code License Agreement for Tableau Embedding API**（**不是**开源许可） |
| 全文位置 | 安装依赖后见 `node_modules/@tableau/embedding-api/LICENSE.md` |
| 本项目的用法 | [`src/components/tableau/tableau-embed.tsx`](./src/components/tableau/tableau-embed.tsx) 以值导入 `TableauViz`，**构建产物会内联打包该包的代码** |

该许可中与使用者直接相关的限制（**非法律意见**，正式判断请读原文）：

- 授权仅限于「随 Licensee 自己的应用一起分发」；
- 不得用于 time sharing、hosting、service provider 一类用途；
- 当该软件**构成本发行物的主要功能**时，不得随应用分发；
- 不得移除其中的所有权声明、不得反向工程、不得修改或并入其它软件（除获得书面授权）。

> **使用者须知**：执行 `pnpm install` 或使用本项目的构建产物，意味着**你本人**需要接受上述许可并
> 遵守其条款；本项目不对你的合规负责（见 [LICENSE](./LICENSE) 的免责条款）。

> 📌 **计划中**：改为运行时从使用者自己的 Tableau 站点加载
> `javascripts/api/tableau.embedding.3.latest.min.js`，届时仓库与构建产物都不再包含 Salesforce 代码。
> 见 [CHANGELOG.md](./CHANGELOG.md) 的「0.13.0」节。

## 其它依赖

其余依赖（React、TanStack Router/Query、Radix UI、Tailwind CSS、zustand、i18next、lucide-react 等）
均为 MIT / ISC / Apache-2.0 一类宽松许可。完整清单：

```bash
pnpm licenses list          # 按许可分组列出全部依赖
```

## 相关文档

- [SECURITY.md](./SECURITY.md) —— 凭据内联、演示凭据与权限边界
- [README.md](./README.md) —— 首屏的「非官方 / 无担保 / 凭据自负」声明
