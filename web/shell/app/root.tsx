import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router';
import { App as AntdApp, ConfigProvider } from 'antd';
import { useEffect } from 'react';

import { bootApi } from '~/lib/api';
import { bootI18n } from '~/lib/i18n';
import { QueryProvider } from '~/lib/query';
import { applyThemeClass, usePreferences } from '~/store/preferences';
import { getAntdTheme } from '@/design-tokens';

import '~/styles/globals.css';

/**
 * Root layout for the DB-GPT shell.
 *
 * Provider stack (outer -> inner):
 *   <html> -> ConfigProvider (Antd theme from design tokens)
 *          -> AntdApp (message/notification/modal context)
 *          -> QueryProvider (TanStack Query - server state)
 *          -> <Outlet/> (route modules)
 *
 * Per ADR 0001: this is the single shell that strangler-迁移 will route
 * modules into. Each migrated domain becomes a route module under app/routes/.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const theme = usePreferences(s => s.theme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  return (
    <html lang="en" className={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ConfigProvider theme={getAntdTheme(theme)}>
          <AntdApp>
            <QueryProvider>{children}</QueryProvider>
          </AntdApp>
        </ConfigProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Boot the shared API client and i18n once on first render.
  bootApi();
  bootI18n();
  return <Outlet />;
}

/**
 * Top-level error boundary. Rendered without provider context if the error
 * originates in Layout itself, so we keep it dependency-free (no Antd).
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-4xl font-semibold">{error.status}</h1>
        <p className="text-base text-gray-600">{error.statusText || 'Route error'}</p>
        {error.data ? <pre className="max-w-lg overflow-auto text-sm text-gray-500">{String(error.data)}</pre> : null}
      </div>
    );
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-base text-gray-600">{message}</p>
    </div>
  );
}
