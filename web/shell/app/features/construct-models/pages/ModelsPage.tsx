/**
 * Models page - shell-native implementation.
 *
 * Replaces web/pages/construct/models/index.tsx. Server state lives in
 * TanStack Query (useModels/useStartModel/useStopModel) instead of useState +
 * apiInterceptors. The legacy file is removed once this page passes smoke
 * testing per ADR 0002 §阶段 3.
 */

import ModelForm from '@/components/model/model-form';
import BlurredCard, { InnerDropdown } from '@/new-components/common/blurredCard';
import { IModelData } from '@/types/model';
import { getModelIcon } from '@/utils/constants';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Modal, Tag } from 'antd';
import { dayjs } from '@/utils/date';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ConstructLayout from '~/components/construct/ConstructLayout';
import { useModels, useStartModel, useStopModel } from '~/features/construct-models/queries';

export default function ModelsPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { data: models } = useModels();
  const startMutation = useStartModel();
  const stopMutation = useStopModel();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busyModel, setBusyModel] = useState<string | null>(null);

  const isBusy = (info: IModelData) => busyModel === info.model_name || startMutation.isPending || stopMutation.isPending;

  async function startTheModel(info: IModelData) {
    if (isBusy(info)) return;
    modal.confirm({
      title: t('start_model'),
      content: t('confirm_start_model') + info.model_name,
      okButtonProps: { className: 'bg-button-gradient' },
      onOk: async () => {
        setBusyModel(info.model_name);
        try {
          const res = await startMutation.mutateAsync({
            host: info.host,
            port: info.port,
            model: info.model_name,
            worker_type: info.worker_type,
            delete_after: false,
            params: {},
          });
          if (res === true) {
            message.success(t('start_model_success'));
          }
        } finally {
          setBusyModel(null);
        }
      },
    });
  }

  async function stopTheModel(info: IModelData, deleteAfter = false) {
    if (isBusy(info)) return;
    const action = deleteAfter ? 'stop_and_delete' : 'stop';
    modal.confirm({
      title: t(`${action}_model`),
      content: t(`confirm_${action}_model`) + info.model_name,
      okButtonProps: { className: 'bg-button-gradient' },
      onOk: async () => {
        setBusyModel(info.model_name);
        try {
          const res = await stopMutation.mutateAsync({
            host: info.host,
            port: info.port,
            model: info.model_name,
            worker_type: info.worker_type,
            delete_after: deleteAfter,
            params: {},
          });
          if (res === true) {
            message.success(t(`${action}_model_success`));
          }
        } finally {
          setBusyModel(null);
        }
      },
    });
  }

  return (
    <ConstructLayout>
      <div className='px-6 overflow-y-auto'>
        <div className='flex justify-between items-center mb-6'>
          <div className='flex items-center gap-4' />
          <div className='flex items-center gap-4'>
            <Button
              className='border-none text-white bg-button-gradient'
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
            >
              {t('create_model')}
            </Button>
          </div>
        </div>

        <div className='flex flex-wrap mx-[-8px]'>
          {(models ?? []).map(item => (
            <BlurredCard
              logo={getModelIcon(item.model_name)}
              description={
                <div className='flex flex-col gap-1 relative text-xs bottom-4'>
                  <div className='flex overflow-hidden'>
                    <p className='w-28 text-gray-500 mr-2'>Host:</p>
                    <p className='flex-1 text-ellipsis'>{item.host}</p>
                  </div>
                  <div className='flex overflow-hidden'>
                    <p className='w-28 text-gray-500 mr-2'>Manage Host:</p>
                    <p className='flex-1 text-ellipsis'>
                      {item.manager_host}:{item.manager_port}
                    </p>
                  </div>
                  <div className='flex overflow-hidden'>
                    <p className='w-28 text-gray-500 mr-2'>Last Heart Beat:</p>
                    <p className='flex-1 text-ellipsis'>{dayjs(item.last_heartbeat).format('YYYY-MM-DD HH:mm:ss')}</p>
                  </div>
                </div>
              }
              name={item.model_name}
              key={item.model_name}
              RightTop={
                <InnerDropdown
                  menu={{
                    items: [
                      {
                        key: 'stop_model',
                        label: (
                          <span className='text-red-400' onClick={() => stopTheModel(item)}>
                            {t('stop_model')}
                          </span>
                        ),
                      },
                      {
                        key: 'start_model',
                        label: (
                          <span className='text-green-400' onClick={() => startTheModel(item)}>
                            {t('start_model')}
                          </span>
                        ),
                      },
                      {
                        key: 'stop_and_delete_model',
                        label: (
                          <span className='text-red-400' onClick={() => stopTheModel(item, true)}>
                            {t('stop_and_delete_model')}
                          </span>
                        ),
                      },
                    ],
                  }}
                />
              }
              rightTopHover={false}
              Tags={
                <div>
                  <Tag color={item.healthy ? 'green' : 'red'}>{item.healthy ? 'Healthy' : 'Unhealthy'}</Tag>
                  <Tag>{item.worker_type}</Tag>
                </div>
              }
            />
          ))}
        </div>
        <Modal
          width={800}
          open={isModalOpen}
          title={t('create_model')}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <ModelForm onCancel={() => setIsModalOpen(false)} onSuccess={() => setIsModalOpen(false)} />
        </Modal>
      </div>
    </ConstructLayout>
  );
}
