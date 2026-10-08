# 组织模型规则（Org Rules）—— 用户 / 团队 / 归属 / 冻结

> v0.9.0 起。适用对象：**改 `src/stores/org-store.ts`、`/users`、`/teams`、`/t/$teamSlug` 的人**。
> 相关文件：`src/stores/org-store.ts`（唯一数据源）、`src/components/org/**`（UI）、
> `src/routes/t.$teamSlug.tsx`（团队入口守卫）、`src/lib/team-context.ts`（URL ↔ 团队）。

## 铁律（先读这四条）

1. **每个用户必须至少属于一个团队。** 不存在「无归属用户」这种状态。
2. **冻结用户 = 无法登录。** 数据值仍是 `status: 'disabled'`（与后端账号表对齐），界面叫 Frozen。
3. **冻结团队只有系统管理员能进。** 别人看不见入口、点了也被拒、直接改 URL 也进不去。
4. **默认团队（创建最早的那个）不可删除、不可冻结。** 它是所有账号的兜底落点：删掉它，归属不变量就失去最后的锚；
   冻结它则非管理员再没有「必然可进入」的团队。

这几条都不是「界面上的提示」，而是**在 store 里兜底**的：UI 只是提前把话说清楚，
真正的拒绝发生在 `org-store.ts` 的动作里（返回 `false` / `null`），任何调用方都绕不过去。

## 1. 用户归属（每个用户必须属于某个团队）

| 场景 | 规则 | 落点 |
| --- | --- | --- |
| 新建用户 | 默认加入**当前团队**（`activeTeamId`），岗位 `viewer`，并作为其默认团队；当前团队为空时退回第一个团队 | `addUser()`；`user-dialogs.tsx` 的表单提示写明「New users join the current team (X) as Viewer」 |
| 一个团队都没有 | 拒绝创建，返回 `null`，UI 提示先建团队 | `addUser()` 返回 `null` → toast `users.noTeamAvailable` |
| 移除成员关系 | 这是该用户**唯一**团队时拒绝（返回 `false`），必须先给他分配别的团队 | `removeMember()`；`user-dialogs` / `team-members-dialog` 的移除按钮同步 `disabled` |
| 删除团队 | 团队里有成员**只属于它**时拒绝删除（返回 `false`），并提示还有几人需要先安置 | `deleteTeam()` + `orphanedUsersOfTeam()`；删除确认框里直接列出人数 |
| 删除用户 | 不受此限（整个账号连同成员关系一起消失） | `deleteUser()` |
| 老数据 | `persist.migrate` v2→v3 给「无归属」账号补一条成员关系（当前团队 → 第一个团队，viewer + 默认） | `persist.migrate` |

> 为什么用「拒绝」而不是「自动搬家」：自动搬家会在管理员不知情的情况下改变别人的团队归属与岗位；
> 拒绝 + 明确提示，把决定权留给操作者。

## 1.5 默认团队（第一个团队）不可删除、不可冻结

- **定义**：`defaultTeamId(teams)` = 创建最早（`id` 最小）的团队；`isDefaultTeam(teams, id)` 供 UI 判定。
- **为什么**：它是「每个账号都必须有归属」的兜底落点（铁律 1）。删掉它之后，一旦某个账号的其它团队
  也被删/被移出，就没有任何团队可以安置它；而且新建用户默认加入的是**当前团队**，
  当管理页当前团队恰好被删时也需要一个稳定的回退目标。冻结它对非管理员是同样的效果
  （冻结团队只有系统管理员能进，见第 3 节），所以一并禁止。
- **拦截点**：
  - `deleteTeam()` —— 命中默认团队直接返回 `false`（与「有成员只属于该团队」是两类不同的拒绝原因，
    UI 分别提示 `teams.deleteDefaultBlocked` 与 `teams.deleteBlocked`）；
  - `setTeamSuspended()` —— 对默认团队的**冻结**方向返回 `false`；**解冻方向不拦**
    （迁移上来的老数据里若已有被冻结的默认团队，必须留出解冻路径）；
  - `/teams` 行内：默认团队的**删除**与**冻结**按钮都 **disabled**，title 分别说明原因
    （`teams.deleteDefaultBlocked` / `teams.suspendDefaultBlocked`）；行内另有 `Default` 徽章标示系统级默认团队；
  - 团队编辑弹窗：默认团队的 `Suspended` 开关 **disabled**，并显示 `teams.suspendDefaultBlockedHint`。
