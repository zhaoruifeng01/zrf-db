/**
 * Governance tab components.
 *
 * Migrated from web/governance/src/App.vue (Vue 3 Composition API).
 * Each tab is a self-contained component using TanStack Query for server
 * state and Antd for UI. Replaces ~1086 lines of custom CSS with Antd's
 * component system + design tokens.
 */

import { Alert, App, Button, Card, Checkbox, Form, Input, InputNumber, Popconfirm, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  flattenDepts,
  governanceApi,
  permissionApi,
  type AuditLog,
  type Datasource,
  type Dept,
  type DeptInput,
  type Grant,
  type GrantInput,
  type MaskRule,
  type MaskRuleInput,
  type Product,
  type ProductInput,
  type Role,
  type RoleInput,
  type User,
  type UserInput,
} from '~/lib/governance-api';

const { Title, Text } = Typography;

// --- Shared helpers ---

function ErrorBanner({ error }: { error: unknown }) {
  const msg =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    '无法加载治理数据，请确认已登录且拥有对应权限。';
  return <Alert type="error" message={msg} showIcon style={{ marginBottom: 16 }} />;
}

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[][]) => keys.forEach(k => qc.invalidateQueries({ queryKey: k }));
}

// --- 1. Overview ---

const OVERVIEW_KEYS = [['datasources'], ['grants'], ['mask-rules'], ['catalog-products'], ['pending-requests']] as const;

const OVERVIEW_LABELS: Record<string, string> = {
  datasources: '数据源',
  grants: '授权策略',
  mask_rules: '脱敏规则',
  catalog_products: '数据产品',
  pending_requests: '待审批',
};

export function OverviewTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['governance', 'overview'],
    queryFn: governanceApi.getOverview,
  });

  if (error) return <ErrorBanner error={error} />;
  if (isLoading) return <Card loading />;

  const cards = Object.entries(OVERVIEW_LABELS).map(([key, label]) => ({
    key,
    label,
    value: data?.[key] ?? 0,
  }));

  return (
    <Space size="middle" wrap>
      {cards.map(c => (
        <Card key={c.key} style={{ width: 200 }}>
          <Statistic title={c.label} value={c.value} />
        </Card>
      ))}
    </Space>
  );
}

// --- 2. Datasources ---

