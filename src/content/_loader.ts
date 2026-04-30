import type { Locale } from '../lib/seo/locale';
import type { PageContent } from './_types';

// Vite glob import — eagerly loads all content modules at build time.
const modules = import.meta.glob<{ default: PageContent }>('./*/*.json', { eager: true, import: 'default' });

export function loadContent(pageId: string, locale: Locale): PageContent | null {
  const key = `./${pageId}/${locale}.json`;
  const mod = modules[key] as unknown as PageContent | undefined;
  return mod ?? null;
}
