# ADR 0002: 前端路由迁移执行规范

- **Status:** Accepted
- **Date:** 2026-07-17
- **Decision owner:** DB-GPT frontend
- **Related:** `adr/0001-unify-frontend-stack.md`、`架构评审-2026-07-17.md`

## Context

ADR 0001 已确定使用 React Router Framework Mode + Vite，通过 strangler 模式逐路由替换旧 Next.js 应用。迁移初期允许 shell route 使用 `React.lazy` 引用旧 `web/pages/**`，以较低风险验证路由、鉴权、静态资源和部署链路。

这种 wrapper 只完成了流量入口切换，旧页面、Next 兼容层、旧 API、旧状态管理和重依赖仍然存在。若后续页面都停在 wrapper 阶段，Vite 生产构建仍需转换所有可达模块，旧链与新链长期并存，构建时间、包体和类型错误会持续增加。

因此需要统一每个迁移单元的步骤、目录边界、完成定义和质量门禁。

## Decision

后续迁移统一采用“**一个领域切片、四个阶段、一次完整删除**”的执行模型。迁移单元优先选择可独立验收的业务领域；小领域可以是一条路由，大领域应拆成多条路由但共享同一个 feature 模块。

### 目标目录

```text
web/shell/app/
  routes/
    <route>.tsx                 # 薄路由：meta、loader/action、页面装配
  features/
    <domain>/
      api.ts                    # 领域 API，调用共享 client
      query-keys.ts             # TanStack Query key factory
      queries.ts                # useQuery/useMutation 封装
      types.ts                  # 领域 DTO 与视图模型
      store.ts                  # 可选，仅放跨组件客户端状态
      components/               # 领域组件
      pages/                    # 页面主体
      tests/                    # 领域行为测试
```

通用能力继续放在 `app/lib/`、`@dbgpt/shared` 或 design tokens 中。禁止为了单个页面把领域逻辑放进全局 provider，也禁止通过 feature 根目录的宽泛 barrel export 暴露整个领域。

## 四阶段迁移流程

### 阶段 0：盘点与基线

迁移前建立一份领域清单，至少包含：

1. 旧路由、动态参数、查询参数、重定向和深链行为。
2. 页面依赖的 API、SSE、上传下载和错误处理。
3. 服务端状态、客户端状态、URL 状态和 localStorage key。
4. 鉴权、角色、主题、国际化、布局和全局副作用。
5. Monaco、G6、S2、Cytoscape、ANTLR、Markdown 编辑器等重依赖。
6. 当前关键操作、空态、加载态、失败态和权限态。
7. 构建时间、初始包和该路由异步 chunk 的迁移前基线。

盘点结果用于决定迁移粒度。若一个页面与相邻页面共享 API、状态和布局，应作为同一领域切片迁移，避免跨新旧边界共享可变状态。

### 阶段 1：临时接入

在 `web/shell/app/routes.ts` 注册新 route module。允许 route 使用 lazy wrapper 引用旧页面，以验证 React Router 下的导航、刷新、动态参数、鉴权和静态资源。

临时接入必须遵守：

- wrapper 文件只负责参数适配和 Suspense，不新增业务逻辑。
- `next/*` shim 只实现已有调用所需的最小语义；新增 shim API 必须记录对应删除条件。
- 不把重依赖导入 `root.tsx`、全局 provider、共享 layout 或公共 barrel。
- 不因 wrapper 进入 shell 而把状态标记为“迁移完成”。此时状态统一记为“已接入”。
- 临时接入应与阶段 2、3 位于同一迭代；不能完成时必须建立明确的后续任务和 owner。

### 阶段 2：原生改造

将旧页面改造成 shell 原生 feature，按以下边界落地：

| 关注点 | 统一做法 |
|---|---|
| 路由状态 | 路径参数和查询参数由 React Router 管理，不复制到 Zustand |
| 服务端状态 | TanStack Query 管理查询、缓存、重试、失效和 mutation |
| 客户端共享状态 | Zustand 只管理跨组件、跨路由且非服务端来源的状态 |
| 局部交互状态 | 使用组件 `useState`/`useReducer` |
| API | 通过共享 API client 和领域 `api.ts`，禁止页面新建 Axios 实例 |
| 持久化 | 通过统一 storage adapter，禁止组件直接散写 localStorage |
| UI | Ant Design 负责交互组件；Tailwind 只做布局、间距和排版 |
| 国际化 | 使用共享 i18n 资源，不在页面硬编码重复文案 |
| 错误处理 | route error boundary 处理页面故障，Query 展示可恢复请求错误 |

React Router route module 本身就是代码拆分边界。原生 route 可直接导入所属 feature；只有页面内部的可选重能力才继续使用动态导入，例如编辑器弹窗、图谱画布、报表导出或仅某个 tab 使用的可视化。

重依赖动态加载示意：

```tsx
const GraphEditor = lazy(() => import('../components/GraphEditor'));

export function FlowPage() {
  return isEditorOpen ? (
    <Suspense fallback={<PageSkeleton />}>
      <GraphEditor />
    </Suspense>
  ) : (
    <FlowList />
  );
}
```

