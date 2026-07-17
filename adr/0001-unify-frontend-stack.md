# ADR 0001: 统一前端技术栈

- **Status:** Accepted
- **Date:** 2026-07-17
- **Decision owner:** DB-GPT frontend
- **Supersedes:** 无
- **Superseded by:** 无
- **Related:** `adr/0002-frontend-route-migration-playbook.md`（迁移执行规范）、`架构评审-2026-07-17.md`（评审全文）、`架构评审-2026-07-16.md`

## Context

DB-GPT 前端目前是"Python 后端 + 静态 Next.js 主 UI + iframe 内嵌 Vue 治理子应用 + 独立 Docusaurus"的混合架构。问题集中在：

1. **两个 UI 运行时**：React 主应用 + Vue 3 治理子应用，仅靠 iframe 拼接，身份、主题、国际化、错误边界无法自然共享。
2. **构建链与部署契约自相矛盾**：Next 13.4.7 仍调用 `next export`（已废弃），动态路由用 `fallback: 'blocking'`（静态导出不支持）；`ignoreBuildErrors: true` 主动忽略类型错误。
3. **Next.js 能力错配**：项目是登录后桌面 SPA，却承担 Pages Router、Webpack、`next/image`、自定义 Document、静态导出复杂度，且静态导出不支持 rewrites/proxy。
4. **状态层混杂**：`ChatContext` 同时承载主题、路由参数、模型列表、对话历史；服务端数据用 `useRequest`，客户端状态散落 localStorage。
5. **API Client 重复**：主应用 2 套 Axios 实例 + 治理应用 2 套实例，错误解包、401 跳转、超时、baseURL 各不相同；同时并存 Moment 与 Day.js。
6. **包管理不统一**：web 用 yarn 1，governance 用 npm，docs 两套 lockfile 并存；文档 Dockerfile `yarn install` 后 `npm run build`。
7. **CSS 双系统互相覆盖**：Ant Design CSS-in-JS + Tailwind `important: true`，主应用与治理页维护不同颜色定义。

完整问题清单、证据链与候选框架比较见 `架构评审-2026-07-17.md`。

## Decision

将 DB-GPT 前端统一为 **React + React Router Framework Mode（CSR）+ Vite + Ant Design + Tailwind（受限）+ TanStack Query + Zustand + pnpm workspace** 的模块化单体，保留 Docusaurus 为独立文档站。短期只建立边界与可迁移基线，不替换业务页面，采用 branch by abstraction 逐步迁移。

### 技术栈决议

| 能力 | 唯一选择 | 使用边界 |
|---|---|---|
| 语言 | TypeScript strict | 禁止新增 `any`；API DTO 从 OpenAPI 生成或显式建模 |
| UI 运行时 | React | 业务 UI 不再引入第二运行时 |
| 应用框架 | React Router Framework Mode | `ssr: false`；route module 按领域懒加载 |
| 构建 | Vite | 开发代理、worker、静态资源、代码拆分统一配置 |
| 组件系统 | Ant Design | 表单、表格、弹窗、导航、反馈和基础交互的唯一组件系统 |
| 样式 | Tailwind + design tokens | Tailwind 只做布局/间距/排版；视觉值来自 CSS variables；不新增第二套组件库；取消全局 `important: true` |
| 图标 | `@ant-design/icons` | 与 Ant Design 统一 |
| 请求 | Axios + `@microsoft/fetch-event-source` | Axios 处理普通 REST；SSE 走独立适配器；共享鉴权与错误模型 |
| 服务端状态 | TanStack Query | 查询、缓存、重试、失效、分页、mutation；替代数据请求型 `useRequest` |
| 客户端状态 | Zustand | 仅跨路由同步客户端状态；组件局部状态继续 `useState` |
| 表单 | Ant Design Form | 不再引入另一套表单框架 |
| 日期 | Day.js | 移除 Moment |
| 图表 | AntV 为主 | G2Plot/Plots、G6、S2 按场景保留；建立适配层，禁止页面直接混用多个图表入口 |
| 编辑器 | Monaco React | Vite worker 配置集中管理 |
| 国际化 | i18next + react-i18next | 路由、组件、治理页共享同一语言资源与切换机制 |
| 包管理 | pnpm workspace | `web` 与 `docs` 两个 app，一个 lockfile；暂不引入 Turborepo/Nx |
| 代码规范 | ESLint flat config + Prettier | 根级共享配置；lint 不自动 `--fix`，修复命令单列 |
| 测试 | Vitest + RTL + Playwright | 不做截图测试；覆盖路由守卫、鉴权、API 错误、聊天/SSE 和治理关键流程 |
| 文档站 | Docusaurus | 保持独立构建和部署边界，仅统一包管理与规范工具 |

