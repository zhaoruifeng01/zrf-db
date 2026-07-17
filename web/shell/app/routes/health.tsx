import { Button, Card, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { MetaDescriptor } from 'react-router';

import { getToken, getUserId } from '@dbgpt/shared';
import { usePreferences } from '~/store/preferences';

/**
 * Shell smoke route.
 *
 * Verifies the full boot chain: Vite dev server, React Router routing, Antd
 * ConfigProvider + design tokens, Zustand preferences store, @dbgpt/shared
 * auth/storage modules. Not a real product page - delete once real routes
 * land here.
 */

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT Shell · Health' }];
}

export default function HealthRoute() {
  const theme = usePreferences(s => s.theme);
  const toggleTheme = usePreferences(s => s.toggleTheme);
  const [tokenPresent, setTokenPresent] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setTokenPresent(getToken() !== null);
    setUserId(getUserId());
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-8">
      <Typography.Title level={2} style={{ marginBottom: 0 }}>
        DB-GPT Shell
      </Typography.Title>
      <Typography.Text type="secondary">
        Vite + React Router Framework Mode (ssr: false). Strangler target per ADR 0001.
      </Typography.Text>

      <Card title="Boot chain" size="small">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Row label="Theme mode" value={<Tag color="blue">{theme}</Tag>} />
          <Row label="Auth token" value={<Tag color={tokenPresent ? 'green' : 'default'}>{tokenPresent ? 'present' : 'absent'}</Tag>} />
          <Row label="User id" value={userId ? <code>{userId}</code> : <Typography.Text type="secondary">unset</Typography.Text>} />
        </Space>
      </Card>

      <Space>
        <Button type="primary" onClick={toggleTheme}>
          Toggle theme
        </Button>
      </Space>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Typography.Text type="secondary">{label}</Typography.Text>
      {value}
    </div>
  );
}
