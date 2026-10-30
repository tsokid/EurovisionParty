/**
 * Build step: render every public URL with the SSR bundle and write static
 * HTML into dist/. Runs after `vite build` (client) and
 * `vite build --ssr src/entry-server.tsx --outDir dist-server`.
 *
 * dist/index.html is left untouched as the SPA shell for app routes.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allPageUrls } from '../src/lib/seo/registry';
import { headTagsHtml } from '../src/lib/seo/headTags';
import type { RenderResult } from '../src/entry-server';
import { injectPage, outputPath } from './prerender/injectPage';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SERVER_ENTRY = resolve(ROOT, 'dist-server/entry-server.js');
const NOT_FOUND_URL = '/en/__404';

type Render = (url: string) => Promise<RenderResult>;

function writePage(file: string, content: string): void {
  const target = resolve(DIST, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

async function main(): Promise<void> {
  if (!existsSync(SERVER_ENTRY)) throw new Error(`SSR bundle not found at ${SERVER_ENTRY}`);
  const template = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  const { render } = (await import(pathToFileURL(SERVER_ENTRY).href)) as { render: Render };

  const failures: string[] = [];
  let written = 0;

  // Sequential on purpose: render() switches i18n's global language.
  const jobs = [
    ...allPageUrls().map(({ path }) => ({ url: path, file: outputPath(path), expect: 200, hydrate: true })),
    { url: NOT_FOUND_URL, file: '404.html', expect: 404, hydrate: false },
  ];

  for (const job of jobs) {
    const result = await render(job.url);
    if (result.status !== job.expect) {
      failures.push(`${job.url}: status ${result.status}, expected ${job.expect}`);
      continue;
    }
    if (!result.head) {
      failures.push(`${job.url}: no head tags collected`);
      continue;
    }
    if (!result.html) {
      failures.push(`${job.url}: empty html`);
      continue;
    }
    const html = injectPage(template, {
      html: result.html,
      headHtml: headTagsHtml(result.head),
      lang: result.lang,
    }, { prerenderedFlag: job.hydrate });
    writePage(job.file, html);
    written++;
    console.log(`  ${job.expect === 404 ? '404' : 'ok '} ${job.url} -> dist/${job.file}`);
  }

  if (failures.length) {
    console.error(`\nprerender: ${failures.length} page(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`\nprerender: wrote ${written} pages`);
}

main().catch((err) => {
  console.error('prerender: fatal', err);
  process.exit(1);
});