不要仅为了拆出更多文件配置 `manualChunks`。先通过产物分析确认依赖归属；`manualChunks` 用于稳定浏览器缓存和处理确切的共享依赖，不作为默认构建加速手段。

### 阶段 3：切换与删除

原生页面通过验收后，在同一迁移单元内完成清理：

1. 删除对应 `web/pages/**` 旧页面和仅由它使用的旧组件。
2. 删除该领域对 `next/router`、`next/navigation`、`next/image`、`next/dynamic` 的引用。
3. 删除旧 API、旧 Context 字段、旧 localStorage 访问和重复 DTO。
4. 删除已无引用的依赖、样式、静态资源和兼容 shim 分支。
5. 使用 `rg` 验证旧路由、旧模块和依赖不再被引用。
6. 更新迁移进度文档；只有完成删除和所有门禁后，状态才改为“已完成”。

## 路由模块约束

route module 保持薄层，只允许：

- `meta`、loader/action、错误边界和页面装配。
- 将 URL 参数转换为领域页面 props。
- 路由级权限判断和重定向。

route module 不允许：

- 创建独立 API client 或 QueryClient。
- 承载大型表格、表单、画布等业务实现。
- 导入其他领域的内部文件。
- 修改全局状态以镜像 URL。
- 在模块顶层导入只在弹窗、tab 或编辑模式使用的重依赖。

## 构建性能规则

每个迁移单元必须同时控制浏览器加载成本和完整构建成本：

1. root、provider、layout 和公共导航必须保持轻量，不导入领域页面或重依赖。
2. 单路由专用依赖留在对应 feature 中；可选能力使用交互时动态导入。
3. 公共层只抽取至少两个领域稳定复用的代码，不为“可能复用”提前上移。
4. wrapper 只是过渡，原生改造后必须删除旧实现，确保模块图净减少。
5. 每批迁移记录冷构建耗时和产物变化；冷构建中位数增长超过 10% 时必须分析原因。
6. 新增超过当前 `chunkSizeWarningLimit` 的 chunk 必须解释来源并拆分，不能直接调高阈值消除警告。
7. CI 缓存 pnpm store 和可缓存的 workspace 包任务；typecheck、test、lint、build 独立并行。
8. 未出现真实独立发布边界前，不引入微前端、Nx 或 Turborepo 解决单应用构建问题。

## 完成定义

一项迁移只有同时满足以下条件才可标记为“已完成”：

- [ ] 新旧 URL、动态参数、查询参数、刷新和浏览器前进后退行为一致。
- [ ] 鉴权、角色、主题、国际化及所有加载/空/错状态已验证。
- [ ] route 已使用 shell 原生 feature，不再 lazy import 对应旧 Next page。
- [ ] 服务端状态已进入 TanStack Query；URL 状态未复制到 store。
- [ ] 页面未新增 Axios 实例、直接 localStorage 访问或全局 provider 字段。
- [ ] 重依赖没有进入 root、provider、layout 或初始公共 chunk。
- [ ] 对应旧页面、旧组件、旧 API 和无引用依赖已删除。
- [ ] 目标领域 TypeScript 零错误，没有新增 typecheck baseline。
- [ ] lint、领域测试、路由 smoke test 和 shell build 通过。
- [ ] 构建耗时和 bundle 差异已记录，超过预算的变化有明确处置。
- [ ] 架构/迁移文档已更新。

## 推荐迁移顺序

按“领域闭环优先、重页面靠后”推进：

1. 补齐 Construct 导航闭环：models、prompt、app、knowledge、database。
2. CRUD 与查询型领域：data index、evaluation、应用管理。
3. 高交互领域：chat/SSE、flow、Monaco、AntV/G6/S2 图形与编辑能力。
4. 全路由完成后统一删除 Next/Webpack、兼容层和旧构建脚本。

一个领域开始迁移后，新需求默认只进入 shell 原生 feature。确需修改旧页面时，必须同步到新实现或明确记录为迁移阻塞，避免双写长期存在。

## PR 说明模板

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

## Consequences

### Positive

- 每个迁移单元都有可验证的终点，避免把“路由可访问”误当成“迁移完成”。
- 原生改造与旧代码删除绑定，模块图不会只增不减。
- 重依赖留在领域和交互边界内，控制首屏包体与共享 chunk 膨胀。
- 状态、API、路由和 UI 规则统一，后续页面可按模板复制。

### Negative

- 单个路由迁移的工作量比 wrapper 接入更高，需要同时处理测试、类型和删除。
- 过渡期仍要维护少量 Next shim，并跟踪其删除条件。
- 构建和 bundle 基线需要 CI 或发布流程持续记录。

### Mitigation

- 领域较大时可以分多个 PR，但最后一个 PR 必须完成阶段 3，且整个迁移单元只有一个 owner。
- 优先完成同一导航域形成闭环，减少新旧应用来回跳转和重复状态。
- 对当前超大 chunk 先做归属分析，再决定动态导入或依赖替换，不提前堆叠 bundler 配置。
