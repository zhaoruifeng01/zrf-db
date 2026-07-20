# 前端路由迁移进度

- **Status:** Living document（随迁移推进持续更新）⚠️ 已被现实核查修正,见下方声明
- **Date:** 2026-07-17 起维护
- **Owner:** DB-GPT frontend
- **Related:** `adr/0001-unify-frontend-stack.md`（决策）、`adr/0002-frontend-route-migration-playbook.md`（执行规范）、`adr/frontend-migration-reality-check.md`（**现实核查,优先阅读**）

> ## ⚠️ 重要更正(2026-07-20)
>
> 本文档下方把全部 34 条路由标为 `complete`,但该状态语义是"路由模块已建 + 旧 Next page 已删 + 静态门禁通过",**不含"用户可在 UI 中到达并使用该功能"**。
>
> **运行时实际情况:跑起来的 shell 只能渲染一个聊天界面(`/`、`/chat`),其余 28 条路由虽有代码但 UI 无入口可达。** 根因是 shell 根布局 `root.tsx` 只是 provider 栈 + `<Outlet/>`,从未接入全局导航(旧 `new-components/layout/{Header,Sider}.tsx` 在 shell 中零引用),且 `ChatSider` 只跳 `/chat`、不导航到其他模块。
>
> 因此真实迁移完成度约 40%(路由+feature 源码层完成,应用壳/全局导航层缺失,Next.js 框架未拆除)。**在本文档与 `frontend-migration-reality-check.md` 冲突时,以 reality-check 为准。** 在 shell 能完整替代旧 app 之前,`old_web` 产物与 legacy 启动模式必须保留。
>
> 完整现实清单、证据链与可达性真值表见 [`adr/frontend-migration-reality-check.md`](./frontend-migration-reality-check.md)。

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
| `/chat` | complete | 中期 chat | 2026-07-20 | shell 原生 chat feature；阶段 3 已删除旧 Next page，旧 API hook 作为组件级债务保留 |
| `/conversations` | complete | 中期 chat | 2026-07-20 | shell 原生任务列表；阶段 3 已删除旧 Next page，chat 详情仍跳 `/` |
| `/` | complete | 中期 chat | 2026-07-20 | 复用 shell ChatPage 默认页；阶段 3 已删除旧 Next page |
| `/construct/models` | complete | Construct 闭环 #1 | 2026-07-17 | ADR 0002 首个完整单元 |
| `/construct/prompt` | complete | Construct 闭环 #1 | 2026-07-17 | 含 list + add/edit |
| `/construct/prompt/:type` | complete | Construct 闭环 #1 | 2026-07-17 | Markdown/JsonView lazy |
| `/construct/app` | complete | Construct 闭环 #2 | 2026-07-20 | shell 原生页面主体；旧 app page 与 app 子组件已迁移/删除 |
| `/construct/app/extra` | complete | Construct 闭环 #2 | 2026-07-20 | shell 原生页面主体；旧 extra page 与子组件路径已迁移/删除 |
| `/construct/knowledge` | complete | Construct 闭环 #2 | 2026-07-20 | shell 原生页面主体；旧 Next page 已删除，knowledge 子组件兼容债后续组件级清理 |
| `/construct/knowledge/chunk` | complete | Construct 闭环 #2 | 2026-07-20 | shell 原生 chunk 页面；旧 Next page 已删除 |
| `/construct/database` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生页面主体；旧 Next page 已删除，FormDialog 兼容债后续组件级清理 |
| `/construct/flow` | complete | 高交互 | 2026-07-20 | shell 原生列表页；旧 flow pages 已删除，flow 共享组件债务后续清理 |
| `/construct/flow/canvas` | complete | 高交互 | 2026-07-20 | shell 原生画布页；旧 flow page 已删除 |
| `/construct/flow/libro` | complete | 高交互 | 2026-07-20 | shell 原生 iframe 壳；旧 flow page 已删除 |
| `/construct/connectors` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生页面主体；旧 Next page 已删除，ConnectorForm/Card 兼容债后续清理 |
| `/construct/scheduled-tasks` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生列表页；旧 Next page 已删除 |
| `/construct/scheduled-tasks/:taskId` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生详情页；旧 Next page 已删除 |
| `/construct/dbgpts` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生页面主体；旧 Next page 已删除 |
| `/construct/skills` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生页面主体；旧 Next page 已删除 |
| `/construct/permission` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生权限壳；旧 Next page 已删除 |
| `/construct/agent` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生兼容重定向到 `/construct/dbgpts`；旧 Next page 已删除 |
| `/construct` | complete | Construct 闭环 #3 | 2026-07-20 | shell 原生重定向到 `/construct/app`；旧 Next page 已删除 |
| `/data_index` | complete | CRUD/查询 | 2026-07-20 | shell 原生应用广场页；旧 Next page 已删除，chat handoff 兼容债后续清理 |
| `/evaluation` | complete | CRUD/查询 | 2026-07-20 | shell 原生评测/数据集页；旧 Next page 已删除 |
| `/knowledge/graph` | complete | 高交互 | 2026-07-20 | shell 原生图谱页；旧 Next page 已删除 |
| `/models_evaluation` | complete | CRUD/查询 | 2026-07-20 | shell 原生模型评测任务页；旧 Next page 已删除 |
| `/models_evaluation/datasets` | complete | CRUD/查询 | 2026-07-20 | shell 原生 benchmark 数据集浏览页；旧 Next page 已删除 |
| `/models_evaluation/:code` | complete | CRUD/查询 | 2026-07-20 | shell 原生评测结果详情页；旧 Next page 已删除 |
| `/mobile/chat` | complete | 高交互 | 2026-07-20 | shell 原生移动 chat route；旧 Next page 与组件已删除 |
| `/share/:token` | complete | 高交互 | 2026-07-20 | shell 原生对话回放页；旧 Next page 已删除 |
| `/playground` | complete | 高交互 | 2026-07-20 | shell 原生 ChatPage demo；旧 Next page 已删除 |

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
- **/chat、/**：shell 原生 ChatPage feature；`/` 复用默认 chat 页，不再跳 `/health`
- **/conversations**：shell 原生任务列表，`query_page/delete` 已迁入 `conversations` feature；chat 详情仍跳 `/`
- **ChatContext 拆分**：6 个 Zustand stores，ChatContextProvider 改为兼容层
- **Next import 清理**：旧 `next/router`、`next/navigation`、`next/image`、`next/dynamic` 代码 import 已替换为 shell-local 兼容 helper，原 `next-compat` 目录已删除
- **shell tailwind 扩展**：镜像旧 tailwind 主题，content 扫描 web/components 与 web/new-components
- **@types/react 升级**：18.2.14 → ^18.3.0，对齐 pnpm override