### 为什么不选其他候选

- **Next.js（升级到新版本）**：适合需要 SSR、RSC、SEO 或 Node BFF 的产品；本项目主要是登录后 SPA，静态导出又不能使用 rewrites/proxy/API Routes，继续保留会支付不需要的全栈复杂度。
- **Refine**：定位 CRUD-heavy 后台与权限管理。DB-GPT 核心还有流式聊天、Agent 执行、流程画布、Monaco 和复杂可视化，引入会形成第二层元框架。仅作模式参考。
- **Umi Max / Ant Design Pro**：与 Ant Design 相容，但在 React Router/Vite 之外再引入约定、插件和升级体系，迁移收益不足。
- **Vue/Nuxt**：技术能力足够，但会重写占绝对多数的 React 存量；治理页规模不足以反向决定全站框架。

### 迁移策略

采用 **strangler** 路径，路由作为切换边界：

1. **短期（1-2 个迭代）**：建立 pnpm workspace 与唯一 lockfile；统一 Node/TypeScript/ESLint/Prettier 基线；抽 API Client、Auth adapter、Storage adapter、design tokens；加 `typecheck`/`lint`/`test`/`build` 四道门禁；起 Vite + React Router 新壳（`ssr: false`、API proxy、Monaco worker、Python 静态托管契约）。**不替换任何业务页面**。
2. **中期（2-4 个迭代）**：先迁低耦合页（登录、权限、模型、Prompt）；将 `web/governance` 重写为 React route module，删除 iframe、Vue、独立 Axios；再迁知识库、数据源、评测、应用管理；最后迁聊天、SSE、流程画布、Monaco、AntV 重页面。把 `ChatContext` 拆成路由状态、Query cache、chat store、preferences store。
3. **长期**：删除 Next、Webpack 专用插件、Vue 工具链、`next export` 脚本和旧 Document；审计并删除浏览器工程中的 MySQL/Sequelize/Multer/Iron Session/Next Auth 等服务端包；统一 Moment 到 Day.js；为 API DTO 接入 OpenAPI 类型生成。

## Consequences

### 正面

- 单一 React 运行时 + 单一 Vite 构建链，依赖、主题、鉴权、错误边界自然共享。
- 类型检查成为硬门禁后，迁移与升级有可靠完成判据。
- TanStack Query + Zustand 分层后，缓存、失效、重试与客户端状态可测试、可推理。
- pnpm workspace + 单一 lockfile 让依赖解析可复现。
- Docusaurus 保持独立，文档站不受业务 SPA 迁移影响。

### 负面

- 短期存在 Next 与 Vite 两套构建并存的过渡期，认知负担与 CI 复杂度暂时上升。
- 存量 `any` 与类型错误需要按领域逐步清零，`typecheck` 在清零前不能作为阻断门禁，只能先以 baseline 隔离。
- 治理页重写为 React 之前，iframe 拼接的深链、主题、登录失效分叉问题仍存在。
- pnpm workspace 引入后，旧的 yarn/npm lockfile 需要在长期阶段才能删除，期间可能出现依赖解析不一致。

### 缓解

- 新代码强制走新壳与共享抽象；旧 Next 目录停止新增功能。
- `typecheck` 先以 baseline 文件隔离存量错误，新增错误立即失败。
- 迁移每完成一个领域，立刻删除对应旧链路与依赖，避免长期并存。

## Open questions

- API DTO 是否在后端 OpenAPI schema 稳定后立即接入代码生成，还是先手工建模？短期选择手工建模，长期接入生成。
- 治理页重写时，是按业务域（audit、policy、metadata）分路由渐进上线，还是一次性切换？中期再决定。
