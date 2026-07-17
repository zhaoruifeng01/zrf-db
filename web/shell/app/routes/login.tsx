import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Form, Input } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { MetaDescriptor } from 'react-router';
import { useNavigate } from 'react-router';

import { POST, getToken, getUserInfo, setToken, setUserInfo, type UserInfo } from '@dbgpt/shared';

import type { LoginRequest, LoginResponse } from '~/types/auth';
import { LOGIN_PATH } from '~/types/auth';

/**
 * Login route - the first migrated route (ADR 0001 §中期).
 *
 * Migration template demonstrates:
 * - TanStack Query useMutation for server mutation
 * - @dbgpt/shared POST helper (single Axios instance, auth injection)
 * - @dbgpt/shared auth/storage for token + user info persistence
 * - Antd Form + App.useApp() for message
 * - react-router useNavigate for redirect
 * - Already-logged-in guard via getToken/getUserInfo
 */

export function meta(): MetaDescriptor[] {
  return [{ title: 'DB-GPT · Login' }];
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  // Redirect if already logged in.
  useEffect(() => {
    if (getToken() && getUserInfo()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const mutation = useMutation({
    mutationFn: async (values: LoginRequest) => {
      const res = await POST<LoginRequest, LoginResponse>(LOGIN_PATH, values);
      return res.data;
    },
    onSuccess: data => {
      if (data?.success && data.data?.access_token) {
        const loginData = data.data;
        setToken(loginData.access_token);
        const userInfo: UserInfo = {
          // Legacy-compatible fields (web/utils/storage.ts getUserId reads user_id).
          user_id: String(loginData.user_id),
          user_no: String(loginData.user_id),
          user_channel: 'dbgpt',
          user_name: loginData.username,
          nick_name: loginData.username,
          role: loginData.role_codes?.includes('admin') ? 'admin' : 'normal',
          role_codes: loginData.role_codes,
          dept_names: loginData.dept_names,
        };
        setUserInfo(userInfo);
        message.success('登录成功');
        navigate('/', { replace: true });
      } else {
        message.error(data?.err_msg || '登录失败');
      }
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { err_msg?: string } }; message?: string };
      const errMsg = e?.response?.data?.err_msg || e?.message || '登录失败';
      message.error(errMsg);
    },
  });

  return (
    <div className="flex min-h-dvh items-center justify-center" style={{ background: 'var(--surface-base)' }}>
      <div
        className="w-full max-w-sm rounded-lg p-8"
        style={{ background: 'var(--surface-elevated)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="mb-8 flex flex-col items-center">
          <h1 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            DB-GPT
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            登录到 DB-GPT
          </p>
        </div>
        <Form name="login" onFinish={values => mutation.mutate(values as LoginRequest)} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={mutation.isPending} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