export function DatasourcesTab() {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['governance', 'datasources'],
    queryFn: governanceApi.getDatasources,
  });

  const healthMutation = useMutation({
    mutationFn: governanceApi.testDatasource,
    onSuccess: res => {
      message.success(res.message || '健康检查完成');
      invalidate([['governance', 'datasources']]);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '健康检查失败';
      message.error(msg);
    },
  });

  if (error) return <ErrorBanner error={error} />;
  return (
    <Card loading={isLoading}>
      <Table<Datasource>
        rowKey="id"
        dataSource={data ?? []}
        pagination={false}
        locale={{ emptyText: '暂无数据源，先在 DB-GPT 主界面接入数据库。' }}
        columns={[
          { title: '名称', dataIndex: 'db_name', render: v => <Text strong>{v}</Text> },
          { title: '类型', dataIndex: 'db_type' },
          { title: '治理状态', render: (_, r) => <Tag>{r.policy?.status || '待纳管'}</Tag> },
          { title: '健康度', dataIndex: ['policy', 'health_status'], render: v => v || 'unknown' },
          {
            title: '',
            render: (_, r) => (
              <Button size="small" loading={healthMutation.isPending} onClick={() => healthMutation.mutate(r.id)}>
                检查连接
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}

// --- 3. Policies (grants + mask rules) ---

export function PoliciesTab() {
  const { data: datasources } = useQuery({
    queryKey: ['governance', 'datasources'],
    queryFn: governanceApi.getDatasources,
  });
  const dsOptions = (datasources ?? []).map(d => ({ label: d.db_name, value: d.id }));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <GrantsPanel dsOptions={dsOptions} />
      <MaskRulesPanel dsOptions={dsOptions} />
    </Space>
  );
}

function GrantsPanel({ dsOptions }: { dsOptions: { label: string; value: number }[] }) {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({
    queryKey: ['governance', 'grants'],
    queryFn: governanceApi.getGrants,
  });

  const [form] = Form.useForm<GrantInput>();
  const create = useMutation({
    mutationFn: governanceApi.createGrant,
    onSuccess: () => {
      message.success('授权已添加');
      form.resetFields();
      invalidate([['governance', 'grants']]);
    },
    onError: () => message.error('添加授权失败'),
  });
  const remove = useMutation({
    mutationFn: governanceApi.deleteGrant,
    onSuccess: () => invalidate([['governance', 'grants']]),
  });

  return (
    <Card title="角色数据授权" loading={isLoading}>
      <Form
        form={form}
        layout="inline"
        onFinish={v => create.mutate({ ...v, datasource_id: Number(v.datasource_id) })}
        initialValues={{ table_pattern: '*', permission: 'query' }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="role_code" rules={[{ required: true, message: '必填' }]}>
          <Input placeholder="DB-GPT role_code" />
        </Form.Item>
        <Form.Item name="datasource_id" rules={[{ required: true, message: '必填' }]}>
          <Select options={dsOptions} placeholder="选择数据源" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="table_pattern">
          <Input placeholder="表名或通配符" />
        </Form.Item>
        <Form.Item name="permission">
          <Select
            options={[
              { label: '查询', value: 'query' },
              { label: '管理', value: 'manage' },
            ]}
            style={{ width: 100 }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending}>
            添加授权
          </Button>
        </Form.Item>
      </Form>
      <Table<Grant>
        rowKey="id"
        dataSource={data ?? []}
        pagination={false}
        size="small"
        columns={[
          { title: '角色', dataIndex: 'role_code' },
          { title: '数据源', dataIndex: 'datasource_id' },
          { title: '表', dataIndex: 'table_pattern' },
          { title: '权限', dataIndex: 'permission' },
          {
            title: '',
            render: (_, r) => (
              <Popconfirm title="删除?" onConfirm={() => remove.mutate(r.id)}>
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  );
}

function MaskRulesPanel({ dsOptions }: { dsOptions: { label: string; value: number }[] }) {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({
    queryKey: ['governance', 'mask-rules'],
    queryFn: governanceApi.getMaskRules,
  });

  const [form] = Form.useForm<MaskRuleInput>();
  const create = useMutation({
    mutationFn: governanceApi.createMaskRule,
    onSuccess: () => {
      message.success('规则已添加');
      form.resetFields();
      invalidate([['governance', 'mask-rules']]);
    },
    onError: () => message.error('添加规则失败'),
  });
  const remove = useMutation({
    mutationFn: governanceApi.deleteMaskRule,
    onSuccess: () => invalidate([['governance', 'mask-rules']]),
  });

  return (
    <Card title="字段脱敏" loading={isLoading}>
      <Form
        form={form}
        layout="inline"
        onFinish={v => create.mutate({ ...v, datasource_id: Number(v.datasource_id), role_code: v.role_code || null })}
        initialValues={{ table_name: '*', mask_type: 'partial' }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="datasource_id" rules={[{ required: true, message: '必填' }]}>
          <Select options={dsOptions} placeholder="选择数据源" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="table_name">
          <Input placeholder="表名或通配符" />
        </Form.Item>
        <Form.Item name="column_name" rules={[{ required: true, message: '必填' }]}>
          <Input placeholder="字段名" />
        </Form.Item>
        <Form.Item name="role_code">
          <Input placeholder="仅对角色生效（可选）" />
        </Form.Item>
        <Form.Item name="mask_type">
          <Select
            options={[
              { label: '部分掩码', value: 'partial' },
              { label: '全掩码', value: 'full' },
              { label: '哈希', value: 'hash' },
              { label: '邮箱', value: 'email' },
            ]}
            style={{ width: 120 }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending}>
            添加规则
          </Button>
        </Form.Item>
      </Form>
      <Table<MaskRule>
        rowKey="id"
        dataSource={data ?? []}
        pagination={false}
        size="small"
        columns={[
          { title: '数据源', dataIndex: 'datasource_id' },
          { title: '表', dataIndex: 'table_name' },
          { title: '字段', dataIndex: 'column_name' },
          { title: '角色', dataIndex: 'role_code', render: v => v || '-' },
          { title: '类型', dataIndex: 'mask_type' },
          {
            title: '',
            render: (_, r) => (
              <Popconfirm title="删除?" onConfirm={() => remove.mutate(r.id)}>
                <Button size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  );
}

// --- 4. Permission (users / roles / depts) ---

type PermissionPanel = 'users' | 'roles' | 'depts';

export function PermissionTab() {
  const [panel, setPanel] = useState<PermissionPanel>('users');
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space>
        {(['users', 'roles', 'depts'] as const).map(p => (
          <Button key={p} type={panel === p ? 'primary' : 'default'} onClick={() => setPanel(p)}>
            {p === 'users' ? '用户' : p === 'roles' ? '角色' : '部门'}
          </Button>
        ))}
      </Space>
      {panel === 'users' && <UsersPanel />}
      {panel === 'roles' && <RolesPanel />}
      {panel === 'depts' && <DeptsPanel />}
    </Space>
  );
}

function UsersPanel() {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data: users, isLoading } = useQuery({
    queryKey: ['permission', 'users'],
    queryFn: () => permissionApi.getUsers(),
  });
  const { data: roles } = useQuery({ queryKey: ['permission', 'roles'], queryFn: permissionApi.getRoles });
  const { data: depts } = useQuery({ queryKey: ['permission', 'depts'], queryFn: permissionApi.getDepts });
  const flatDepts = useMemo(() => flattenDepts(depts ?? []), [depts]);

  const [form] = Form.useForm<UserInput>();
  const create = useMutation({
    mutationFn: permissionApi.createUser,
    onSuccess: () => {
      message.success('用户已创建');
      form.resetFields();
      invalidate([['permission', 'users']]);
    },
    onError: () => message.error('创建用户失败'),
  });
  const remove = useMutation({
    mutationFn: permissionApi.deleteUser,
    onSuccess: () => invalidate([['permission', 'users']]),
  });

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="新增用户">
        <Form
          form={form}
          layout="vertical"
          onFinish={v => create.mutate({ ...v, role_ids: v.role_ids ?? [], dept_ids: v.dept_ids ?? [] })}
          initialValues={{ role_ids: [], dept_ids: [] }}
        >
          <Space wrap>
            <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="初始密码" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="real_name" label="姓名">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="role_ids" label="角色">
            <Checkbox.Group options={(roles ?? []).map(r => ({ label: `${r.role_name} (${r.role_code})`, value: r.id }))} />
          </Form.Item>
          <Form.Item name="dept_ids" label="部门">
            <Checkbox.Group options={flatDepts.map(d => ({ label: `${d.dept_name} (${d.dept_code})`, value: d.id }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending}>
            创建用户
          </Button>
        </Form>
      </Card>
      <Card title={`用户列表 (${users?.items?.length ?? 0})`} loading={isLoading}>
        <Table<User>
          rowKey="id"
          dataSource={users?.items ?? []}
          pagination={false}
          size="small"
          columns={[
            { title: '用户', dataIndex: 'username', render: v => <Text strong>{v}</Text> },
            { title: '姓名', dataIndex: 'real_name', render: v => v || '-' },
            { title: '角色', render: (_, r) => r.roles?.map(x => <Tag key={x.id}>{x.role_code}</Tag>) ?? '-' },
            { title: '部门', render: (_, r) => r.departments?.map(x => <Tag key={x.id}>{x.dept_name}</Tag>) ?? '-' },
            {
              title: '状态',
              render: (_, r) => <Tag color={r.status === 1 ? 'green' : 'default'}>{r.status === 1 ? '启用' : '停用'}</Tag>,
            },
            {
              title: '',
              render: (_, r) => (
                <Popconfirm title="删除?" onConfirm={() => remove.mutate(r.id)}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

function RolesPanel() {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({ queryKey: ['permission', 'roles'], queryFn: permissionApi.getRoles });

  const [form] = Form.useForm<RoleInput>();
  const create = useMutation({
    mutationFn: permissionApi.createRole,
    onSuccess: () => {
      message.success('角色已创建');
      form.resetFields();
      invalidate([['permission', 'roles']]);
    },
    onError: () => message.error('创建角色失败'),
  });
  const remove = useMutation({
    mutationFn: permissionApi.deleteRole,
    onSuccess: () => invalidate([['permission', 'roles']]),
  });

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="新增角色">
        <Form form={form} layout="inline" onFinish={v => create.mutate(v)}>
          <Form.Item name="role_code" rules={[{ required: true }]}>
            <Input placeholder="角色编码" />
          </Form.Item>
          <Form.Item name="role_name" rules={[{ required: true }]}>
            <Input placeholder="角色名称" />
          </Form.Item>
          <Form.Item name="description">
            <Input placeholder="说明" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={create.isPending}>
              创建角色
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title={`角色列表 (${data?.length ?? 0})`} loading={isLoading}>
        <Table<Role>
          rowKey="id"
          dataSource={data ?? []}
          pagination={false}
          size="small"
          columns={[
            { title: '编码', dataIndex: 'role_code', render: v => <Text strong>{v}</Text> },
            { title: '名称', dataIndex: 'role_name' },
            { title: '说明', dataIndex: 'description', render: v => v || '-' },
            {
              title: '状态',
              render: (_, r) => <Tag color={r.status === 1 ? 'green' : 'default'}>{r.status === 1 ? '启用' : '停用'}</Tag>,
            },
            {
              title: '',
              render: (_, r) => (
                <Popconfirm title="删除?" onConfirm={() => remove.mutate(r.id)}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

function DeptsPanel() {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({ queryKey: ['permission', 'depts'], queryFn: permissionApi.getDepts });
  const flat = useMemo(() => flattenDepts(data ?? []), [data]);

  const [form] = Form.useForm<DeptInput>();
  const create = useMutation({
    mutationFn: permissionApi.createDept,
    onSuccess: () => {
      message.success('部门已创建');
      form.resetFields();
      invalidate([['permission', 'depts']]);
    },
    onError: () => message.error('创建部门失败'),
  });
  const remove = useMutation({
    mutationFn: permissionApi.deleteDept,
    onSuccess: () => invalidate([['permission', 'depts']]),
  });

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="新增部门">
        <Form
          form={form}
          layout="inline"
          onFinish={v => create.mutate({ ...v, parent_id: Number(v.parent_id || 0), order_num: Number(v.order_num || 0) })}
          initialValues={{ parent_id: 0, order_num: 0 }}
        >
          <Form.Item name="dept_name" rules={[{ required: true }]}>
            <Input placeholder="部门名称" />
          </Form.Item>
          <Form.Item name="dept_code" rules={[{ required: true }]}>
            <Input placeholder="部门编码" />
          </Form.Item>
          <Form.Item name="parent_id">
            <Select
              placeholder="上级部门"
              style={{ width: 180 }}
              options={flat.map(d => ({ label: `${d.dept_name} / ${d.dept_code}`, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="order_num">
            <InputNumber placeholder="排序" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={create.isPending}>
              创建部门
            </Button>
          </Form.Item>
        </Form>
      </Card>
      <Card title={`部门列表 (${flat.length})`} loading={isLoading}>
        <Table<Dept>
          rowKey="id"
          dataSource={flat}
          pagination={false}
          size="small"
          columns={[
            { title: '名称', dataIndex: 'dept_name', render: v => <Text strong>{v}</Text> },
            { title: '编码', dataIndex: 'dept_code' },
            { title: '上级 ID', dataIndex: 'parent_id', render: v => v || '-' },
            {
              title: '状态',
              render: (_, r) => <Tag color={r.status === 1 ? 'green' : 'default'}>{r.status === 1 ? '启用' : '停用'}</Tag>,
            },
            {
              title: '',
              render: (_, r) => (
                <Popconfirm title="删除?" onConfirm={() => remove.mutate(r.id)}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

// --- 5. Catalog ---

export function CatalogTab() {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const { data: datasources } = useQuery({ queryKey: ['governance', 'datasources'], queryFn: governanceApi.getDatasources });
  const dsOptions = (datasources ?? []).map(d => ({ label: d.db_name, value: d.id }));
  const { data: products, isLoading } = useQuery({
    queryKey: ['governance', 'catalog-products'],
    queryFn: governanceApi.getProducts,
  });

  const [form] = Form.useForm<ProductInput>();
  const create = useMutation({
    mutationFn: governanceApi.createProduct,
    onSuccess: () => {
      message.success('产品已保存');
      form.resetFields();
      invalidate([['governance', 'catalog-products']]);
    },
    onError: () => message.error('保存失败'),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="发布数据产品">
        <Form
          form={form}
          layout="vertical"
          onFinish={v => create.mutate({ ...v, datasource_id: Number(v.datasource_id) })}
          initialValues={{ resource_type: 'table', status: 'draft', rate_limit_per_minute: 60 }}
          style={{ maxWidth: 480 }}
        >
          <Form.Item name="product_key" label="产品 Key" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="展示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="datasource_id" label="数据源" rules={[{ required: true }]}>
            <Select options={dsOptions} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="resource_definition" label="资源定义 (TABLE 或 SQL)">
            <Input.TextArea />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={create.isPending}>
            保存草稿
          </Button>
        </Form>
      </Card>
      <Card title="数据产品目录" loading={isLoading}>
        <Table<Product>
          rowKey="id"
          dataSource={products ?? []}
          pagination={false}
          size="small"
          columns={[
            { title: '名称', dataIndex: 'title', render: v => <Text strong>{v}</Text> },
            { title: 'Key', dataIndex: 'product_key' },
            { title: '类型', dataIndex: 'resource_type' },
            { title: '状态', dataIndex: 'status', render: v => <Tag>{v}</Tag> },
            { title: '说明', dataIndex: 'description', render: v => v || '-' },
          ]}
        />
      </Card>
    </Space>
  );
}

// --- 6. Audit ---

export function AuditTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['governance', 'audit-logs'],
    queryFn: governanceApi.getAuditLogs,
  });

  if (error) return <ErrorBanner error={error} />;
  return (
    <Card loading={isLoading}>
      <Table<AuditLog>
        rowKey="id"
        dataSource={data ?? []}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无审计记录' }}
        columns={[
          { title: '时间', dataIndex: 'gmt_created' },
          { title: '用户', dataIndex: 'username' },
          { title: '操作', dataIndex: 'action' },
          { title: '数据源', dataIndex: 'datasource_id', render: v => v || '-' },
          { title: '结果', dataIndex: 'status', render: v => <Tag>{v}</Tag> },
          { title: '详情', dataIndex: 'detail', render: v => v || '-' },
        ]}
      />
    </Card>
  );
}
