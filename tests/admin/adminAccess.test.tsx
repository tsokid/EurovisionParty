// Access to /admin stays as it was (CMS P0, spec §3): every /admin/* URL,
// deep paths included, renders the noindex meta, gets the X-Robots-Tag
// header, is disallowed in robots.txt, and is served the SPA shell on reload.
// No public page links to /admin.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'glob';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { routes } from '../../src/routeConfig';

/** One URL per admin screen of the URL map, plus deep items and an unknown path. */
const ADMIN_URLS = [
  '/admin',
  '/admin/header',
  '/admin/footer',
  '/admin/footer/how-to-play',
  '/admin/pages',
  '/admin/pages/faq',
  '/admin/pages/archive-2004',
  '/admin/contests',
  '/admin/contests/2027',
  '/admin/contests/2027/entries',
  '/admin/contests/2027/entries/SE',
  '/admin/game/monitor',
  '/admin/game/parser',
  '/admin/game/parser/2026',
  '/admin/game/winners',
  '/admin/game/winners/3f1c',
  '/admin/game/avatars',
  '/admin/media',
  '/admin/settings',
  '/admin/system/admins',
  // Unknown screens, shaped like public routes, still open the admin.
  '/admin/faq',
  '/admin/nope',
  '/admin/x/schedule',
  '/admin/countries/greece',
  '/admin/past-contests/eurovision-2004-istanbul',
  '/admin/eurovision-2026/songs',
  '/admin/no/such/screen',
];

const cfg = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
  rewrites: Array<{ source: string; destination: string }>;
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

/** Vercel `source` patterns used here are path-to-regexp groups that read as plain regexes. */
const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path);

afterEach(() => cleanup());

describe('/admin/* access', () => {
  it.each(ADMIN_URLS)('%s renders the noindex meta (and the sign-in when signed out)', async (url) => {
    const router = createMemoryRouter(routes, { initialEntries: [url] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Admin access', {}, { timeout: 5000 })).toBeTruthy();
    // Set in an effect, which may land just after the first paint under load.
    await waitFor(() => {
      const metas = [...document.head.querySelectorAll('meta[name="robots"]')] as HTMLMetaElement[];
      expect(metas.map((m) => m.content)).toEqual(['noindex,nofollow']);
    });
    // The URL is kept, so signing in lands on the deep-linked screen.
    expect(router.state.location.pathname).toBe(url);
  });

  it('moving between admin URLs keeps the admin mounted (no second auth check, typed input kept)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/admin/pages/faq'] });
    render(<RouterProvider router={router} />);
    const email = (await screen.findByRole('textbox', {}, { timeout: 5000 })) as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'kept@example.com' } });
    for (const url of ['/admin/contests/2027/entries/SE', '/admin', '/admin/x/schedule', '/admin/game/parser/2026']) {
      await act(() => router.navigate(url));
      expect((screen.getByRole('textbox') as HTMLInputElement).value, url).toBe('kept@example.com');
    }
  });

  it.each(ADMIN_URLS)('%s gets X-Robots-Tag: noindex, nofollow, noarchive', (url) => {
    const tags = cfg.headers
      .filter((h) => matches(h.source, url))
      .flatMap((h) => h.headers)
      .filter((h) => h.key === 'X-Robots-Tag');
    expect(tags).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }]);
  });

  it.each(ADMIN_URLS)('%s reloads into the SPA shell (rewrite to /)', (url) => {
    const rw = cfg.rewrites.filter((r) => matches(r.source, url));
    expect(rw).toHaveLength(1);
    expect(rw[0].destination).toBe('/');
  });

  it('robots.txt disallows /admin and /admin/ for every user agent', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
    const groups = robots.split(/\n(?=User-agent:)/).filter((g) => g.startsWith('User-agent:'));
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g, g.split('\n')[0]).toMatch(/^Disallow: \/admin$/m);
      expect(g, g.split('\n')[0]).toMatch(/^Disallow: \/admin\/$/m);
    }
  });

  it('no public source, sitemap or llms.txt links to /admin', () => {
    const files = globSync('src/**/*.{ts,tsx}', { cwd: process.cwd(), ignore: ['src/admin/**'] });
    expect(files.length).toBeGreaterThan(50);
    const link = /\b(?:href|to)\s*[=:]\s*\{?\s*["'`]\/admin\b/;
    expect(files.filter((f) => link.test(readFileSync(resolve(process.cwd(), f), 'utf8')))).toEqual([]);
    for (const f of ['public/sitemap.xml', 'public/llms.txt']) {
      expect(readFileSync(resolve(process.cwd(), f), 'utf8'), f).not.toMatch(/\/admin\b/);
    }
  });
});