## 进行中单元

### Construct 闭环 #2 — app + knowledge

- **Routes**: `/construct/app`、`/construct/app/extra`、`/construct/knowledge`、`/construct/knowledge/chunk`
- **Owner**: DB-GPT frontend
- **Status**: complete（2026-07-20：旧 Next page 删除，app/extra 子组件迁入 shell feature，shell 门禁通过）

#### 2026-07-20 native 改造进展

- **迁移文件**:
  - `web/shell/app/features/construct-app/{api.ts, query-keys.ts, queries.ts, pages/AppListPage.tsx, pages/AppExtraPage.tsx}`
  - `web/shell/app/features/construct-app/components/{create-app-modal,extra/**}`（从旧 `web/pages/construct/app/**` 迁入）
  - `web/shell/app/features/construct-knowledge/{api.ts, query-keys.ts, queries.ts, pages/KnowledgePage.tsx, pages/KnowledgeChunkPage.tsx}`
  - `web/shell/app/routes/{construct-app, construct-app-extra, construct-knowledge, construct-knowledge-chunk}.tsx`
  - `web/shell/app/routes.ts` 注册 4 条 construct route
  - `web/shared/src/storage/keys.ts` 注册 `new_app_info`、`cur_dialog_info`、`cur_space_id` 兼容 key

