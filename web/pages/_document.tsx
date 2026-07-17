import { createCache, StyleProvider } from '@ant-design/cssinjs';
import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document';
import { doExtraStyle } from '../genAntdCss';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const cache = createCache();
    let fileName = '';
    const originalRenderPage = ctx.renderPage;
    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: App => props => (
          <StyleProvider cache={cache} hashPriority='high'>
            <App {...props} />
          </StyleProvider>
        ),
      });
    const initialProps = await Document.getInitialProps(ctx);

    fileName = doExtraStyle({
      cache,
    });

    return {
      ...initialProps,
      styles: (
        <>
          {initialProps.styles}
          {/* 1.2 inject css */}
          {fileName && <link rel='stylesheet' href={`/${fileName}`} />}
        </>
      ),
    };
  }

  render() {
    return (
      <Html lang='en'>
        <Head>
          <link rel='icon' href='/favicon.ico' />
          <meta name='description' content='Revolutionizing Database Interactions with Private LLM Technology' />
          <meta property='og:description' content='eosphoros-ai' />
          <meta property='og:title' content='DB-GPT' />

          <link rel='preconnect' href='https://fonts.googleapis.com' />
          <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
          <link
            href='https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap'
            rel='stylesheet'
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
