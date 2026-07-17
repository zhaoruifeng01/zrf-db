import { ChatContext, ChatContextProvider } from '@/app/chat-context';
import SideBar from '@/components/layout/side-bar';
import { antdTokens } from '@/design-tokens/colors';
import FloatHelper from '@/new-components/layout/FloatHelper';
import { STORAGE_LANG_KEY, STORAGE_TOKEN_KEY, STORAGE_USERINFO_KEY } from '@/utils/constants/index';
import { App, ConfigProvider, MappingAlgorithm, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import classNames from 'classnames';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../app/i18n';
import '../nprogress.css';
import '../styles/globals.css';

const antdDarkTheme: MappingAlgorithm = (seedToken, mapToken) => {
  return {
    ...theme.darkAlgorithm(seedToken, mapToken),
    ...antdTokens.dark,
  };
};

function CssWrapper({ children }: { children: React.ReactElement }) {
  const { mode } = useContext(ChatContext);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (mode) {
      document.body?.classList?.add(mode);
      if (mode === 'light') {
        document.body?.classList?.remove('dark');
      } else {
        document.body?.classList?.remove('light');
      }
    }
  }, [mode]);

  useEffect(() => {
    i18n.changeLanguage?.(window.localStorage.getItem(STORAGE_LANG_KEY) || 'zh');
  }, [i18n]);

  return (
    <div>
      {/* <TopProgressBar /> */}
      {children}
    </div>
  );
}

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isMenuExpand, mode } = useContext(ChatContext);
  const { i18n } = useTranslation();
  const [isLogin, setIsLogin] = useState(false);

  const router = useRouter();

  // 登录检测
  const handleAuth = async () => {
    setIsLogin(false);
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    const userInfo = localStorage.getItem(STORAGE_USERINFO_KEY);
    if (token && userInfo) {
      setIsLogin(true);
    } else if (!router.pathname.startsWith('/login') && !router.pathname.startsWith('/share')) {
      router.push('/login');
    }
  };

  useEffect(() => {
    handleAuth();
  }, []);

  if (!isLogin && !router.pathname.startsWith('/share') && !router.pathname.startsWith('/login')) {
    return null;
  }

  const renderContent = () => {
    // Login page renders without sidebar
    if (router.pathname.startsWith('/login')) {
      return <>{children}</>;
    }

    // Hide sidebar for mobile, share pages, and task replay mode (from_task)
    const hideSidebar =
      router.pathname.includes('mobile') || router.pathname.startsWith('/share') || !!router.query.from_task;

    if (router.pathname.includes('mobile') || router.pathname.startsWith('/share')) {
      return <>{children}</>;
    }
    return (
      <div className='flex w-screen h-dvh overflow-hidden'>
        <Head>
          <meta name='viewport' content='initial-scale=1.0, width=device-width, maximum-scale=1' />
        </Head>
        {router.pathname !== '/construct/app/extra' && !hideSidebar && (
          <div className={classNames('transition-[width]', isMenuExpand ? 'w-60' : 'w-20', 'hidden', 'md:block')}>
            <SideBar />
          </div>
        )}
        <div className='flex flex-col flex-1 relative overflow-hidden'>{children}</div>
        {!hideSidebar && <FloatHelper />}
      </div>
    );
  };

  return (
    <ConfigProvider
      locale={i18n.language === 'en' ? enUS : zhCN}
      theme={{
        token: antdTokens.light,
        algorithm: mode === 'dark' ? antdDarkTheme : undefined,
      }}
    >
      <App>{renderContent()}</App>
    </ConfigProvider>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChatContextProvider>
      <CssWrapper>
        <LayoutWrapper>
          <Component {...pageProps} />
        </LayoutWrapper>
      </CssWrapper>
    </ChatContextProvider>
  );
}

export default MyApp;