- **关键改造**:
  - `/construct/app`：`useRequest`/`apiInterceptors` 页面主体 → TanStack Query + `@dbgpt/shared` API；`next/router` → React Router；搜索改为本页 debounce state；发布、删除、列表刷新走 mutation invalidation。
  - `/construct/app/extra`：页面壳改为 React Router `location.state` + storage fallback；更新应用走 `useUpdateApp` mutation；配置子表单迁入 `construct-app/components/extra/**`。
  - `CreateAppModal`：迁入 `construct-app/components/create-app-modal`；`next/router` → React Router `useNavigate`；`next/image` → `@/app/image-compat`；`localStorage` 字符串 key → `@dbgpt/shared` storage key；create/update/team-mode 接入 shell feature API/query。
  - `/construct/knowledge`：空间列表、配置、删除、新建对话进入 shell feature；`cur_dialog_info`/`cur_space_id` 通过共享 storage key 写入以兼容 chat 与旧子组件。
  - `/construct/knowledge/chunk`：查询参数由 React Router 管理；chunk 列表、搜索、分页、问题保存进入 TanStack Query；`MarkdownContext` lazy import，避免进入 route 初始 chunk。
  - 复用旧子组件暴露的严格类型问题已最小修复：`NativeApp.tsx`、`ResourcesCardV2.tsx`、`space-form.tsx`、`segmentation.tsx`、`strategy-form.tsx`。

- **Verification**:
  - shell typecheck: 通过（2026-07-20 阶段 3 批量清理后全图 `npm run typecheck -- --pretty false` 通过）。
  - shell lint: 通过（`npm run lint`）。
  - shell test: 通过（Vitest smoke 1 test）。
  - shell build: 通过；client 6m48s + server 21s。
  - 2026-07-20 阶段 3 app 子组件迁移后：删除 `web/pages/construct/app/**` 与 `web/pages/construct/knowledge/**` 旧代码；最终全图 lint/typecheck/test 均通过。
  - 新增 route chunk: `construct-app` 8.06 kB、`construct-app-extra` 166.70 kB、`construct-knowledge` 67.22 kB、`construct-knowledge-chunk` 13.96 kB。
  - 仍有既有超大 chunk 警告：`MarkdownContext` 1.51 MB、`monaco-editor` 1.74 MB、`helper` 18.98 MB 等，非本单元新增根因。

- **Remaining compatibility debt**:
  - extra 配置子表单已在 `web/shell/app/features/construct-app/components/extra/**`，但内部仍有旧 `apiInterceptors` 与 `useRequest`，待组件级原生化。
  - `DocPanel`、`DocUploadForm`、`Segmentation`、`SpaceForm` 等知识库子组件仍复用 `web/components/knowledge/**`，内部旧 API、`useRequest` 和局部 `localStorage` 待原生化。
  - `cur_dialog_info` 必须保留到 chat 域原生迁移完成；删除条件是 `/chat` 不再从 localStorage bootstrap 当前会话。

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

### Construct 闭环 #3 — database + dbgpts + construct tail

- **Routes**: `/construct`、`/construct/database`、`/construct/dbgpts`、`/construct/permission`、`/construct/connectors`、`/construct/skills`、`/construct/scheduled-tasks`、`/construct/scheduled-tasks/:taskId`、`/construct/flow`、`/construct/flow/canvas`、`/construct/flow/libro`
- **Owner**: DB-GPT frontend
- **Status**: complete（2026-07-20：database/dbgpts/permission/construct index/connectors/skills/scheduled/flow list/canvas/libro 旧 Next page 已删除，shell 门禁通过）

#### 2026-07-20 迁移进展

