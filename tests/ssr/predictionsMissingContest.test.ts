// @vitest-environment node
// The predictions line-up is the only guide-page block that needs the contest
// file. Without it the page shows the error/retry state (never an endless
// placeholder), and the prerender check rejects such a page.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/seo/contentData', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/seo/contentData')>();
  return { ...real, bundledContent: (path: string) => (path === 'contests/2026.json' ? undefined : real.bundledContent(path)) };
});

import { render } from '@/entry-server';
import { checkPrerender } from '../../scripts/seo/checkPrerender';
import { headTagsHtml } from '@/lib/seo/headTags';

describe('predictions page without its contest file', () => {
  it('keeps the page and its head, shows the error state, and fails the prerender check', async () => {
    const url = '/en/eurovision-predictions';
    const r = await render(url);
    expect(r.status).toBe(200);
    expect(r.head?.title).toBe('Eurovision Predictions Game: Top 5 / Worst 5 Format & Strategy');
    expect(r.html).toContain('data-content-state="error"');
    expect(r.content['contests/2026.json']).toBeUndefined();

    const page = { url: `https://eurovision.games${url}`, html: `<html><head>${headTagsHtml(r.head!)}</head><body>${r.html}</body></html>` };
    const errors = checkPrerender([page], [], true);
    expect(errors).toEqual([`page rendered in content state "error" (a content file is missing): ${page.url}`]);
  });
});
