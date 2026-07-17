/**
 * Shell-native Construct layout.
 *
 * Replaces web/new-components/layout/Construct.tsx for migrated construct
 * routes. Differences from the legacy layout:
 * - Theme comes from usePreferences (Zustand) instead of ChatContext.
 * - Routing uses React Router's useLocation/useNavigate instead of next/router.
 * - Styling uses Tailwind + Ant Design theme tokens; no separate style.css.
 *
 * The legacy ConstructLayout stays in place for unmigrated construct routes
 * (app, flow, knowledge, database, ...) that still run through the Next.js
 * app or shell wrappers. Once those routes migrate, the legacy file is removed
 * per ADR 0002 §阶段 3.
 */

import { ModelSvg } from '@/components/icons';
import { STORAGE_USERINFO_KEY } from '@/utils/constants/index';
import Icon, {
  ApiOutlined,
  AppstoreOutlined,
  BuildOutlined,
  ClockCircleOutlined,
  ConsoleSqlOutlined,
  ForkOutlined,
  MessageOutlined,
  PartitionOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { ConfigProvider, Tabs } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { usePreferences } from '~/store/preferences';

interface ConstructItem {
  key: string;
  name: string;
  path: string;
  icon: React.ReactNode;
}

const BASE_ITEMS: ConstructItem[] = [
  { key: 'app', name: t('App'), path: '/construct/app', icon: <AppstoreOutlined /> },
  { key: 'flow', name: t('awel_flow'), path: '/construct/flow', icon: <ForkOutlined /> },
  { key: 'models', name: t('model_manage'), path: '/construct/models', icon: <Icon component={ModelSvg} /> },
  { key: 'database', name: t('Database'), path: '/construct/database', icon: <ConsoleSqlOutlined /> },
  { key: 'knowledge', name: t('Knowledge_Space'), path: '/construct/knowledge', icon: <PartitionOutlined /> },
  { key: 'prompt', name: t('Prompt'), path: '/construct/prompt', icon: <MessageOutlined /> },
  { key: 'skills', name: t('skills') || '技能', path: '/construct/skills', icon: <ThunderboltOutlined /> },
  { key: 'connectors', name: t('connectors'), path: '/construct/connectors', icon: <ApiOutlined /> },
  { key: 'scheduled-tasks', name: t('scheduled_tasks'), path: '/construct/scheduled-tasks', icon: <ClockCircleOutlined /> },
  { key: 'dbgpts', name: t('dbgpts_community'), path: '/construct/dbgpts', icon: <BuildOutlined /> },
];

const ConstructLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const theme = usePreferences(s => s.theme);
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string>('normal');

  // activeKey = second path segment ("/construct/models" -> "models")
  const activeKey = location.pathname.split('/')[2] ?? '';

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem(STORAGE_USERINFO_KEY) ?? '{}');
      setUserRole(user?.role || 'normal');
    } catch {
      setUserRole('normal');
    }
  }, []);

  const items: ConstructItem[] = userRole === 'admin' ? [...BASE_ITEMS, { key: 'permission', name: t('permission_management'), path: '/construct/permission', icon: <TeamOutlined /> }] : BASE_ITEMS;

  return (
    <div className='flex flex-col h-full w-full dark:bg-gradient-dark bg-gradient-light bg-cover bg-center'>
      <ConfigProvider
        theme={{
          components: {
            Tabs: {
              colorBorderSecondary: isDark ? '#6f7f95' : undefined,
            },
            Segmented: {
              itemSelectedBg: '#2867f5',
              itemSelectedColor: 'white',
            },
          },
        }}
      >
        <Tabs
          className={classNames('construct-tabs', isDark && 'tabs-dark', className)}
          activeKey={activeKey}
          items={items.map(item => ({
            key: item.key,
            label: item.name,
            children,
            icon: item.icon,
          }))}
          onTabClick={key => {
            const target = items.find(it => it.key === key);
            if (target) navigate(target.path);
          }}
        />
      </ConfigProvider>
    </div>
  );
};

export default ConstructLayout;