- **迁移文件**:
  - `web/shell/app/features/construct-database/{api.ts, query-keys.ts, queries.ts, pages/DatabasePage.tsx}`
  - `web/shell/app/features/construct-dbgpts/{api.ts, query-keys.ts, queries.ts, pages/DbgptsPage.tsx}`
  - `web/shell/app/features/construct-permission/pages/PermissionPage.tsx`
  - `web/shell/app/features/construct-connectors/{api.ts, query-keys.ts, queries.ts, pages/ConnectorsPage.tsx}`
  - `web/shell/app/features/construct-skills/{api.ts, query-keys.ts, queries.ts, types.ts, pages/SkillsPage.tsx}`
  - `web/shell/app/features/construct-scheduled-tasks/{api.ts, query-keys.ts, queries.ts, components/EditScheduledTaskDrawer.tsx, components/TaskRunsTable.tsx, pages/ScheduledTasksPage.tsx, pages/ScheduledTaskDetailPage.tsx}`
  - `web/shell/app/features/construct-flow/{api.ts, query-keys.ts, queries.ts, pages/FlowListPage.tsx, pages/FlowCanvasPage.tsx, pages/FlowLibroPage.tsx}`
  - `web/shell/app/routes/{construct-index, construct-database, construct-dbgpts, construct-permission}.tsx`
  - `web/shell/app/routes/{construct-connectors, construct-skills, construct-scheduled-tasks, construct-scheduled-task-detail, construct-flow, construct-flow-canvas, construct-flow-libro}.tsx`

- **关键改造**:
  - `/construct/database`：列表、支持类型、删除、刷新进入 shell feature + TanStack Query；旧 `FormDialog` 暂兼容复用。
  - `/construct/dbgpts`：market/my 列表、刷新、安装、卸载进入 shell feature + TanStack Query。
  - `/construct/permission`：移除 `next/router` 依赖，使用 React Router 与共享 storage key 读取用户角色。
  - `/construct`：shell 原生重定向到 `/construct/app`。
  - `/construct/connectors`：列表、catalog、create/update/delete/test/tools 进入 shell feature + TanStack Query；route 不再 import 旧 `web/pages/construct/connectors`。
  - `ConnectorToolsModal` 数据入口改为 hook 注入；shell route 使用 native query，legacy 旧页显式传入旧 `useConnectorTools` 保持兼容。
  - `/construct/skills`：list/detail/upload/import_github 进入 shell feature + TanStack Query；移除本 route 对 `ctx-axios` 与 `process.env.API_BASE_URL` 的依赖；详情 markdown 改为 lazy。
  - `/construct/scheduled-tasks`：list/toggle/delete 进入 shell feature + TanStack Query；`next/router` → React Router；编辑抽屉使用 `useUsableModels` 替代 `ChatContext.modelList`。
  - `/construct/scheduled-tasks/:taskId`：detail/toggle/runs 进入 shell feature + TanStack Query；connector 名称复用 native connector query；执行历史跳转使用 React Router。
  - `/construct/flow`：list/copy/delete/newDialogue 进入 shell feature + TanStack Query；`next/router`/`querystring` → React Router/URLSearchParams；新增 `/construct/flow/canvas`、`/construct/flow/libro` 子路由接入以保留列表页跳转。
  - `/construct/flow/canvas`：ReactFlow 页面壳进入 shell feature；`next/navigation`/旧 page import → React Router `useSearchParams` + `useFlowDetail`；import/template modal 通过 callback 回写画布数据，解除旧 `CanvasWrapper` 反向依赖。
  - `/construct/flow/libro`：iframe 页面壳进入 shell feature；`ChatContext.theme` → `usePreferences`；浏览器端安全计算 libro origin，并继续同步 i18n 与 theme 到 `5671`。
  - 为 bridged 页面暴露的严格类型问题做最小修复：database form、connector form/polling、scheduled task controls、`utils/flow.ts`、flow canvas modal/node/renderer。

- **Verification**:
  - shell typecheck: 通过（2026-07-20 阶段 3 批量清理后全图 `npm run typecheck -- --pretty false` 通过）。
  - shell lint: 通过（`npm run lint`）。
  - shell test: 通过（Vitest smoke 1 test；2026-07-20 flow canvas/libro native 后复跑通过）。
  - shell build: 由 `scripts/dbgpt-start.sh` 最终启动门禁执行 shell build 并同步到 `packages/dbgpt-app/src/dbgpt_app/static/web`。

