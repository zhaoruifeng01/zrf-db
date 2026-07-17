import { Layout, Menu, Typography } from 'antd';
import { useState } from 'react';
import type { MetaDescriptor } from 'react-router';

import {
  AuditTab,
  CatalogTab,
  DatasourcesTab,
  OverviewTab,
  PermissionTab,
  PoliciesTab,
} from '~/components/governance/GovernanceTabs';

const { Sider, Content } = Layout;

type Tab = 'overview' | 'datasources' | 'policies' | 'permission' | 'catalog' | 'audit';

const TABS: { key: Tab; name: string; hint: string }[] = [
  { key: 'overview', name: '资产概览', hint: '数据资产、审批与调用审计' },
  { key: 'datasources', name: '数据源', hint: '连接健康度与治理归属' },
  { key: 'policies', name: '权限与脱敏', hint: '角色表授权与字段保护' },
  { key: 'permission', name: '权限管理', hint: '用户、角色与部门统一管理' },
  { key: 'catalog', name: '数据产品', hint: '发布、发现与访问申请' },
  { key: 'audit', name: '审计', hint: '受治理查询与管理操作' },
];

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT · 治理' }];
}

/**
 * Governance console - migrated from web/governance/src/App.vue (Vue 3 + iframe)
 * to a React route module in the shell. Reuses the shell's Antd, design tokens,
 * TanStack Query, and @dbgpt/shared auth/storage. Eliminates the iframe and the
 * Vue toolchain per ADR 0001 §中期.
 */
export default function GovernanceRoute() {
  const [tab, setTab] = useState<Tab>('overview');
  const current = TABS.find(t => t.key === tab) ?? TABS[0]!;

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      <Sider width={240} theme="light" style={{ borderRight: '1px solid var(--border-default)' }}>
        <div style={{ padding: 24 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>DB-GPT Governance</p>
          <Typography.Title level={4} style={{ margin: 0 }}>
            资源管理
          </Typography.Title>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
            统一身份、统一 API Server、统一数据源连接管理
          </p>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[tab]}
          onClick={({ key }) => setTab(key as Tab)}
          items={TABS.map(t => ({ key: t.key, label: t.name }))}
        />
      </Sider>
      <Content style={{ padding: 24, background: 'var(--surface-base)', overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {current.name}
          </Typography.Title>
          <Typography.Text type="secondary">{current.hint}</Typography.Text>
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'datasources' && <DatasourcesTab />}
        {tab === 'policies' && <PoliciesTab />}
        {tab === 'permission' && <PermissionTab />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'audit' && <AuditTab />}
      </Content>
    </Layout>
  );
}
