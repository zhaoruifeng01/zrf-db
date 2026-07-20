# 前端迁移现状核查(Reality Check)

- **Status:** 现实核查文档,修正 `frontend-migration-progress.md` 的乐观自报
- **Date:** 2026-07-20
- **Owner:** DB-GPT frontend
- **Related:** `frontend-migration-progress.md`(原始进度,需对照本文阅读)、`0001-unify-frontend-stack.md`、`0002-frontend-route-migration-playbook.md`

## 为什么有这份文档

`frontend-migration-progress.md` 把全部 34 条路由标为 `complete`,给人"迁移基本完成"的印象。但**实际跑起来的 shell 只能渲染一个聊天界面,其他功能全部不可达**。本文档基于源码核查 + 运行时事实,给出和现实对得上的迁移清单,避免后续决策建立在虚假前提上。

## 核心结论

**文件级迁移看起来完成,运行时迁移实际未完成。**

- ✅ `routes.ts` 注册了 34 条路由,每条都对应一个真实存在的薄路由模块(5~16 行,React Router v7 framework mode 的正确写法)
- ✅ 27 个 feature page 文件真实存在,行数 43~805,总计 7514 行,内部有真实 JSX/API 调用/状态逻辑
- ❌ **shell 根布局 `root.tsx` 只是 provider 栈 + `<Outlet/>`,没有任何全局导航**;旧 app 的全局 `Header.tsx`、`Sider.tsx` 从未接入 shell
- ❌ **`ChatSider`(在 `/` 渲染的 ChatPage 里)只跳 `/chat`,不导航到任何其他模块**
- ❌ 结果:用户跑起来只能看到 `/` 的聊天页,其余 32 条路由虽有代码但**UI 上无入口可达**

一句话:**路由都写了,但应用壳(全局导航)没接,所以跑起来等于只有一个 chat 页。**

## 证据链

### 1. root.tsx 是裸 provider + Outlet,无全局导航

`web/shell/app/root.tsx` 的 `Layout` 与 `App`:

```tsx
// Layout: ConfigProvider > AntdApp > QueryProvider > {children}
// App:    ChatContextProvider > AuthenticatedRoutes > <Outlet/>
```

没有任何 `<Sider>`、`<Header>`、全局 `<Menu>` 包裹 `<Outlet/>`。路由内容被直接渲染,缺少应用级导航骨架。

### 2. 全局 Header/Sider 未被 shell 引用

```
$ grep -rn "new-components/layout/Sider|new-components/layout/Header" web/shell/app
>>> 没找到:全局 Sider/Header 未接入 shell
```

`web/new-components/layout/Sider.tsx`、`Header.tsx`(旧 app 的主导航)在 shell 中零引用。shell 自己的 `app/components/` 只有 `construct/ConstructLayout.tsx` 和 `governance/GovernanceTabs.tsx` 两个**区块内**导航,没有**跨模块**的全局导航。

### 3. ChatSider 不导航到其他模块

```
web/new-components/chat/sider/ChatSider.tsx
  69:  router.push(`/chat`);
  97:  router.push(item.default ? '/chat' : `?scene=...&id=...`);
```

ChatSider 的所有跳转都指向 `/chat` 或 chat 内部 query,没有任何到 `/construct/*`、`/evaluation`、`/data_index` 等模块的链接。所以即使 `/` 能渲染出带 ChatSider 的聊天页,也无法从聊天页跳到其他功能。

### 4. ConstructLayout 只覆盖 construct 区块内部

`web/shell/app/components/construct/ConstructLayout.tsx` 有 `BASE_ITEMS` 标签栏(app/flow/models/database/knowledge/prompt/skills/connectors/scheduled-tasks/dbgpts/permission),**区块内**导航可用,但前提是用户已进入 `/construct/*`。从 `/`(chat)无法到达 `/construct`。

### 5. 文件级"完成"的证据(对照)

| 维度 | 数值 | 说明 |
|---|---|---|
| `routes.ts` 注册路由 | 34 条 | 全部有对应 route 文件 |
| route 文件行数 | 5~16 行(32 条)+ 65/76/104 行(health/governance/login) | 薄路由模块,设计如此,非缺陷 |
| feature page 文件 | 27 个,43~805 行 | 真实实现,非空壳 |
| feature page 总行数 | 7514 行 | 不是占位代码 |
| `web/pages` 旧 Next 路由 | 0 文件(目录已删) | 路由层源码确实已迁 |
| `next/router` 等 import | 0 | 代码层 Next 依赖已清 |

**结论:文件/代码层迁移是真做了的,但"应用壳"这一层漏了,导致运行时不可用。**

## 运行时可达性清单(真值表)

按"用户能否在跑起来的 shell 里用到这个功能"分类:

| 路由 | 文件存在 | 运行时可达 | 备注 |
|---|---|---|---|
| `/` | ✅ | ✅ | 默认页 = ChatPage,带 ChatSider |
| `/chat` | ✅ | ✅ | 同上 |
| `/login` | ✅ | ✅ | 公开路由,Auth gate 直接跳转可达 |
| `/health` | ✅ | ⚠️ | 仅冒烟,非用户功能 |
| `/share/:token` | ✅ | ⚠️ | 公开路由,需直接输 URL,无导航入口 |
| `/mobile/chat` | ✅ | ⚠️ | 公开路由,需直接输 URL |
| `/playground` | ✅ | ❌ | 无导航入口 |
| `/governance` | ✅ | ❌ | 无导航入口(GovernanceTabs 是区块内) |
| `/conversations` | ✅ | ❌ | 无导航入口 |
| `/data_index` | ✅ | ❌ | 无导航入口 |
| `/evaluation` | ✅ | ❌ | 无导航入口 |
| `/knowledge/graph` | ✅ | ❌ | 无导航入口 |
| `/models_evaluation` | ✅ | ❌ | 无导航入口 |
| `/models_evaluation/datasets` | ✅ | ❌ | 无导航入口 |
| `/models_evaluation/:code` | ✅ | ❌ | 无导航入口 |
| `/construct` | ✅(重定向到 /construct/app) | ❌ | 无导航入口 |
| `/construct/app` | ✅ | ❌ | ConstructLayout 有区块内 tab,但进不去 construct |
| `/construct/app/extra` | ✅ | ❌ | 同上 |
| `/construct/flow` | ✅ | ❌ | 同上 |
| `/construct/flow/canvas` | ✅ | ❌ | 同上 |
| `/construct/flow/libro` | ✅ | ❌ | 同上 |
| `/construct/models` | ✅ | ❌ | 同上 |
| `/construct/database` | ✅ | ❌ | 同上 |
| `/construct/knowledge` | ✅ | ❌ | 同上 |
| `/construct/knowledge/chunk` | ✅ | ❌ | 同上 |
| `/construct/prompt` | ✅ | ❌ | 同上 |
| `/construct/prompt/:type` | ✅ | ❌ | 同上 |
| `/construct/skills` | ✅ | ❌ | 同上 |
| `/construct/connectors` | ✅ | ❌ | 同上 |
| `/construct/scheduled-tasks` | ✅ | ❌ | 同上 |
| `/construct/scheduled-tasks/:taskId` | ✅ | ❌ | 同上 |
| `/construct/dbgpts` | ✅ | ❌ | 同上 |
| `/construct/agent` | ✅(重定向到 /construct/dbgpts) | ❌ | 无导航入口 |
| `/construct/permission` | ✅ | ❌ | 同上 |

汇总:
- **运行时用户可用**:2 条(`/`、`/chat`,本质同一个 ChatPage)
- **公开可达但无导航入口**:4 条(login/health/share/mobile-chat)
- **有代码但完全不可达**:28 条(全部 construct 子页 + evaluation/data_index/models_evaluation/knowledge-graph/playground/governance/conversations)

## 旧 Next.js app 的页面全集(对照基线)

从 `packages/dbgpt-app/src/dbgpt_app/static/old_web/` 静态导出产物枚举(`index.html` 所在目录 = 真实路由):

```
/                      /agent                /app
/chat                  /database             /flow
/flow/canvas           /knowledge            /knowledge/chunk
/knowledge/graph       /models               /prompt
/404
```

注意:旧 app 的 `database/flow/knowledge/models/prompt/agent` 是**顶层路由**(`/database`、`/flow`...),而 shell 把它们重组成 `/construct/*`。路径结构本身变了,这也会影响外部书签/深链。

## 真实迁移完成度评估

| 层 | 自报状态 | 实际状态 |
|---|---|---|
| 路由模块(`routes.ts` + route 文件) | complete | ✅ 真完成(34/34) |
| feature page 源码 | complete | ✅ 真完成(27 个,有实质代码) |
| Next.js 代码 import 清零 | complete | ✅ 真完成(`web/pages` 已删) |
| **应用壳 / 全局导航** | (未列入) | ❌ **完全缺失**——这是运行时不可用的根因 |
| 运行时可用功能 | (隐含 complete) | ❌ 1/34(仅 chat) |
| Next.js 依赖/构建删除 | 第 4 批未来 | ❌ 未做(`next 13.4.7` 仍在 `web/package.json`) |
| 旧组件原生化(`useRequest`/`apiInterceptors`) | 兼容债 | ⚠️ shell 内仍有 10 处 useRequest、12 处 apiInterceptors |

**真实完成度:约 40%。** 路由+feature 源码层完成,但缺少把它们组装成可用应用的"应用壳"层,且 Next.js 框架/依赖未拆除。自报的"~100%"是路由模块口径,不是可用产品口径。

## 修复方向(下一步建议,非结论)

要 shell 真正可用,最小必要工作:

1. **补应用壳导航**(最高优先,卡住一切):
   - 在 `root.tsx` 的 `Layout` 里包一层全局 `<Header/> + <Sider/>`(迁移或重写旧的 `new-components/layout/{Header,Sider}.tsx`)
   - Sider 菜单项链接到 `/chat`、`/construct/app`、`/evaluation`、`/data_index`、`/knowledge/graph`、`/models_evaluation`、`/governance` 等模块入口
   - 这是把 28 条不可达路由一次性变成可达的关键

2. **验证 feature page 真能跑**:补完导航后,逐个路由实跑,确认 feature page 不只是文件存在,而是渲染正常、API 通、无运行时报错。文件行数不等于可用。

3. **之后再谈删 Next.js**:在 shell 能完整替代旧 app 之前,`old_web` 产物 + legacy 启动模式必须保留(它才是当前真正能跑的)。删除 legacy 模式是最后一步,不是现在。

## 附:为什么会被误导

`frontend-migration-progress.md` 的 `complete` 状态语义是"路由模块已建 + 旧 Next page 已删 + 门禁(typecheck/lint/build)通过",**不含"用户可在 UI 中到达并使用该功能"**。门禁全是静态检查(typecheck/lint/build),没有运行时可达性/导航完整性检查。所以一份全绿的门禁报告 + 一个跑起来缺导航的 shell 可以同时存在。本文档补充的就是这个缺失的运行时维度。