- **Remaining compatibility debt**:
  - `FormDialog`/database 表单仍使用旧 `apiInterceptors`。
  - 旧 `use-connector-api` 仍被 legacy agent/共享组件链路引用；`/construct/connectors` shell route 已不再依赖它。
  - 旧 connectors、scheduled-tasks、skills、database、dbgpts、permission、flow、construct index pages 已在阶段 3 删除；shell route 不再引用这些 Next page。
  - flow list/canvas/libro 已迁入 shell feature；`AddNodesSider`、`CanvasNode`、`SaveFlowModal`、`FlowTemplateModal`、`ImportFlowModal` 等共享组件仍在 `web/components/flow/**`，内部旧 API、localStorage fallback 与兼容 props 待组件级原生化。

### 顶层覆盖 — CRUD/评测/高交互入口

- **Routes**: `/`、`/chat`、`/conversations`、`/data_index`、`/evaluation`、`/knowledge/graph`、`/models_evaluation`、`/models_evaluation/datasets`、`/models_evaluation/:code`、`/mobile/chat`、`/share/:token`、`/playground`
- **Owner**: DB-GPT frontend
- **Status**: complete（2026-07-20 顶层 bridged route 已清零；对应旧 Next page 与 mobile chat 旧组件已删除，shell 门禁通过）

#### 2026-07-20 接入进展

- **迁移文件**:
  - `web/shell/app/features/data-index/{api.ts, query-keys.ts, queries.ts, pages/DataIndexPage.tsx}`
  - `web/shell/app/features/evaluation/{api.ts, query-keys.ts, queries.ts, pages/EvaluationPage.tsx}`
  - `web/shell/app/features/conversations/{api.ts, query-keys.ts, queries.ts, pages/ConversationsPage.tsx}`
  - `web/shell/app/features/models-evaluation/{api.ts, query-keys.ts, queries.ts, components/NewBenchmarkTaskModal.tsx, components/MetricBars.tsx, pages/ModelsEvaluationPage.tsx, pages/ModelsEvaluationDatasetsPage.tsx, pages/ModelsEvaluationDetailPage.tsx}`
  - `web/shell/app/features/knowledge-graph/{api.ts, query-keys.ts, queries.ts, pages/KnowledgeGraphPage.tsx}`
  - `web/shell/app/features/playground/pages/PlaygroundPage.tsx`
  - `web/shell/app/features/share/pages/SharePage.tsx`
  - `web/shell/app/features/mobile-chat/{index.tsx, components/**}`
  - `web/shell/app/features/chat/pages/ChatPage.tsx`
  - `web/app/{chat-content-context.ts,mobile-chat-context.ts}`（从旧 page 抽离共享 Context）
  - `web/shell/app/routes/{index,chat,conversations,data-index,evaluation,knowledge-graph,models-evaluation,models-evaluation-datasets,models-evaluation-detail,mobile-chat,share,playground}.tsx`
  - `web/shell/app/lib/{router-compat.ts,image-compat.tsx,dynamic-compat.tsx}` 提供 shell-local 兼容 helper

