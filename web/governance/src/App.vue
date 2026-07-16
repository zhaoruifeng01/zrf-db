<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from '@/utils/axios'
import { permissionApi } from '@/utils/axios'

type Tab = 'overview' | 'datasources' | 'policies' | 'permission' | 'catalog' | 'audit'
type PermissionPanel = 'users' | 'roles' | 'depts'

type Datasource = {
  id: number
  db_name: string
  db_type: string
  comment?: string
  policy?: { status: string; business_domain?: string; health_status: string } | null
}

const activeTab = ref<Tab>('overview')
const loading = ref(false)
const error = ref('')
const overview = ref<Record<string, number>>({})
const datasources = ref<Datasource[]>([])
const grants = ref<any[]>([])
const maskRules = ref<any[]>([])
const products = ref<any[]>([])
const audits = ref<any[]>([])
const users = ref<any[]>([])
const roles = ref<any[]>([])
const depts = ref<any[]>([])
const activePermissionPanel = ref<PermissionPanel>('users')
const notice = ref('')
const grantForm = ref({ role_code: '', datasource_id: 0, table_pattern: '*', permission: 'query' })
const maskForm = ref({ datasource_id: 0, table_name: '*', column_name: '', role_code: '', mask_type: 'partial' })
const productForm = ref({ product_key: '', datasource_id: 0, title: '', description: '', resource_type: 'table', resource_definition: '', status: 'draft', rate_limit_per_minute: 60 })
const userForm = ref({ username: '', password: '', email: '', real_name: '', phone: '', role_ids: [] as number[], dept_ids: [] as number[] })
const roleForm = ref({ role_code: '', role_name: '', description: '' })
const deptForm = ref({ dept_name: '', dept_code: '', parent_id: 0, order_num: 0 })

const tabs: Array<{ key: Tab; name: string; hint: string }> = [
  { key: 'overview', name: '资产概览', hint: '数据资产、审批与调用审计' },
  { key: 'datasources', name: '数据源', hint: '连接健康度与治理归属' },
  { key: 'policies', name: '权限与脱敏', hint: '角色表授权与字段保护' },
  { key: 'permission', name: '权限管理', hint: '用户、角色与部门统一管理' },
  { key: 'catalog', name: '数据产品', hint: '发布、发现与访问申请' },
  { key: 'audit', name: '审计', hint: '受治理查询与管理操作' },
]

