/**
 * Prompt list page - shell-native implementation.
 *
 * Replaces web/pages/construct/prompt/index.tsx. Server state via TanStack
 * Query; navigation via React Router; edit-handoff via navigate state instead
 * of the legacy `edit_prompt_data` localStorage entry (ADR 0002 §阶段 2 -
 * persistence goes through the unified storage adapter, route state stays in
 * the router).
 */

import useUser from '@/hooks/use-user';
import { IPrompt } from '@/types/prompt';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Popconfirm, Segmented, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SegmentedProps } from 'antd';
import { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import ConstructLayout from '~/components/construct/ConstructLayout';
import { useDeletePrompt, usePromptList } from '~/features/construct-prompt/queries';

const LangMap = { zh: '中文', en: 'English' } as const;
const PAGE_SIZE = 6;

const DeleteBtn: React.FC<{ record: IPrompt }> = ({ record }) => {
  const userInfo = useUser();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const deleteMutation = useDeletePrompt();

  if (userInfo?.user_id !== record?.user_id) {
    return null;
  }

  return (
    <Popconfirm
      title='确认删除吗？'
      onConfirm={async () => {
        try {
          await deleteMutation.mutateAsync(record);
          message.success('删除成功');
        } catch {
          message.error('删除失败');
        }
      }}
    >
      <Button loading={deleteMutation.isPending}>{t('Delete')}</Button>
    </Popconfirm>
  );
};

const getColumns = (t: TFunction, handleEdit: (prompt: IPrompt) => void): ColumnsType<IPrompt> => [
  { title: t('Prompt_Info_Name'), dataIndex: 'prompt_name', key: 'prompt_name', width: '10%' },
  { title: t('Prompt_Info_Scene'), dataIndex: 'chat_scene', key: 'chat_scene', width: '10%' },
  {
    title: t('language'),
    dataIndex: 'prompt_language',
    key: 'prompt_language',
    render: lang => (lang ? LangMap[lang as keyof typeof LangMap] : '-'),
    width: '10%',
  },
  {
    title: t('Prompt_Info_Content'),
    dataIndex: 'content',
    key: 'content',
    render: content => <Typography.Paragraph ellipsis={{ rows: 2, tooltip: true }}>{content}</Typography.Paragraph>,
  },
  {
    title: t('Operation'),
    dataIndex: 'operate',
    key: 'operate',
    render: (_, record) => (
      <Space align='center'>
        <Button onClick={() => handleEdit(record)} type='primary'>
          {t('Edit')}
        </Button>
        <DeleteBtn record={record} />
      </Space>
    ),
  },
];

export default function PromptListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [promptType, setPromptType] = useState<string>('common');
  const [page, setPage] = useState(1);
  const { data: promptList, isLoading } = usePromptList({ page, page_size: PAGE_SIZE });

  // promptType currently has a single option ('common'); the state is kept to
  // preserve the original UX (segmented control) and to allow re-enabling the
  // 'private' tab without reshaping the component later.
  void promptType;

  const handleEdit = (prompt: IPrompt) => {
    navigate('/construct/prompt/edit', { state: { prompt } });
  };

  const handleAdd = () => {
    navigate('/construct/prompt/add');
  };

  const items: SegmentedProps['options'] = [
    { value: 'common', label: t('Public') + ' Prompts' },
  ];

  return (
    <ConstructLayout>
      <div className='prompt-container px-6 py-2 md:p-6 h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-6'>
          <div className='flex items-center gap-4'>
            <Segmented
              className='backdrop-filter backdrop-blur-lg bg-white bg-opacity-30 border-2 border-white rounded-lg shadow p-1 dark:border-[#6f7f95] dark:bg-[#6f7f95] dark:bg-opacity-60'
              options={items}
              onChange={value => setPromptType(value as string)}
              value={promptType}
            />
          </div>
          <div className='flex items-center gap-4 h-10'>
            <Button className='border-none text-white bg-button-gradient h-full' onClick={handleAdd} icon={<PlusOutlined />}>
              {t('Add')} Prompts
            </Button>
          </div>
        </div>
        <Table
          columns={getColumns(t, handleEdit)}
          dataSource={promptList?.items || []}
          loading={isLoading}
          rowKey={record => record.prompt_name}
          pagination={{
            pageSize: PAGE_SIZE,
            total: promptList?.total_count,
            onChange: (nextPage, pageSize) => {
              setPage(nextPage);
              void pageSize;
            },
          }}
        />
      </div>
    </ConstructLayout>
  );
}
