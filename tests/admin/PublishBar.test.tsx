import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  summary: { changed_years: [] as number[], since: null as string | null },
  lastRun: null as Row | null,
  summaryError: null as { message: string } | null,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => {
      h.rpc(name, args);
      if (name === 'unpublished_summary') {
        return Promise.resolve(h.summaryError ? { data: null, error: h.summaryError } : { data: h.summary, error: null });
      }
      if (name === 'last_publish_run') return Promise.resolve({ data: h.lastRun, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    functions: { invoke: (name: string, opts: unknown) => h.invoke(name, opts) },
  },
}));

import { PublishBar } from '../../src/admin/modules/contests/PublishBar';
import {
  TIMEOUT_TEXT,
  PUBLISH_TIMEOUT_MS,
  __resetPublishGuardForTests,
  formatRunTime,
  invokePublish,
  usePublisher,
} from '../../src/admin/modules/contests/publish';

function Harness() {
  return <PublishBar publisher={usePublisher()} />;
}

const FINISHED = '2026-10-30T18:04:00Z';
const httpError = (body: unknown) => ({
  data: null,
  error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => body } },
});

describe('PublishBar', () => {
  beforeEach(() => {
    h.rpc.mockClear();
    h.invoke.mockReset();
    h.summary = { changed_years: [2024, 2025, 2027], since: '2026-10-29T10:00:00Z' };
    h.lastRun = { id: 7, status: 'ok', commit_sha: 'abc1234def5678', finished_at: FINISHED, error: null };
    h.summaryError = null;
  });
  afterEach(() => {
    vi.useRealTimers();
    __resetPublishGuardForTests();
  });

  it('shows the unpublished changes, the last run with its commit link, and the deploy note', async () => {
    render(<Harness />);
    expect(await screen.findByText('3 unpublished changes (years 2024-2025, 2027)')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'abc1234' }) as HTMLAnchorElement;
    expect(link.href).toBe('https://github.com/tsokid/EurovisionParty/commit/abc1234def5678');
    expect(screen.getByText(/· \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByText(/Last publish: ok/)).toBeTruthy();
    expect(screen.getByText('The site updates about 2 minutes after a successful publish.')).toBeTruthy();
  });

  it('says Never published before the first run, and nothing to publish when up to date', async () => {
    h.summary = { changed_years: [1956, 1957], since: null };
    h.lastRun = null;
    const { unmount } = render(<Harness />);
    expect(await screen.findByText('Never published')).toBeTruthy();
    unmount();

    h.summary = { changed_years: [], since: '2026-10-29T10:00:00Z' };
    h.lastRun = { id: 1, status: 'noop', commit_sha: null, finished_at: FINISHED, error: null };
    render(<Harness />);
    expect(await screen.findByText('No unpublished changes')).toBeTruthy();
    expect(screen.getByText(/Last publish: noop/)).toBeTruthy();
  });

  it('a single changed year reads in the singular', async () => {
    h.summary = { changed_years: [2025], since: '2026-10-29T10:00:00Z' };
    render(<Harness />);
    expect(await screen.findByText('1 unpublished change (year 2025)')).toBeTruthy();
  });

  it('Publish invokes publish-content, disables itself while running, then shows the commit and refreshes', async () => {
    let resolve!: (v: unknown) => void;
    h.invoke.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<Harness />);
    const button = (await screen.findByRole('button', { name: 'Publish' })) as HTMLButtonElement;
    await screen.findByText('3 unpublished changes (years 2024-2025, 2027)');
    const summariesBefore = h.rpc.mock.calls.filter(([n]) => n === 'unpublished_summary').length;

    fireEvent.click(button);
    // The manual Publish ships contests and CMS page drafts (I3).
    expect(h.invoke).toHaveBeenCalledWith('publish-content', { body: { cms: true } });
    const running = (await screen.findByRole('button', { name: 'Publishing…' })) as HTMLButtonElement;
    expect(running.disabled).toBe(true);

    h.summary = { changed_years: [], since: '2026-10-30T18:03:00Z' };
    h.lastRun = { id: 8, status: 'ok', commit_sha: 'fff0000aaa', finished_at: FINISHED, error: null };
    resolve({ data: { status: 'ok', run_id: 8, sha: 'fff0000aaa', files_changed: 2 }, error: null });

    expect(await screen.findByText(/Published: 2 files changed/)).toBeTruthy();
    expect(await screen.findByText('No unpublished changes')).toBeTruthy();
    expect(h.rpc.mock.calls.filter(([n]) => n === 'unpublished_summary').length).toBeGreaterThan(summariesBefore);
    expect(((await screen.findByRole('button', { name: 'Publish' })) as HTMLButtonElement).disabled).toBe(false);
  });

  it('formatRunTime is a fixed YYYY-MM-DD HH:MM in local time, whatever the locale', () => {
    // Built from local components, so the expectation holds in any time zone.
    expect(formatRunTime(new Date(2026, 9, 3, 8, 4).toISOString())).toBe('2026-10-03 08:04');
    expect(formatRunTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe('2026-12-31 23:59');
  });

  it('Publish button disables after first click', async () => {
    let resolve!: (v: unknown) => void;
    h.invoke.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<Harness />);
    const button = await screen.findByRole('button', { name: 'Publish' });
    fireEvent.click(button);
    fireEvent.click(button);
    resolve({ data: { status: 'noop', run_id: 9, sha: null, files_changed: 0 }, error: null });
    expect(await screen.findByText('Nothing to publish: the site is already up to date.')).toBeTruthy();
    expect(h.invoke).toHaveBeenCalledTimes(1);
  });

  it('a second publisher during a run gets a trailing run, not the stale one', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    h.invoke.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    render(<><Harness /><Harness /></>);
    const [a, b] = await screen.findAllByRole('button', { name: 'Publish' });
    fireEvent.click(a);
    fireEvent.click(b);
    expect(h.invoke).toHaveBeenCalledTimes(1);
    resolvers[0]({ data: { status: 'ok', run_id: 9, sha: 'aaa0000', files_changed: 1 }, error: null });
    expect(await screen.findByText(/Published: 1 file changed/)).toBeTruthy();
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    // Only the first bar shows the first run; the queued caller did not clear it.
    expect(screen.getAllByText(/Published: 1 file changed/)).toHaveLength(1);
    resolvers[1]({ data: { status: 'ok', run_id: 10, sha: 'bbb0000', files_changed: 4 }, error: null });
    expect(await screen.findByText(/Published: 4 files changed/)).toBeTruthy();
    expect(h.invoke).toHaveBeenCalledTimes(2);
  });

  it('noop says the site is up to date', async () => {
    h.invoke.mockResolvedValue({ data: { status: 'noop', run_id: 9, sha: null, files_changed: 0 }, error: null });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Nothing to publish: the site is already up to date.')).toBeTruthy();
  });

  it('busy (409) asks to try again in a minute', async () => {
    h.invoke.mockResolvedValue(httpError({ status: 'busy', run_id: null, sha: null, files_changed: 0, error: 'publish already running' }));
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Another publish is running — try again in a minute')).toBeTruthy();
  });

  it('an error (500) is shown and the Publish button stays available', async () => {
    h.invoke.mockResolvedValue(httpError({ status: 'error', run_id: 3, sha: null, files_changed: 0, error: 'GitHub 401: Bad credentials' }));
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Publish failed: GitHub 401: Bad credentials')).toBeTruthy();
    expect(((screen.getByRole('button', { name: 'Publish' })) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a request that never reached the function shows through formatError', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Publish failed: Failed to send a request to the Edge Function')).toBeTruthy();
  });

  it('shows a warning that came back with the run', async () => {
    h.invoke.mockResolvedValue({
      data: { status: 'ok', run_id: 8, sha: 'fff0000aaa', files_changed: 1, warning: 'end_publish failed: timeout' },
      error: null,
    });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Warning: end_publish failed: timeout')).toBeTruthy();
  });

  it('counts changed CMS pages with the years', async () => {
    h.summary = { changed_years: [2024, 2025], changed_docs: ['about', 'faq', 'rules'], since: '2026-10-29T10:00:00Z' } as typeof h.summary;
    render(<Harness />);
    expect(await screen.findByText('5 unpublished changes: 2 years (2024-2025), 3 pages (about, faq, rules)')).toBeTruthy();
  });

  it('the Publish button says it ships the page drafts too, when there are any (I3)', async () => {
    h.summary = { changed_years: [2024], changed_docs: ['about', 'faq'], since: '2026-10-29T10:00:00Z' } as typeof h.summary;
    const { unmount } = render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Publish (contests + 2 page drafts)' })).toBeTruthy();
    unmount();
    h.summary = { changed_years: [], changed_docs: ['about'], since: '2026-10-29T10:00:00Z' } as typeof h.summary;
    render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Publish (contests + 1 page draft)' })).toBeTruthy();
  });

  it('pages alone count as unpublished changes, in the singular too', async () => {
    h.summary = { changed_years: [], changed_docs: ['about'], since: '2026-10-29T10:00:00Z' } as typeof h.summary;
    render(<Harness />);
    expect(await screen.findByText('1 unpublished change: 1 page (about)')).toBeTruthy();
  });

  it('lists the content warnings of a publish in a collapsible list', async () => {
    h.invoke.mockResolvedValue({
      data: {
        status: 'ok', run_id: 8, sha: 'fff0000aaa', files_changed: 1,
        warnings: [
          { doc_id: 'about', locale: 'en', path: 'meta.title', message: 'Longer than recommended: 70 characters, recommended max 60' },
          { doc_id: 'faq', locale: null, path: '', message: 'Doc-level note' },
        ],
      },
      error: null,
    });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const summary = await screen.findByText('2 content warnings');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')?.open).toBe(false);
    expect(screen.getByText('about [en] meta.title: Longer than recommended: 70 characters, recommended max 60')).toBeTruthy();
    expect(screen.getByText('faq: Doc-level note')).toBeTruthy();
  });

  it('a refused publish still lists its warnings', async () => {
    h.invoke.mockResolvedValue(httpError({
      status: 'error', run_id: 3, sha: null, files_changed: 0, error: 'CMS validation failed: 1 error in 1 document',
      warnings: [{ doc_id: 'rules', locale: 'el', path: 'meta.description', message: 'Possible hardcoded year/city: use the contest placeholders' }],
    }));
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('1 content warning')).toBeTruthy();
    expect(screen.getByText('rules [el] meta.description: Possible hardcoded year/city: use the contest placeholders')).toBeTruthy();
  });

  it('a failed last run shows its error', async () => {
    h.lastRun = { id: 7, status: 'error', commit_sha: null, finished_at: FINISHED, error: 'vercel.json is missing from the branch' };
    render(<Harness />);
    expect(await screen.findByText(/Last publish: error/)).toBeTruthy();
    expect(screen.getByText('vercel.json is missing from the branch')).toBeTruthy();
  });

  it('a summary error is shown and Publish stays available', async () => {
    h.summaryError = { message: 'forbidden' };
    render(<Harness />);
    expect(await screen.findByText('forbidden')).toBeTruthy();
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('unpublished_summary', undefined));
    expect(((screen.getByRole('button', { name: 'Publish' })) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('invokePublish guard', () => {
  beforeEach(() => {
    h.invoke.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    __resetPublishGuardForTests();
  });

  const ok = (files: number) => ({ data: { status: 'ok', run_id: files, sha: `sha${files}`, files_changed: files }, error: null });

  it('three rapid callers cost exactly 2 invokes; the late callers get the trailing run', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    h.invoke.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    const first = invokePublish();
    const second = invokePublish();
    const third = invokePublish();
    expect(second).toBe(third);
    expect(h.invoke).toHaveBeenCalledTimes(1);
    resolvers[0](ok(1));
    expect(await first).toMatchObject({ status: 'ok', files_changed: 1 });
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    resolvers[1](ok(2));
    expect(await second).toMatchObject({ status: 'ok', files_changed: 2 });
    expect(await third).toMatchObject({ status: 'ok', files_changed: 2 });
    expect(h.invoke).toHaveBeenCalledTimes(2);
    // The slot is free again.
    h.invoke.mockResolvedValue(ok(3));
    expect(await invokePublish()).toMatchObject({ files_changed: 3 });
    expect(h.invoke).toHaveBeenCalledTimes(3);
  });

  it('cms: false (auto-publish) and a manual Publish queued behind a run share one trailing run that ships the drafts (I3)', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    h.invoke.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    const first = invokePublish({ cms: false });
    expect(h.invoke).toHaveBeenLastCalledWith('publish-content', { body: { cms: false } });
    const auto = invokePublish({ cms: false });
    const manual = invokePublish();
    expect(auto).toBe(manual);
    resolvers[0](ok(1));
    await first;
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke).toHaveBeenLastCalledWith('publish-content', { body: { cms: true } });
    resolvers[1](ok(2));
    expect(await auto).toMatchObject({ files_changed: 2 });
  });

  it('a trailing run of auto-publishes only stays contests-only', async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    h.invoke.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
    const first = invokePublish();
    const auto = invokePublish({ cms: false });
    resolvers[0](ok(1));
    await first;
    await vi.waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke).toHaveBeenLastCalledWith('publish-content', { body: { cms: false } });
    resolvers[1](ok(2));
    await auto;
  });

  it('a hung invoke times out after 90 s and frees the slot', async () => {
    vi.useFakeTimers();
    h.invoke.mockImplementation(() => new Promise(() => {}));
    let settled = false;
    const run = invokePublish();
    run.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await run).toEqual({ status: 'error', error: TIMEOUT_TEXT });
    expect(TIMEOUT_TEXT).toBe('Publish timed out — check the last run below and try again');
    h.invoke.mockResolvedValue(ok(1));
    expect(await invokePublish()).toMatchObject({ status: 'ok' });
    expect(h.invoke).toHaveBeenCalledTimes(2);
  });

  it('never rejects, even when invoke throws synchronously', async () => {
    h.invoke.mockImplementation(() => { throw new Error('boom'); });
    await expect(invokePublish()).resolves.toEqual({ status: 'error', error: 'boom' });
  });
});
