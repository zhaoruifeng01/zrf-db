import { loginUser } from '@/client/api/permission';
import { STORAGE_TOKEN_KEY, STORAGE_USERINFO_KEY } from '@/utils/constants/index';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, message } from 'antd';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to home
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    const userInfo = localStorage.getItem(STORAGE_USERINFO_KEY);
    if (token && userInfo) {
      router.replace('/');
    }
  }, [router]);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await loginUser(values);
      const data = res.data?.data;
      if (data?.access_token) {
        // Store token
        localStorage.setItem(STORAGE_TOKEN_KEY, data.access_token);
        // Build user info compatible with existing code
        const userInfo = {
          user_channel: 'dbgpt',
          user_no: String(data.user_id),
          nick_name: data.username,
          role: data.role_codes?.includes('admin') ? 'admin' : 'normal',
          role_codes: data.role_codes,
          dept_names: data.dept_names,
        };
        localStorage.setItem(STORAGE_USERINFO_KEY, JSON.stringify(userInfo));
        message.success(t('login_success'));
        router.replace('/');
      } else {
        message.error(res.data?.err_msg || t('login_failed'));
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.err_msg || err?.message || t('login_failed');
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-dvh bg-[#f5f5f5] dark:bg-[#1a1d28]'>
      <div className='w-full max-w-sm p-8 bg-white dark:bg-[#232734] rounded-lg shadow-md'>
        <div className='flex flex-col items-center mb-8'>
          <Image src='/logo_zh_latest.png' alt='DB-GPT' width={180} height={40} className='mb-4' />
          <h1 className='text-xl font-semibold text-gray-800 dark:text-gray-100'>{t('login_title')}</h1>
        </div>
        <Form name='login' onFinish={onFinish} autoComplete='off' size='large'>
          <Form.Item name='username' rules={[{ required: true, message: t('username_required') }]}>
            <Input prefix={<UserOutlined />} placeholder={t('username_required')} />
          </Form.Item>
          <Form.Item name='password' rules={[{ required: true, message: t('password_required') }]}>
            <Input.Password prefix={<LockOutlined />} placeholder={t('password_required')} />
          </Form.Item>
          <Form.Item>
            <Button type='primary' htmlType='submit' loading={loading} block>
              {t('login')}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
