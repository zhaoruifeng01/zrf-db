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
import { t } from 'i18next';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import './style.css';

function ConstructLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  const [userRole, setUserRole] = useState<string>('normal');
  const items = [
    {
      key: 'app',
      name: t('App'),
      path: '/app',
      icon: <AppstoreOutlined />,
      // operations: (
      //   <Button
      //     className='border-none text-white bg-button-gradient h-full flex items-center'
      //     icon={<PlusOutlined className='text-base' />}
      //     // onClick={handleCreate}
      //   >
      //     {t('create_app')}
      //   </Button>
      // ),
    },
    {
      key: 'flow',
      name: t('awel_flow'),
      icon: <ForkOutlined />,
      path: '/flow',
    },
    {
      key: 'models',
      name: t('model_manage'),
      path: '/models',
      icon: <Icon component={ModelSvg} />,
    },
    {
      key: 'database',
      name: t('Database'),
      icon: <ConsoleSqlOutlined />,
      path: '/database',
    },
    {
      key: 'governance',
      name: '数据治理',
      icon: <TeamOutlined />,
      path: '/governance',
    },
    {
      key: 'knowledge',
      name: t('Knowledge_Space'),
      icon: <PartitionOutlined />,
      path: '/knowledge',
    },
    // {
    //   key: 'agent',
    //   name: t('Plugins'),
    //   path: '/agent',
    //   icon: <BuildOutlined />,
    // },
    {
      key: 'prompt',
      name: t('Prompt'),
      icon: <MessageOutlined />,
      path: '/prompt',
    },
    {
      key: 'skills',
      name: t('skills') || '技能',
      path: '/skills',
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'connectors',
      name: t('connectors'),
      icon: <ApiOutlined />,
      path: '/connectors',
    },
    {
      key: 'scheduled-tasks',
      name: t('scheduled_tasks'),
      icon: <ClockCircleOutlined />,
      path: '/scheduled-tasks',
    },
    {
      key: 'dbgpts',
      name: t('dbgpts_community'),
      path: '/dbgpts',
      icon: <BuildOutlined />,
    },
    ...(userRole === 'admin'
      ? [
          {
            key: 'permission',
            name: t('permission_management'),
            path: '/permission',
            icon: <TeamOutlined />,
          },
        ]
      : []),
  ];
  const router = useRouter();
  const activeKey = router.pathname.split('/')[2];
  // const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches; // unused

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem(STORAGE_USERINFO_KEY) ?? '{}');
      setUserRole(user?.role || 'normal');
    } catch {
      setUserRole('normal');
    }
  }, []);

  return (
    <div className='flex flex-col h-full w-full  dark:bg-gradient-dark bg-gradient-light bg-cover bg-center'>
      <ConfigProvider
        theme={{
          components: {
            Button: {
              // defaultBorderColor: 'white',
            },
            Segmented: {
              itemSelectedBg: '#2867f5',
              itemSelectedColor: 'white',
            },
          },
        }}
      >
        <Tabs
          className={className}
          // tabBarStyle={{
          //   background: '#edf8fb',
          //   border: 'none',
          //   height: '3.5rem',
          //   padding: '0 1.5rem',
          //   color: !isDarkMode ? 'white' : 'black',
          // }}
          activeKey={activeKey}
          items={items.map(items => {
            return {
              key: items.key,
              label: items.name,
              children: children,
              icon: items.icon,
            };
          })}
          onTabClick={key => {
            router.push(`/construct/${key}`);
          }}
          // tabBarExtraContent={
          //   <Button
          //     className='border-none text-white bg-button-gradient h-full flex items-center'
          //     icon={<PlusOutlined className='text-base' />}
          //     // onClick={handleCreate}
          //   >
          //     {t('create_app')}
          //   </Button>
          // }
        />
      </ConfigProvider>
    </div>
  );
}

export default ConstructLayout;
