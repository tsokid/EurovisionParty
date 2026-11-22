// The history screen (CMS P3): the timeline (live version, checkpoints,
// publishes, restores, the seed), a revision against the current version
// field by field, and «Επαναφορά» through cms_restore (a new revision; the
// history keeps everything).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
const ROWS = [
  { id: 12, kind: 'restored', author: 'u1', author_email: 'elena@example.com', created_at: '2026-11-22T10:30:00Z', updated_at: '2026-11-22T10:30:00Z', run_id: null, commit_sha: null, restored_from: 3 },
  { id: 9, kind: 'published', author: 'u2', author_email: 'owner@example.com', created_at: '2026-11-21T18:00:00Z', updated_at: '2026-11-21T18:00:00Z', run_id: 41, commit_sha: '3e1f0a9c55', restored_from: null },
  { id: 5, kind: 'checkpoint', author: 'u2', author_email: 'owner@example.com', created_at: '2026-11-21T17:00:00Z', updated_at: '2026-11-21T17:20:00Z', run_id: null, commit_sha: null, restored_from: null },
  { id: 3, kind: 'seed', author: null, author_email: null, created_at: '2026-11-20T09:00:00Z', updated_at: '2026-11-20T09:00:00Z', run_id: null, commit_sha: null, restored_from: null },
];
const CURRENT = { en: { title: 'Rules now', body: 'Same' }, el: { title: 'Κανόνες', body: 'Ίδιο' } };
const OLD = { en: { title: 'Rules then', body: 'Same' }, el: { title: 'Κανόνες', body: 'Ίδιο' } };

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.rpc(name, args);
      if (name === 'cms_history') return Promise.resolve({ data: ROWS, error: null });
      if (name === 'cms_revision') return Promise.resolve({ data: { id: args.p_rev_id, doc_id: 'rules', doc_type: 'rules', kind: 'checkpoint', data: OLD, created_at: '', updated_at: '' }, error: null });
      if (name === 'cms_restore') return Promise.resolve({ data: '2026-11-22T11:00:00.001Z', error: null });
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

import { DocHistory } from '../../src/admin/cms/DocHistory';

function show(selected: string | null, extra: Partial<Parameters<typeof DocHistory>[0]> = {}) {
  const props = {
    docId: 'rules', label: 'Κανόνες',
    loadCurrent: async () => ({ value: CURRENT, updatedAt: '2026-11-22T10:31:00.000Z' }),
    loadLive: async () => OLD,
    saveDraft: vi.fn(async () => 'x'),
    selected, onSelect: vi.fn(), editorPath: '/admin/pages/rules', onRestored: vi.fn(),
    ...extra,
  };
  render(<MemoryRouter><DocHistory {...props} /></MemoryRouter>);
  return props;
}

beforeEach(() => { h.rpc.mockClear(); });

describe('history', () => {
  it('lists the live version, then every revision newest first, with kind, author and commit', async () => {
    const p = show(null);
    const items = await waitFor(() => {
      const li = within(screen.getByTestId('timeline')).getAllByRole('button');
      expect(li).toHaveLength(5);
      return li;
    });
    expect(items[0].textContent).toMatch(/Στο site τώρα/);
    expect(items[1].textContent).toMatch(/Επαναφορά.*από elena.*από την εκδοχή #3/);
    expect(items[2].textContent).toMatch(/Δημοσίευση.*commit 3e1f0a9/);
    expect(items[3].textContent).toMatch(/Επεξεργασία/);
    expect(items[4].textContent).toMatch(/Αρχική εκδοχή/);
    fireEvent.click(items[3]);
    expect(p.onSelect).toHaveBeenCalledWith('5');
  });

  it('a revision shows the fields that differ from now, side by side', async () => {
    show('5');
    const diff = await screen.findByTestId('diff');
    expect(within(diff).getAllByRole('listitem')).toHaveLength(1);
    expect(within(diff).getByText('Rules then')).toBeTruthy();
    expect(within(diff).getByText('Rules now')).toBeTruthy();
    expect(screen.getByText('1 πεδίο διαφέρει')).toBeTruthy();
    expect(h.rpc).toHaveBeenCalledWith('cms_revision', { p_rev_id: 5 });
  });

  it('«Επαναφορά» asks, then restores through cms_restore against the current timestamp', async () => {
    const p = show('5');
    await screen.findByTestId('diff');
    fireEvent.click(screen.getByRole('button', { name: 'Επαναφορά' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Επαναφορά αυτής της εκδοχής;' });
    expect(dialog.textContent).toMatch(/μένει στο ιστορικό/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Επαναφορά' }));
    await waitFor(() => expect(p.onRestored).toHaveBeenCalled());
    expect(h.rpc).toHaveBeenCalledWith('cms_restore', { p_doc_id: 'rules', p_rev_id: 5, p_expected_updated_at: '2026-11-22T10:31:00.000Z' });
  });

  it('restoring the live version saves it as the draft', async () => {
    const p = show('live');
    await screen.findByTestId('diff');
    fireEvent.click(screen.getByRole('button', { name: 'Επαναφορά' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Επαναφορά' }));
    await waitFor(() => expect(p.saveDraft).toHaveBeenCalledWith(OLD, '2026-11-22T10:31:00.000Z'));
  });
});
