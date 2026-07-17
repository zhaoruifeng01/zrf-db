# Governance 改造进度

日期：2026-07-17

## 已完成

- `GOV-001`：完成集成边界 ADR，明确唯一身份源、数据源源头和连接器入口。
- `SEC-001`：Permission Serve 建立统一 Principal 依赖。
- `SEC-002`：用户、角色、部门管理接口接入认证；写操作要求 `admin` 或 `permission.manage`。
- `SEC-003`：生产环境默认/空 JWT 密钥启动阻断。
- `SEC-004`：Governance API Key 创建入口默认关闭。
- `SEC-005`：`/governance/query` 默认关闭。
- `DEP-001`：`dbgpt-core`、`dbgpt-serve` 和锁文件统一到 `sqlparse==0.5.5`。
- `AUD-001`：审计 SQL 改为指纹和脱敏模板，detail 执行敏感字段清理。
- `MIG-001`：治理 7 张现有表建立 Alembic baseline。
- `MIG-002`：Governance Serve 启动不再建表，只检查 schema ready。
- `RBAC-005`：建立 SQL 执行入口清册。
- `SQL-001`：新增 bounded SQL Guard，覆盖单语句、只读、复杂度和资源提取。
- `DS-002`：新增数据源治理 Adapter，复用 `connect_config` 和 `ConnectorManager`。
- `DS-003`：新增连接器能力矩阵，标注 schema、column、profile、readonly 能力。
- `META-001`：新增 dataset/table/column/metric/relationship/scan 语义元数据实体和 Alembic 迁移。
- `META-002`：新增语义元数据 Repository 与 Service。
- `META-003`：新增 ConnectorManager 驱动的表/列扫描，并保证重复扫描幂等。
- `META-004`：新增可解释的元数据健康度算法。

## 部分完成

- `TEST-001`：已覆盖 Principal、JWT 默认密钥、SQL Guard、审计脱敏、Permission 路由 401/403、Governance Query/API Key 默认关闭；仍缺完整 CI 矩阵和所有执行入口越权测试。
- `ARC-001`：已抽出 `SqlGuard`、`Authorizer`、`AuditWriter` 和限流边界；MetadataRepository、Metrics、Facade 还需继续补齐。
- `RBAC-003`：已有 Authorizer 接口和旧 `governance_role_grant` 适配器；尚未落结构化 deny/allow 表、user/role/dept 聚合和列级决策。
- `RATE-001`：请求路径已从审计表 COUNT 改为本地令牌桶；生产级 Redis/Valkey 分布式限流未接入。
- `AUD-002/AUD-003`：已有 AuditWriter 边界和脱敏写入；异步有界队列、背压和强审计还未完成。
- `DS-001`：语义元数据实体已只引用 `connect_config.id`；旧治理实体中 catalog/grant/mask 已沿用 `datasource_id`，但尚未做全库约束审计。
- `DS-004`：Adapter 提供连接缓存失效和 stale 标记入口；尚未接入 Datasource Serve 的删除/变更事件 Hook。
- `META-006`：新增后端元数据 API；仍需按未来结构化 Authorizer 做更细粒度资源过滤。

## 未完成

- `META-005`：DBSummaryClient 增量触发。
- `PROF-001～002`：基础画像和 AI 画像增强。
- `RBAC-001～002、RBAC-004、RBAC-006`：结构化授权模型、迁移、缓存、所有执行入口接入。
- `SQL-002～003`：多方言 SQL 语料和数据库侧只读验证。
- `MASK-001`：列级授权和脱敏顺序完整闭环。
- `OBS-001～004`：OTel Span、Prometheus 指标、聚合 Worker、健康检查。
- `UI-001～003`：治理前端归属、元数据/数据源治理页面、RBAC/审计页面。
- `MIG-003～004`：云枢数据迁移工具和历史审计选择性迁移。
- `TEST-002～003`：端到端安全矩阵、多数据库契约与迁移测试。
- `PERF-001`：性能与故障注入。
- `REL-001～002`：Feature Flag shadow/enforce 灰度和回滚演练。
- `CLEAN-001`：稳定运行后的兼容层和废弃表清理。