const title = computed(() => tabs.find(tab => tab.key === activeTab.value)?.name ?? '')
const currentHint = computed(() => tabs.find(tab => tab.key === activeTab.value)?.hint ?? '')
const overviewCards = computed(() => [
  { key: 'datasources', label: '数据源', value: overview.value.datasources ?? 0 },
  { key: 'grants', label: '授权策略', value: overview.value.grants ?? 0 },
  { key: 'mask_rules', label: '脱敏规则', value: overview.value.mask_rules ?? 0 },
  { key: 'catalog_products', label: '数据产品', value: overview.value.catalog_products ?? 0 },
  { key: 'pending_requests', label: '待审批', value: overview.value.pending_requests ?? 0 },
])
const flatDepts = computed(() => {
  const result: any[] = []
  const walk = (items: any[]) => {
    for (const item of items || []) {
      result.push(item)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(depts.value)
  return result
})
const unwrap = <T,>(response: { data: { data: T } }) => response.data.data

async function loadDatasources() {
  datasources.value = await unwrap(await axios.get('/datasources'))
}

async function loadPolicies() {
  const [grantData, maskData] = await Promise.all([
    unwrap(await axios.get('/grants')),
    unwrap(await axios.get('/mask-rules')),
  ])
  grants.value = grantData
  maskRules.value = maskData
}

async function loadPermissions() {
  const [userData, roleData, deptData] = await Promise.all([
    unwrap<any>(await permissionApi.get('/users', { params: { page: 1, page_size: 100 } })),
    unwrap<any[]>(await permissionApi.get('/roles')),
    unwrap<any[]>(await permissionApi.get('/depts')),
  ])
  users.value = userData.items || []
  roles.value = roleData
  depts.value = deptData
}

async function load() {
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    if (activeTab.value === 'overview') overview.value = await unwrap(await axios.get('/overview'))
    if (activeTab.value === 'datasources') await loadDatasources()
    if (activeTab.value === 'policies') await Promise.all([loadDatasources(), loadPolicies()])
    if (activeTab.value === 'permission') await loadPermissions()
    if (activeTab.value === 'catalog') {
      await loadDatasources()
      products.value = await unwrap(await axios.get('/catalog/products'))
    }
    if (activeTab.value === 'audit') audits.value = await unwrap(await axios.get('/audit-logs'))
  } catch (cause: any) {
    error.value = cause?.response?.data?.detail || '无法加载治理数据，请确认已登录且拥有对应权限。'
  } finally {
    loading.value = false
  }
}

async function changeTab(tab: Tab) {
  activeTab.value = tab
  await load()
}

async function testDatasource(id: number) {
  try {
    const result = await unwrap(await axios.post(`/datasources/${id}/health`))
    notice.value = result.message
    await loadDatasources()
  } catch (cause: any) {
    notice.value = cause?.response?.data?.detail || '健康检查失败'
  }
}

async function createGrant() {
  await axios.post('/grants', { ...grantForm.value, datasource_id: Number(grantForm.value.datasource_id) })
  grantForm.value = { role_code: '', datasource_id: 0, table_pattern: '*', permission: 'query' }
  await loadPolicies()
}

async function removeGrant(id: number) {
  await axios.delete(`/grants/${id}`)
  await loadPolicies()
}

async function createMaskRule() {
  await axios.post('/mask-rules', { ...maskForm.value, datasource_id: Number(maskForm.value.datasource_id), role_code: maskForm.value.role_code || null })
  maskForm.value = { datasource_id: 0, table_name: '*', column_name: '', role_code: '', mask_type: 'partial' }
  await loadPolicies()
}

async function removeMaskRule(id: number) {
  await axios.delete(`/mask-rules/${id}`)
  await loadPolicies()
}

async function createProduct() {
  await axios.post('/catalog/products', { ...productForm.value, datasource_id: Number(productForm.value.datasource_id) })
  productForm.value = { product_key: '', datasource_id: 0, title: '', description: '', resource_type: 'table', resource_definition: '', status: 'draft', rate_limit_per_minute: 60 }
  products.value = await unwrap(await axios.get('/catalog/products'))
}

async function createUser() {
  await permissionApi.post('/users', userForm.value)
  userForm.value = { username: '', password: '', email: '', real_name: '', phone: '', role_ids: [], dept_ids: [] }
  await loadPermissions()
}

async function removeUser(id: number) {
  await permissionApi.delete(`/users/${id}`)
  await loadPermissions()
}

async function createRole() {
  await permissionApi.post('/roles', roleForm.value)
  roleForm.value = { role_code: '', role_name: '', description: '' }
  await loadPermissions()
}

async function removeRole(id: number) {
  await permissionApi.delete(`/roles/${id}`)
  await loadPermissions()
}

async function createDept() {
  await permissionApi.post('/depts', { ...deptForm.value, parent_id: Number(deptForm.value.parent_id || 0), order_num: Number(deptForm.value.order_num || 0) })
  deptForm.value = { dept_name: '', dept_code: '', parent_id: 0, order_num: 0 }
  await loadPermissions()
}

async function removeDept(id: number) {
  await permissionApi.delete(`/depts/${id}`)
  await loadPermissions()
}

function formatDepartments(departments: any[] = []) {
  return departments.map(dept => dept.dept_name).join('、') || '-'
}

onMounted(load)
</script>

<template>
  <main class="governance-shell">
    <header class="governance-header">
      <div>
        <p class="eyebrow">DB-GPT Governance</p>
        <h1>资源管理</h1>
        <p class="header-desc">统一身份、统一 API Server、统一数据源连接管理</p>
      </div>
      <button class="ghost-btn" @click="load">刷新</button>
    </header>

    <div class="governance-layout">
      <aside class="governance-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
          :class="{ active: activeTab === tab.key }"
          @click="changeTab(tab.key)"
        >
          <span>{{ tab.name }}</span>
          <small>{{ tab.hint }}</small>
        </button>
      </aside>

      <section class="governance-content">
        <div class="content-title">
          <div>
            <h2>{{ title }}</h2>
            <p>{{ currentHint }}</p>
          </div>
          <span class="status-pill">统一认证</span>
        </div>

        <p v-if="error" class="alert danger">{{ error }}</p>
        <p v-if="notice" class="alert info">{{ notice }}</p>
        <p v-if="loading" class="loading-card">正在加载治理数据…</p>

        <div v-if="!loading && activeTab === 'overview'" class="metric-grid">
          <article v-for="card in overviewCards" :key="card.key" class="metric-card">
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </article>
        </div>

        <div v-if="!loading && activeTab === 'datasources'" class="panel table-panel">
          <table>
            <thead>
              <tr><th>名称</th><th>类型</th><th>治理状态</th><th>健康度</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="item in datasources" :key="item.id">
                <td class="strong">{{ item.db_name }}</td>
                <td>{{ item.db_type }}</td>
                <td><span class="tag">{{ item.policy?.status || '待纳管' }}</span></td>
                <td>{{ item.policy?.health_status || 'unknown' }}</td>
                <td class="right"><button class="link-btn" @click="testDatasource(item.id)">检查连接</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!loading && activeTab === 'policies'" class="grid gap-5 xl:grid-cols-2">
          <article class="panel">
            <h3>角色数据授权</h3>
            <form class="form-grid" @submit.prevent="createGrant">
              <input v-model="grantForm.role_code" required placeholder="DB-GPT role_code" class="control">
              <select v-model="grantForm.datasource_id" required class="control"><option :value="0" disabled>选择数据源</option><option v-for="item in datasources" :key="item.id" :value="item.id">{{ item.db_name }}</option></select>
              <input v-model="grantForm.table_pattern" placeholder="表名或通配符" class="control">
              <select v-model="grantForm.permission" class="control"><option value="query">查询</option><option value="manage">管理</option></select>
              <button class="primary-btn">添加授权</button>
            </form>
            <ul class="record-list"><li v-for="grant in grants" :key="grant.id"><span>{{ grant.role_code }} · 数据源 {{ grant.datasource_id }} · {{ grant.table_pattern }} · {{ grant.permission }}</span><button class="danger-btn" @click="removeGrant(grant.id)">删除</button></li></ul>
          </article>
          <article class="panel">
            <h3>字段脱敏</h3>
            <form class="form-grid" @submit.prevent="createMaskRule">
              <select v-model="maskForm.datasource_id" required class="control"><option :value="0" disabled>选择数据源</option><option v-for="item in datasources" :key="item.id" :value="item.id">{{ item.db_name }}</option></select>
              <input v-model="maskForm.table_name" placeholder="表名或通配符" class="control">
              <input v-model="maskForm.column_name" required placeholder="字段名" class="control">
              <input v-model="maskForm.role_code" placeholder="仅对角色生效（可选）" class="control">
              <select v-model="maskForm.mask_type" class="control"><option value="partial">部分掩码</option><option value="full">全掩码</option><option value="hash">哈希</option><option value="email">邮箱</option></select>
              <button class="primary-btn">添加规则</button>
            </form>
            <ul class="record-list"><li v-for="rule in maskRules" :key="rule.id"><span>数据源 {{ rule.datasource_id }} · {{ rule.table_name }}.{{ rule.column_name }} · {{ rule.mask_type }}</span><button class="danger-btn" @click="removeMaskRule(rule.id)">删除</button></li></ul>
          </article>
        </div>

        <div v-if="!loading && activeTab === 'permission'" class="permission-page">
          <div class="segmented-control">
            <button :class="{ active: activePermissionPanel === 'users' }" @click="activePermissionPanel = 'users'">用户</button>
            <button :class="{ active: activePermissionPanel === 'roles' }" @click="activePermissionPanel = 'roles'">角色</button>
            <button :class="{ active: activePermissionPanel === 'depts' }" @click="activePermissionPanel = 'depts'">部门</button>
          </div>

          <div v-if="activePermissionPanel === 'users'" class="grid gap-5 xl:grid-cols-[380px_1fr]">
            <article class="panel">
              <h3>新增用户</h3>
              <form class="form-grid" @submit.prevent="createUser">
                <input v-model="userForm.username" required placeholder="用户名" class="control">
                <input v-model="userForm.password" required type="password" placeholder="初始密码" class="control">
                <input v-model="userForm.real_name" placeholder="姓名" class="control">
                <input v-model="userForm.email" placeholder="邮箱" class="control">
                <input v-model="userForm.phone" placeholder="手机号" class="control">
                <select v-model="userForm.role_ids" multiple class="control multi-control">
                  <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.role_name }} / {{ role.role_code }}</option>
                </select>
                <select v-model="userForm.dept_ids" multiple class="control multi-control">
                  <option v-for="dept in flatDepts" :key="dept.id" :value="dept.id">{{ dept.dept_name }} / {{ dept.dept_code }}</option>
                </select>
                <button class="primary-btn">创建用户</button>
              </form>
            </article>
            <article class="panel table-panel">
              <table>
                <thead><tr><th>用户</th><th>姓名</th><th>角色</th><th>部门</th><th>状态</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="user in users" :key="user.id">
                    <td class="strong">{{ user.username }}</td>
                    <td>{{ user.real_name || '-' }}</td>
                    <td><span v-for="role in user.roles" :key="role.id" class="tag mr-1">{{ role.role_code }}</span></td>
                    <td>{{ formatDepartments(user.departments) }}</td>
                    <td>{{ user.status === 1 ? '启用' : '停用' }}</td>
                    <td class="right"><button class="danger-btn" @click="removeUser(user.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>

          <div v-if="activePermissionPanel === 'roles'" class="grid gap-5 xl:grid-cols-[360px_1fr]">
            <article class="panel">
              <h3>新增角色</h3>
              <form class="form-grid" @submit.prevent="createRole">
                <input v-model="roleForm.role_code" required placeholder="角色编码 role_code" class="control">
                <input v-model="roleForm.role_name" required placeholder="角色名称" class="control">
                <textarea v-model="roleForm.description" placeholder="说明" class="control"></textarea>
                <button class="primary-btn">创建角色</button>
              </form>
            </article>
            <article class="panel table-panel">
              <table>
                <thead><tr><th>角色编码</th><th>角色名称</th><th>说明</th><th>状态</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="role in roles" :key="role.id">
                    <td class="strong">{{ role.role_code }}</td>
                    <td>{{ role.role_name }}</td>
                    <td class="muted">{{ role.description || '-' }}</td>
                    <td>{{ role.status === 1 ? '启用' : '停用' }}</td>
                    <td class="right"><button class="danger-btn" @click="removeRole(role.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>

          <div v-if="activePermissionPanel === 'depts'" class="grid gap-5 xl:grid-cols-[360px_1fr]">
            <article class="panel">
              <h3>新增部门</h3>
              <form class="form-grid" @submit.prevent="createDept">
                <input v-model="deptForm.dept_name" required placeholder="部门名称" class="control">
                <input v-model="deptForm.dept_code" required placeholder="部门编码" class="control">
                <select v-model="deptForm.parent_id" class="control">
                  <option :value="0">无上级部门</option>
                  <option v-for="dept in flatDepts" :key="dept.id" :value="dept.id">{{ dept.dept_name }} / {{ dept.dept_code }}</option>
                </select>
                <input v-model="deptForm.order_num" type="number" placeholder="排序" class="control">
                <button class="primary-btn">创建部门</button>
              </form>
            </article>
            <article class="panel table-panel">
              <table>
                <thead><tr><th>部门名称</th><th>部门编码</th><th>上级 ID</th><th>状态</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="dept in flatDepts" :key="dept.id">
                    <td class="strong">{{ dept.dept_name }}</td>
                    <td>{{ dept.dept_code }}</td>
                    <td>{{ dept.parent_id || '-' }}</td>
                    <td>{{ dept.status === 1 ? '启用' : '停用' }}</td>
                    <td class="right"><button class="danger-btn" @click="removeDept(dept.id)">删除</button></td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>
        </div>

        <div v-if="!loading && activeTab === 'catalog'" class="grid gap-5 xl:grid-cols-[360px_1fr]">
          <article class="panel"><h3>发布数据产品</h3><form class="form-grid" @submit.prevent="createProduct"><input v-model="productForm.product_key" required placeholder="产品 Key" class="control"><input v-model="productForm.title" required placeholder="展示名称" class="control"><select v-model="productForm.datasource_id" required class="control"><option :value="0" disabled>选择数据源</option><option v-for="item in datasources" :key="item.id" :value="item.id">{{ item.db_name }}</option></select><textarea v-model="productForm.description" placeholder="说明" class="control"></textarea><textarea v-model="productForm.resource_definition" placeholder="TABLE 或手写只读 SQL 定义" class="control"></textarea><button class="primary-btn">保存草稿</button></form></article>
          <article class="panel table-panel"><h3>数据产品目录</h3><ul class="product-list"><li v-for="product in products" :key="product.id"><p>{{ product.title }}</p><small>{{ product.product_key }} · {{ product.resource_type }} · {{ product.status }}</small><span v-if="product.description">{{ product.description }}</span></li></ul></article>
        </div>

        <div v-if="!loading && activeTab === 'audit'" class="panel table-panel">
          <table>
            <thead><tr><th>时间</th><th>用户</th><th>操作</th><th>数据源</th><th>结果</th><th>详情</th></tr></thead>
            <tbody><tr v-for="audit in audits" :key="audit.id"><td>{{ audit.gmt_created }}</td><td>{{ audit.username }}</td><td>{{ audit.action }}</td><td>{{ audit.datasource_id || '-' }}</td><td>{{ audit.status }}</td><td class="muted">{{ audit.detail || '-' }}</td></tr></tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>
