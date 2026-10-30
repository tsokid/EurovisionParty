import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router-dom';
import { routes } from './routeConfig';
import i18n from './i18n';
import { createHeadCollector, HeadProvider } from './lib/seo/HeadContext';
import type { HeadInput } from './lib/seo/headTags';
import { isLocale, stripLocaleFromPath, type Locale } from './lib/seo/locale';

const ORIGIN = 'https://eurovision.games';

export interface RenderResult {
  html: string;
  head: HeadInput | null;
  status: number;
  lang: Locale;
}

function localeOf(url: string): Locale {
  const pathname = url.split(/[?#]/)[0];
  if (stripLocaleFromPath(pathname) === pathname) return 'en';
  const seg = pathname.split('/')[1];
  return isLocale(seg) ? seg : 'en';
}

/**
 * Render one public URL (e.g. `/el/faq`) to HTML at build time.
 * The router has no loaders, so no hydration data is emitted.
 */
export async function render(url: string): Promise<RenderResult> {
  const lang = localeOf(url);
  await i18n.changeLanguage(lang);

  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(ORIGIN + url));
  if (context instanceof Response) {
    return { html: '', head: null, status: context.status, lang };
  }

  const router = createStaticRouter(handler.dataRoutes, context);
  const collector = createHeadCollector();
  const html = renderToString(
    <StrictMode>
      <HeadProvider collector={collector}>
        <StaticRouterProvider router={router} context={context} hydrate={false} />
      </HeadProvider>
    </StrictMode>,
  );

  return { html, head: collector.head, status: collector.status, lang };
}