- **关键改造**:
  - `/data_index`：app list/hot list/collect/uncollect/newDialogue 进入 shell feature + TanStack Query；`next/router` → React Router；旧 `useRequest`/`apiInterceptors` 移除；分页查询替代旧 virtualized 无限滚动，保留推荐/全部/收藏、搜索、收藏切换、创建应用、进入 chat。
  - `/evaluation`：evaluations/datasets/metrics/storage-types/scene options 进入 shell feature + TanStack Query；旧 `useRequest`/`apiInterceptors` 移除；保留评测数据/数据集双表、发起评测、添加/编辑数据集、评分明细、删除、上传 FormData 与下载 blob。
  - `/evaluation` 的 `storage_type` 选择恢复为原生查询 `getStorageTypes`，并保留 `oss`/`db` 默认兜底，修复旧页因注释掉 storage type 请求导致添加数据集无法选择来源的问题。
  - `/conversations`：chat_react_agent 会话分页和删除进入 shell feature + TanStack Query；旧 `useRequest`/`apiInterceptors` 移除；搜索仍保持本页内过滤，详情继续跳转到 `/`。
  - `/models_evaluation`：benchmark task list/create 进入 shell feature + TanStack Query；旧 `EvaluationProvider`/`useEvaluationList`/`NewEvaluationModal` 和 `next/router` 依赖移除；新建任务弹窗复用已迁移的 `useUsableModels`。
  - `/models_evaluation/datasets`：benchmark datasets/tables/table rows 进入 shell feature；Tree 懒加载表结构通过 TanStack Query `fetchQuery` 缓存，表数据通过 query 管理；旧 `NavTo`/`apiInterceptors` 移除。
  - `/models_evaluation/:code`：result detail 进入 shell feature + TanStack Query；`next/router` → React Router `useParams`/`useNavigate`；原 `@ant-design/plots` 柱状图替换为轻量 shell 原生指标条，避免本 route 额外拉入图表重依赖。
  - `/knowledge/graph`：graphvis API 进入 shell feature + TanStack Query；`next/router` → React Router `useSearchParams`/`useNavigate`；Graphin/G6 渲染逻辑保留在 route feature 内，不再 import 旧 page。
  - `/playground`：ChatPage demo 进入 shell feature；route 不再 import 旧 `web/pages/playground.tsx`。
  - `/share/:token`：对话回放页进入 shell feature；`next/router` → React Router `useParams`；`next/head` → `document.title`；share API 使用同源 `/api/v1/chat/share/:token`。
  - `/mobile/chat`：移动端 chat 页面与子组件进入 shell feature；`next/navigation` → React Router `useSearchParams`；`next/dynamic` 移除；route 不再 import 旧 `web/pages/mobile/chat`；子组件不再引用旧 `@/pages/chat` context。
  - `/chat`：主 chat 实现从 route 模块迁入 `features/chat/pages/ChatPage.tsx`；`next/navigation` → React Router `useSearchParams`；`next/dynamic` → React `lazy`/`Suspense`；route 文件变为薄壳。
  - `/chat` / `/mobile/chat` 阶段 3：`ChatContentContext`、`MobileChatContext` 从旧 page 抽离到 `web/app/**-context.ts`，共享组件不再 import `@/pages/chat` 或 `@/pages/mobile/chat`。
  - `/`：复用 shell ChatPage 默认态，不再作为临时 health redirect。
  - 顶层 bridged route 已清零；阶段 3 批量删除旧 `web/pages/{index,chat,conversations,data_index,evaluation,knowledge/graph,models_evaluation,mobile/chat,playground,share}`。
  - 为接入暴露的基础类型问题做最小修复：`data_index`、`evaluation`、`knowledge/graph`、`mobile/chat`、`models_evaluation/datasets`、`playground`、`share/[token]`。

- **Verification**:
  - shell typecheck: 通过（2026-07-20 阶段 3 批量清理后全图 `npm run typecheck -- --pretty false` 通过）。
  - shell lint: 通过（`npm run lint`）。
  - shell test: 通过（Vitest smoke 1 test；2026-07-20 bridged route 清零后统一复跑通过）。
  - 2026-07-20 阶段 3 批量删除后：`web/pages` 代码文件为 0；`next/router`、`next/navigation`、`next/image`、`next/dynamic` 代码 import 清零；原 `web/shell/app/lib/next-compat/` 删除。
  - 后端静态挂载已兼容 Vite/React Router SPA 产物：条件挂载旧 `_next/static`，新产物挂载 `/assets`，未知前端路由 fallback 到 `index.html`。
  - 根布局新增客户端 mount gate，避免 AntD CSS-in-JS 在 SPA hydration 第一拍找不到 style 容器而触发 `Cannot read properties of null (reading 'children')`。
  - dev HTTP smoke: `npm run dev` 自动使用 `http://localhost:5175/`；`/chat`、`/mobile/chat`、`/playground`、`/share/test-token` 均返回 200。
  - production start smoke: `zsh scripts/dbgpt-start.sh` 初次被旧 web Prettier 门禁阻断，已对报错文件做限定格式化；因当前 MySQL 缺 `governance_metadata_*` 表，`configs/dbgpt-proxy-openai.toml` 临时设置 `[[serves]] type="governance" enabled=false` 跳过治理 schema 检查。重启后 `GET /api/health` 返回 `{"status":"ready"}`，`/`、`/chat/`、`/mobile/chat/` 静态页面返回 200。
  - shell build: 由 `scripts/dbgpt-start.sh` 最终启动门禁执行 shell build 并同步静态产物。

