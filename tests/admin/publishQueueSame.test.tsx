// /admin/publish lists only drafts that differ from the site (23 Nov 2026):
// the footer's edits were undone, the server still counted the draft as
// unpublished, and the queue kept showing «Υποσέλιδο» with nothing to publish.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastHost } from '../../src/admin/ui/kit';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async (name: string) => (name === 'unpublished_summary'
      ? { data: { changed_docs: ['about', 'site-footer'], changed_years: [] }, error: null }
      : { data: null, error: { message: `unexpected ${name}` } }),
  },
}));

vi.mock('../../src/admin/modules/pages/cmsApi', async (orig) => ({
  ...(await orig<typeof import('../../src/admin/modules/pages/cmsApi')>()),
  cmsList: async () => [
    { doc_id: 'about', updated_at: '2026-11-23T09:00:00.000Z', published: false },
    { doc_id: 'site-footer', updated_at: '2026-11-23T08:58:58.000Z', published: false },
  ],
}));

vi.mock('../../src/admin/publish/api', async (orig) => {
  const real = await orig<typeof import('../../src/admin/publish/api')>();
  const { bundledContent } = await import('../../src/lib/seo/contentData');
  return {
    ...real,
    listRuns: vi.fn(async () => []),
    loadDocPair: vi.fn(async (docId: string) => {
      const live = JSON.parse(JSON.stringify(bundledContent(`pages/${docId}.json`)));
      const draft = JSON.parse(JSON.stringify(live));
      if (docId === 'about') draft.en.hero.title = 'A real change';
      return { docId, label: real.docTitle(docId), live, draft, updatedAt: '2026-11-23T09:00:00.000Z' };
    }),
  };
});

import { PublishQueueScreen } from '../../src/admin/publish/PublishScreens';

describe('publish queue', () => {
  it('hides a draft identical to the site and keeps a real change', async () => {
    render(<MemoryRouter><ToastHost><PublishQueueScreen /></ToastHost></MemoryRouter>);
    const queue = await screen.findByTestId('publish-queue');
    expect(within(queue).getByRole('checkbox', { name: /About|Σχετικά/ })).toBeTruthy();
    expect(within(queue).queryByText('Υποσέλιδο')).toBeNull();
    expect(queue.textContent).not.toMatch(/Σε όλο το site/i);
  });
});
