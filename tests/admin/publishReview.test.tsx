// CMS P5 publish screens: the diff (page side by side with the changed nodes
// marked, the text diff, the SEO delta), a single-page publish that ships
// only that doc, the site-wide preview → «Βγάλ' το live» flow, the deploy
// state and the failed-and-reverted notice. The edge functions are mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastHost } from '../../src/admin/ui/kit';

type Run = Record<string, unknown>;
const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  runs: [] as Run[],
  status: [] as Run[],
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    functions: { invoke: (name: string, opts: { body: unknown }) => h.invoke(name, opts.body) },
  },
}));

vi.mock('../../src/admin/publish/api', async (orig) => {
  const real = await orig<typeof import('../../src/admin/publish/api')>();
  const { bundledContent } = await import('../../src/lib/seo/contentData');
  const draftOf: Record<string, (d: Record<string, Record<string, Record<string, unknown>>>) => void> = {
    about: (d) => { d.en.hero.title = 'About Eurovision Games and the people who make it'; },
    'site-header': (d) => { (d.en.cta as Record<string, unknown>).createRoom = 'Create a room now'; },
  };
  return {
    ...real,
    loadDocPair: vi.fn(async (docId: string) => {
      const live = JSON.parse(JSON.stringify(bundledContent(`pages/${docId}.json`)));
      const draft = JSON.parse(JSON.stringify(live));
      draftOf[docId]?.(draft);
      return { docId, label: real.docTitle(docId), live, draft, updatedAt: '2026-11-22T10:00:00.000Z' };
    }),
    listRuns: vi.fn(async () => h.runs),
    getRun: vi.fn(async (id: number) => (h.runs.find((r) => r.id === id) ?? null)),
  };
});

import { PublishReview } from '../../src/admin/publish/PublishReview';
import { RunScreen } from '../../src/admin/publish/PublishScreens';
import { __resetPublishGuardForTests } from '../../src/admin/modules/contests/publish';

const wrap = (ui: ReactNode) => render(<MemoryRouter><ToastHost>{ui}</ToastHost></MemoryRouter>);
const NOW = () => new Date().toISOString();

beforeEach(() => {
  h.invoke.mockReset();
  h.runs = [];
  h.status = [];
  h.invoke.mockImplementation(async (name: string, body: Record<string, unknown>) => {
    if (name === 'publish-status') {
      const ids = body.run_ids as number[];
      return { data: { runs: h.status.filter((r) => ids.includes(r.id as number)) }, error: null };
    }
    return { data: null, error: { message: `unexpected ${name}` } };
  });
});
afterEach(() => __resetPublishGuardForTests());

describe('PublishReview: one page', () => {
  it('marks the changed nodes on both sides, lists the field, and the SEO delta with the guard verdict', async () => {
    wrap(<PublishReview docIds={['about']} />);
    await screen.findByTestId('visual-diff');
    await waitFor(() => {
      const live = screen.getByTestId('diff-frame-live').querySelectorAll('[data-cms-changed]');
      const draft = screen.getByTestId('diff-frame-draft').querySelectorAll('[data-cms-changed]');
      expect(live.length).toBeGreaterThan(0);
      expect(draft.length).toBeGreaterThan(0);
      expect(draft[0].getAttribute('data-cms-path')).toBe('about:en:hero.title');
      expect(draft[0].textContent).toContain('About Eurovision Games and the people who make it');
    });

    fireEvent.click(screen.getByRole('tab', { name: /^Κείμενα/ }));
    const text = screen.getByTestId('text-diff');
    expect(text.textContent).toMatch(/1 πεδίο αλλάζει/);
    expect(within(text).getByTestId('diff-after').textContent).toBe('About Eurovision Games and the people who make it');

    fireEvent.click(screen.getByRole('tab', { name: /^SEO/ }));
    const rows = screen.getAllByTestId('seo-row');
    expect(rows.map((r) => [r.getAttribute('data-field'), r.getAttribute('data-allowed')])).toEqual([['h1', 'true'], ['jsonLd', 'true']]);
    expect(rows[0].textContent).toMatch(/\/en\/about/);
    expect(rows[0].textContent).toMatch(/Ο έλεγχος το δέχεται/);
  });

  it('Publish confirms the single page, ships only it, then follows the build to Live', async () => {
    const run = { id: 77, status: 'ok', commit_sha: 'c0ffee1234', finished_at: NOW(), doc_ids: ['about'], target: 'main', deploy_state: 'building' };
    h.runs = [run];
    h.status = [{ ...run, deploy_state: 'ready', deploy_url: 'https://eurovision.games' }];
    h.invoke.mockImplementationOnce(async () => ({ data: { status: 'ok', run_id: 77, sha: 'c0ffee1234', files_changed: 2 }, error: null }));

    wrap(<PublishReview docIds={['about']} />);
    fireEvent.click(await screen.findByTestId('publish-docs'));
    const dialog = screen.getByRole('alertdialog', { name: 'Δημοσίευση: Σχετικά' });
    expect(dialog.textContent).toMatch(/Στέλνεται μόνο αυτή η σελίδα/);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Δημοσίευση' })); });

    expect(h.invoke).toHaveBeenCalledWith('publish-content', { cms: true, doc_ids: ['about'], target: 'main' });
    const card = await screen.findByTestId('run-card');
    await waitFor(() => expect(within(card).getByTestId('deploy-chip').getAttribute('data-state')).toBe('ready'));
    expect(within(card).getByTestId('deploy-chip').textContent).toBe('Live');
    expect(h.invoke).toHaveBeenCalledWith('publish-status', { run_ids: [77] });
  });
});