- **Remaining compatibility debt**:
  - `/data_index` 进入 chat 仍写 `cur_dialog_info` 并调用 `ChatContext.setAgent/setCurrentDialogInfo`，删除条件是 `/chat` 原生化后统一 chat handoff 状态。
  - `/conversations` 详情入口仍跳 `/`，删除条件是 `/chat` 与 `/` chat default/detail 路由完成原生拆分后统一入口。
  - `BlurredCard` 仍来自 `web/new-components/common/blurredCard`，内部已切到 `@/app/image-compat`；删除条件是通用卡片组件迁入 shell/native 后移除兼容 helper。
  - `/evaluation` 为保持行为兼容仍是单文件大页；后续可拆分 datasets/evaluations 表格与弹窗组件，但不影响 route native 状态。
  - `/mobile/chat` feature 内仍有旧 `apiInterceptors`/`useRequest` 调用；后续统一迁到 shell-native API/query，但 route 已脱离旧 page wrapper。
  - `/chat` feature 内仍有旧 `apiInterceptors`/`useRequest`、`useChat` 与 localStorage prompt handoff；后续统一迁到 shell-native API/query/SSE 状态层。
  - 旧顶层 Next pages、Next 框架壳、`/login` 旧入口和 `/construct/agent` 已删除；`web/pages` 当前无代码文件。
  - `configs/dbgpt-proxy-openai.toml` 暂时关闭 governance serve 以支持本地/当前库启动；删除条件是当前连接的 MySQL 补齐 `governance_metadata_*` 表并重新启用治理服务。

## 后续迁移顺序

按 ADR 0002 §推荐迁移顺序"领域闭环优先、重页面靠后"推进：

### 第 1 批：补齐 Construct 导航闭环（进行中）

1. **Construct 闭环 #2**：app + app/extra + knowledge + knowledge/chunk（complete；旧子组件清理转入组件级债务）
2. **Construct 闭环 #3**：database/dbgpts/permission/connectors/skills/scheduled-tasks/flow list/canvas/libro（complete；flow/database/connectors 等共享组件继续原生化）

### 第 2 批：CRUD 与查询型领域

3. 顶层 bridged route 已清零并 complete；后续只保留 API/query 与共享组件拆分优化

### 第 3 批：高交互领域

6. `/chat` API/query/SSE 状态层清理
7. flow 共享组件原生化与 ReactFlow 重依赖拆包优化

### 第 4 批：全路由完成后统一清理

10. 删除 Next.js / Webpack 插件 / `next export` 相关配置依赖
11. 收敛 shell-local router/image/dynamic 兼容 helper 的调用面，逐步替换为 React Router、原生 `img`、React `lazy`
12. 删除旧 `web/new-components/layout/Construct.tsx`（待所有 construct 子页面迁移完）
13. 删除旧 lockfile（yarn/npm），统一到 pnpm
14. 接入 OpenAPI 类型生成

## 基线指标

| 指标 | 当前值 | 备注 |
|---|---|---|
| web `.typecheck-baseline.txt` | 143 errors | Construct 闭环 #1 完成后从 147 降到 143 |
| shell typecheck | pass | 2026-07-20 阶段 3 批量清理后全图通过 |
| shell lint | pass | 2026-07-20 阶段 3 批量清理后全图通过 |
| shell test | pass | 2026-07-20 阶段 3 后 Vitest smoke 1 test 通过 |
| shell build 冷构建 | 由启动脚本执行 | `scripts/dbgpt-start.sh` 负责 pnpm workspace 安装、`web/shell` build 并同步静态产物 |
| shell 最大 chunk | 待启动脚本产物采集 | 后续从 `web/shell/build/client/assets` 或 CI 产物分析 |
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
