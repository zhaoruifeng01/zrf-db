# 前端路由迁移进度

- **Status:** Living document（随迁移推进持续更新）
- **Date:** 2026-07-17 起维护
- **Owner:** DB-GPT frontend
- **Related:** `adr/0001-unify-frontend-stack.md`（决策）、`adr/0002-frontend-route-migration-playbook.md`（执行规范）

本文档按 ADR 0002 的"一个领域切片、四个阶段、一次完整删除"模型跟踪每条路由的迁移状态。状态取值：

- `inventory` — 阶段 0 盘点中
- `bridged` — 阶段 1 临时接入（lazy wrapper）
- `native` — 阶段 2 原生改造完成
- `complete` — 阶段 3 旧代码删除 + 全部门禁通过

## 总览

| 路由 | 状态 | 迁移单元 | 完成日期 | 备注 |
|---|---|---|---|---|
| `/login` | complete | 短期基线 | 2026-07 | shell 原生 |
| `/health` | complete | 短期基线 | 2026-07 | 冒烟路由 |
| `/governance` | complete | 中期治理 | 2026-07 | 6 tab，删除 iframe + Vue |
| `/chat` | bridged | 中期 chat | 2026-07 | wrapper + next/* 适配层 |
| `/conversations` | bridged | 中期 chat | 2026-07 | wrapper |
| `/` | bridged | 中期 chat | 2026-07 | wrapper |
| `/construct/models` | complete | Construct 闭环 #1 | 2026-07-17 | ADR 0002 首个完整单元 |
| `/construct/prompt` | complete | Construct 闭环 #1 | 2026-07-17 | 含 list + add/edit |
| `/construct/prompt/:type` | complete | Construct 闭环 #1 | 2026-07-17 | Markdown/JsonView lazy |
| `/construct/app` | inventory | Construct 闭环 #2 | — | 盘点中 |
| `/construct/app/extra` | inventory | Construct 闭环 #2 | — | 盘点中 |
| `/construct/knowledge` | inventory | Construct 闭环 #2 | — | 盘点中 |
| `/construct/knowledge/chunk` | pending | Construct 闭环 #2 | — | 待盘点 |
| `/construct/database` | pending | Construct 闭环 #3 | — | |
| `/construct/flow` | pending | 高交互 | — | AWEL 画布，G6 重依赖 |
| `/construct/connectors` | pending | Construct 闭环 #3 | — | |
| `/construct/scheduled-tasks` | pending | Construct 闭环 #3 | — | 含 [taskId] 动态路由 |
| `/construct/dbgpts` | pending | Construct 闭环 #3 | — | |
| `/construct/skills` | pending | Construct 闭环 #3 | — | |
| `/construct/permission` | pending | Construct 闭环 #3 | — | |
| `/construct` | pending | Construct 闭环 #3 | — | 构造首页 |
| `/data_index` | pending | CRUD/查询 | — | |
| `/evaluation` | pending | CRUD/查询 | — | |
| `/mobile/chat` | pending | 高交互 | — | |
| `/share/[token]` | pending | 高交互 | — | |
| `/playground` | pending | 高交互 | — | |

## 已完成单元

### Construct 闭环 #1 — models + prompt

- **Routes**: `/construct/models`、`/construct/prompt`、`/construct/prompt/:type`
- **Owner**: DB-GPT frontend
- **Status**: complete（2026-07-17）
- **迁移文件**:
  - `web/shell/app/components/construct/ConstructLayout.tsx`（shell 版，不依赖 ChatContext）
  - `web/shell/app/features/construct-models/{api.ts, query-keys.ts, queries.ts, pages/ModelsPage.tsx}`
  - `web/shell/app/features/construct-prompt/{api.ts, query-keys.ts, queries.ts, pages/PromptListPage.tsx, pages/PromptEditPage.tsx}`
  - `web/shell/app/routes/{construct-models, construct-prompt, construct-prompt.$type}.tsx`（薄路由）
  - `web/shell/app/styles/globals.css`（追加 construct-tabs/prompt-container 样式）

- **Legacy removed**:
  - `web/pages/construct/models/index.tsx`
  - `web/pages/construct/prompt/index.tsx`
  - `web/pages/construct/prompt/[type]/index.tsx`
  - `web/pages/construct/prompt/styles.module.css`
  - localStorage key `edit_prompt_data`（改为 navigate state）

- **关键改造**:
  - `useRequest`/`apiInterceptors` → TanStack Query
  - `next/router` → React Router `useNavigate`/`useParams`/`useLocation`
  - `ChatContext.{mode,modelList}` → `usePreferences` + `useUsableModels`
  - 重依赖（MarkdownEditor/JsonView/MarkdownContext）lazy import
  - 路由级 chunk 拆分：`construct-models` 129.61 kB

- **Verification**:
  - web typecheck: `baseline=143 current=143 new=0 fixed=0`（baseline 147→143）
  - shell typecheck: 182 errors，全部来自 `../pages/`、`../utils/`、`../new-components/` 预存，**新代码 0 错误**
  - shell build: 通过（client 8m52s + server 39s）
  - shell lint: 3 errors + 18 warnings，全部预存（GovernanceTabs 2 + dynamic.tsx 1 + chat.tsx 13 warnings + 继承 any 4），**新代码 0 errors**

- **Remaining compatibility debt**（不属本单元）:
  - 旧 `web/new-components/layout/Construct.tsx` 仍被未迁移的 construct 子页面使用
  - shell lint 预存 3 errors
  - shell `helper-*.js` 18MB 大 chunk（迁移期可接受）

### 短期/中期已完成（历史单元）

- **/login、/health、/governance**：shell 原生，已删除对应旧链路（Vue 工程整体删除）
- **/chat、/conversations、/**：wrapper 接入，复用旧 web/pages 逻辑，依赖 next/* 适配层；待原生改造
- **ChatContext 拆分**：6 个 Zustand stores，ChatContextProvider 改为兼容层
- **next/* 适配层**：4 个 shim 文件，17 个 next 依赖组件零改动复用
- **shell tailwind 扩展**：镜像旧 tailwind 主题，content 扫描 web/components 与 web/new-components
- **@types/react 升级**：18.2.14 → ^18.3.0，对齐 pnpm override

## 进行中单元

### Construct 闭环 #2 — app + knowledge

- **Routes**: `/construct/app`、`/construct/app/extra`、`/construct/knowledge`、`/construct/knowledge/chunk`
- **Owner**: DB-GPT frontend
- **Status**: inventory（2026-07-17 盘点中）

#### /construct/app 盘点

| 维度 | 内容 |
|---|---|
| 旧文件 | `web/pages/construct/app/index.tsx`（468 行） |
| API | `getAppList`, `delApp`, `publishApp`, `unPublishApp`, `newDialogue`, `getAppAdmins`, `updateAppAdmins` |
| 状态 | useState（open/spinning/activeKey/apps/modalType/filterValue/admins）+ useRef（totalRef） |
| 路由 | `next/router` `query.openModal`，push `/construct/app/extra`、`/chat` |
| ChatContext | `model`, `setAgent`, `setCurrentDialogInfo` |
| localStorage | 读写 `new_app_info`；写 `cur_dialog_info` |
| 重依赖 | `copy-to-clipboard`, `ahooks useDebounceFn` |
| 共享组件 | `ConstructLayout`, `BlurredCard`, `CreateAppModal`（在 `app/components/`） |

#### /construct/app/extra 盘点

| 维度 | 内容 |
|---|---|
| 旧文件 | `web/pages/construct/app/extra/index.tsx`（252 行） |
| API | `updateApp` |
| 状态 | useState（loading/open/dataReady）+ useRef（appParams, initialParams） |
| 路由 | `next/router` replace `/construct/app` |
| localStorage | 读 `new_app_info`（跨页 handoff） |
| 重依赖 | `lodash` |
| 子组件 | `AwelLayout`, `NativeApp`, `RecommendQuestions`, `AutoPlan`（在 `extra/components/`） |
| 共享 | `CreateAppModal`（edit 模式） |

#### /construct/knowledge 盘点

| 维度 | 内容 |
|---|---|
| 旧文件 | `web/pages/construct/knowledge/index.tsx`（288 行） |
| API | `getSpaceList`, `getSpaceConfig`, `delSpace`, `newDialogue` |
| 状态 | useState（spaceList/isAddShow/isPanelShow/currentSpace/activeStep/spaceName/files/docType/addStatus/loading/spaceConfig） |
| 路由 | `next/router` push `/chat` |
| ChatContext | `setCurrentDialogInfo` |
| localStorage | 读写 `cur_space_id`；写 `cur_dialog_info` |
| 重依赖 | `lodash debounce` |
| 共享组件 | `ConstructLayout`, `BlurredCard`, `DocPanel`, `DocTypeForm`, `DocUploadForm`, `Segmentation`, `SpaceForm`（在 `web/components/knowledge/`） |

#### /construct/knowledge/chunk 盘点

| 维度 | 内容 |
|---|---|
| 旧文件 | `web/pages/construct/knowledge/chunk/index.tsx` |
| API | `getChunkList`, `chunkAddQuestion` |
| 路由 | `next/router`（含 `spaceName`、`id` query） |
| 重依赖 | `MarkDownContext`（含 `@antv/gpt-vis`） |
| 待确认 | 是否仍被使用、入口在哪 |

#### 跨页 localStorage key 共享情况

| key | 写入方 | 读取方 | 迁移策略 |
|---|---|---|---|
| `new_app_info` | `/construct/app`（列表）、`CreateAppModal` | `/construct/app/extra`、`CreateAppModal` | 改为 navigate state |
| `cur_dialog_info` | `/construct/app`、`/construct/knowledge`、`/data_index`、`ChatSider` 等 | `ChatContextProvider` 启动时读 | **跨域共享**，暂保留 localStorage；待 chat 域原生改造时统一 |
| `cur_space_id` | `/construct/knowledge`、`SpaceForm` | `/construct/knowledge` | 改为 navigate state 或省略（仅当前页用） |

## 后续迁移顺序

按 ADR 0002 §推荐迁移顺序"领域闭环优先、重页面靠后"推进：

### 第 1 批：补齐 Construct 导航闭环（进行中）

1. **Construct 闭环 #2**（当前）：app + app/extra + knowledge + knowledge/chunk
2. **Construct 闭环 #3**：database、connectors、scheduled-tasks（含 `[taskId]`）、dbgpts、skills、permission、construct 首页

### 第 2 批：CRUD 与查询型领域

3. `/data_index`
4. `/evaluation`
5. `/conversations` 原生改造（当前为 wrapper）

### 第 3 批：高交互领域

6. `/chat` 原生改造（当前为 wrapper，含 SSE、Monaco、图表）
7. `/construct/flow`（AWEL 画布，G6 重依赖）
8. `/` 首页原生改造
9. `/mobile/chat`、`/share/[token]`、`/playground`

### 第 4 批：全路由完成后统一清理

10. 删除 Next.js / Webpack 插件 / `next export` / 旧 Document
11. 删除 next/* 适配层（`web/shell/app/lib/next-compat/`）
12. 删除旧 `web/new-components/layout/Construct.tsx`（待所有 construct 子页面迁移完）
13. 删除旧 lockfile（yarn/npm），统一到 pnpm
14. 接入 OpenAPI 类型生成

## 基线指标

| 指标 | 当前值 | 备注 |
|---|---|---|
| web `.typecheck-baseline.txt` | 143 errors | Construct 闭环 #1 完成后从 147 降到 143 |
| shell typecheck | 182 errors | 全部来自 `../pages/`、`../utils/`、`../new-components/` 预存；shell 自身代码 0 错误 |
| shell build 冷构建 | ~9 分钟（client 8m52s + server 39s） | 与历史一致，无增长 |
| shell 最大 chunk | 18MB（`helper-*.js`） | 迁移期可接受，后续按路由 code-splitting |
| pnpm override `@types/react` | ^18.3.0 | web/package.json 已对齐 |

## 迁移单元 PR 模板

每个迁移单元完成时按 ADR 0002 §PR 说明模板提交：

```markdown
## Migration unit
- Domain/routes:
- Owner:
- Status: inventory / bridged / native / complete

## Legacy removed
- Pages/components:
- APIs/state/storage:
- Dependencies/shims:

## Verification
- typecheck:
- lint/test/smoke:
- shell build:
- cold build baseline -> current:
- initial/route chunk baseline -> current:

## Remaining compatibility debt
- Item, owner, removal condition:
```
