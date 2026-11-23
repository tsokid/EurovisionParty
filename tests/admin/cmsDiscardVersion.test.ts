// Final re-review N3: Discard must never delete a draft blindly. The client
// always sends the version it is discarding; with none seen, it sends nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc } }));

import { cmsDiscard } from '../../src/admin/modules/pages/cmsApi';

beforeEach(() => rpc.mockClear());

describe('cmsDiscard (N3)', () => {
  it('sends the version being discarded', async () => {
    await cmsDiscard('about', '2026-11-22T12:00:00Z');
    expect(rpc).toHaveBeenCalledWith('cms_discard', { p_doc_id: 'about', p_expected_updated_at: '2026-11-22T12:00:00Z' });
  });

  it.each([null, undefined])('with no draft seen (%s) it makes no unconditional delete', async (v) => {
    await cmsDiscard('about', v);
    expect(rpc).not.toHaveBeenCalled();
  });
});