- **与「我的默认团队」的区别**：`TeamMember.isDefault` 是**每个用户各自**的默认团队（切换身份时的初始团队）；
  本条讲的是**系统级**的默认团队（第一个团队）。前者可改可移，后者不可删除、不可冻结。
  `/teams` 表格**不再**显示 `My default` 徽章（与 `Default` 并排容易被误读为同一个东西）；
  侧栏 TeamSwitcher 下拉里的 `My default` 保留（那是「切身份后会落到哪个团队」，含义不同）。

## 2. 用户冻结（不可登录）

- **数据值**：`OrgUser.status = 'disabled'`（`'active'` ⇄ `'disabled'` 两态，与后端 `status` 列一致）。
- **展示文案**：`Frozen`（`users.frozen`）；状态映射集中在 `USER_STATUS_LABEL_KEYS`，不要在页面里另写一套。
- **拦截点**：
  - `setCurrentUser()` —— 演示态的「登录」就是切换身份，冻结用户一律返回 `false`（UI 提示原因）；
  - 侧栏用户菜单：冻结用户列表项 `disabled` + `Frozen` 徽章（`user-menu.tsx`）；
  - `/users` 行内的冻结 / 解冻按钮：`freezeUser(id, frozen)`。
- **护栏**：不能冻结自己（会把自己当场锁在外面）；不能冻结**最后一名未冻结的系统管理员**（否则没人能再解冻）。
- **与删除的差别**：冻结保留账号与它的团队关系，解冻即恢复；删除是销毁账号。

## 3. 团队冻结（仅系统管理员可进入）

- **数据值**：`OrgTeam.suspended: boolean`（默认 `false`；`createTeam` 落库时显式写入）。
- **判定函数**：`canEnterTeam(team, user)` —— 未冻结人人可进；冻结后仅 `isSystemAdmin === true` 可进。
- **拦截点**：
  - TeamSwitcher 下拉：非管理员的列表里**不出现**冻结团队；管理员的列表出现且带 `Suspended` 徽章；
  - `setActiveTeam()` —— 非管理员切进冻结团队返回 `false`（切换器据此不跳转并提示）；
  - `/t/$teamSlug` 路由守卫 —— 非成员/冻结/无权限三种兜底页分开，冻结命中 `TeamSuspended` 兜底页
    （直接粘贴 URL 也拦得住，这里是所有团队页的唯一入口）；
  - `setTeamSuspended()` 在冻结后立即重算 `activeTeamId`：当时停在冻结团队的非管理员会被移到
    他自己可进入的团队，不会「停在一个进不去的团队」；
  - `setTeamSuspended()` 对**默认团队**的冻结请求返回 `false`（它是所有账号的兜底落点，见 1.5）。
- **与删除的差别**：冻结保留团队、成员关系与数据，只改「谁能进」；常用于整改/数据问题/预算暂停期。

## 4. 接后端时的映射（保持前端类型不变）

| 前端 | 建议后端 | 说明 |
| --- | --- | --- |
| `OrgUser.status: 'active' \| 'disabled'` | `status` 列同值 | 前端两态与后端一致，直接对上 |
| `OrgUser.username` | 唯一索引 + `USERNAME_PATTERN` | 前端 `usernameIssue()` 只是少一次往返，真正校验在服务端 |
| `OrgTeam.suspended` | `suspended_at TIMESTAMP NULL`（或 `is_suspended BOOL`） | 前端布尔化即可；冻结时间戳可用于审计 |
| `TeamMember(teamId,userId,role,isDefault)` | 唯一约束 `(team_id,user_id)` | 归属不变量建议同时用数据库约束兜底（见下） |
| 归属不变量 | `user` 表 / 触发器保证至少一条成员关系 | 前端已有护栏；后端最好有同等约束，否则接口层能绕过 |

## 5. 改这块代码时的自查清单

- [ ] 新增「会减少用户归属」的动作？→ 先过 `orphanedUsersOfTeam()` / `userMemberships().length` 判定。
- [ ] 新增「进入团队」的入口（新路由 / 新页面 / 新跳转）？→ 必须经 `canEnterTeam()` 判定。
- [ ] 新增状态徽章 / 状态文案？→ 用 `USER_STATUS_LABEL_KEYS` 与 `t('users.frozen')`，别新造词。
- [ ] 动了持久化字段？→ 升 `persist.version` 并补一段 `migrate`（v1/v2 的老数据仍要能升上来）。
- [ ] 新增/调整删除或冻结入口？→ 默认团队（创建最早）**不可删也不可冻结**；含「唯一归属」成员的团队不可删 —— 三类原因分别提示。
- [ ] 新增文案？→ `pnpm check:i18n:keys`（`scripts/check-i18n-keys.mjs`）会检查「代码在用、词典缺失」的 key，
      避免界面上直接把 key 名渲染出来。