describe('PublishReview: a site-wide doc', () => {
  it('preview first, then «Βγάλ\' το live» once the preview is ready', async () => {
    const preview = {
      id: 90, status: 'ok', commit_sha: 'p0000001', finished_at: NOW(), doc_ids: ['site-header'], target: 'preview',
      deploy_state: 'building', shipped: [{ doc_id: 'site-header', updated_at: '2026-11-22T10:00:00.000Z' }],
    };
    h.invoke.mockImplementationOnce(async (_n: string, body: unknown) => {
      expect(body).toEqual({ cms: true, doc_ids: ['site-header'], target: 'preview' });
      h.runs = [preview];
      return { data: { status: 'ok', run_id: 90, sha: 'p0000001', files_changed: 2 }, error: null };
    });
    h.status = [{ ...preview, deploy_state: 'ready', deploy_url: 'https://eurovision-git-content-preview.vercel.app' }];

    wrap(<PublishReview docIds={['site-header']} />);
    const flow = await screen.findByTestId('site-preview-flow');
    expect(flow.textContent).toMatch(/Επηρεάζει κάθε σελίδα του site/);
    expect(flow.getAttribute('data-step')).toBe('0');
    fireEvent.click(screen.getByRole('tab', { name: /^SEO/ }));
    expect(screen.getByTestId('seo-delta').textContent).toMatch(/περνούν πρώτα από προεπισκόπηση/);

    await act(async () => { fireEvent.click(within(flow).getByRole('button', { name: 'Φτιάξε προεπισκόπηση' })); });
    const url = await screen.findByTestId('preview-url');
    expect(url.getAttribute('href')).toBe('https://eurovision-git-content-preview.vercel.app');
    expect(screen.getByTestId('site-preview-flow').getAttribute('data-step')).toBe('1');

    h.invoke.mockImplementationOnce(async (_n: string, body: unknown) => {
      expect(body).toEqual({ cms: true, promote: 90 });
      h.runs = [{ id: 91, status: 'ok', commit_sha: 'm0000001', finished_at: NOW(), doc_ids: ['site-header'], target: 'main', promoted_from: 90, deploy_state: 'building' }, preview];
      return { data: { status: 'ok', run_id: 91, sha: 'm0000001', files_changed: 2 }, error: null };
    });
    fireEvent.click(screen.getByTestId('go-live'));
    const dialog = screen.getByRole('alertdialog', { name: "Βγάλ' το live;" });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: "Βγάλ' το live" })); });
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('publish-content', { cms: true, promote: 90 }));
  });

  it('a preview older than the draft asks for a new one and cannot go live', async () => {
    h.runs = [{
      id: 92, status: 'ok', commit_sha: 'p2', finished_at: NOW(), doc_ids: ['site-header'], target: 'preview',
      deploy_state: 'ready', deploy_url: 'https://x.vercel.app', shipped: [{ doc_id: 'site-header', updated_at: '2026-11-21T10:00:00.000Z' }],
    }];
    wrap(<PublishReview docIds={['site-header']} />);
    expect(await screen.findByTestId('preview-stale')).toBeTruthy();
    expect(screen.getByTestId('go-live')).toBeDisabled();
  });
});

describe('RunScreen', () => {
  it('a failed build that was reverted says the site is as it was, with the revert commit', async () => {
    h.runs = [{
      id: 60, status: 'ok', commit_sha: 'fa11ed0000', finished_at: NOW(), started_at: NOW(), doc_ids: ['faq'], target: 'main',
      deploy_state: 'reverted', reverted_sha: 'beef000000', deploy_note: 'seo:diff: /en/faq title changed without intent',
    }];
    wrap(<RunScreen runId={60} />);
    const notice = await screen.findByTestId('failure-notice');
    expect(notice.textContent).toMatch(/Το build απέτυχε και η αλλαγή αναιρέθηκε μόνη της/);
    expect(notice.textContent).toMatch(/beef000/);
    expect(notice.textContent).toMatch(/title changed without intent/);
    expect(screen.getByTestId('deploy-chip').textContent).toBe('Απέτυχε · αναιρέθηκε');
    // Settled: no deploy polling.
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('a blocked revert raises the alert', async () => {
    h.runs = [{ id: 61, status: 'ok', commit_sha: 'fa11ed0001', finished_at: NOW(), doc_ids: ['faq'], target: 'main', deploy_state: 'revert_blocked', deploy_note: 'main moved on to abc1234' }];
    wrap(<RunScreen runId={61} />);
    expect((await screen.findByTestId('failure-notice')).textContent).toMatch(/η αυτόματη αναίρεση σταμάτησε/);
  });
});
