// avatarsApi (089): purge and the cleanup after a failed insert must really
// remove the bucket files. Storage's remove() answers without an error when
// RLS hides the rows, so the names it returns are checked (final review I4).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: unknown) => h.rpc(name, args),
    from: () => ({ insert: (row: unknown) => h.insert(row) }),
    storage: { from: () => ({ remove: (names: string[]) => h.remove(names), upload: (...a: unknown[]) => h.upload(...a) }) },
  },
}));

import { addAvatar, purgeAvatar } from '../../src/admin/modules/avatars/avatarsApi';

const NAMES = ['my-avatar-96.webp', 'my-avatar-512.webp'];

describe('avatarsApi Storage removal (final review I4)', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.remove.mockReset();
    h.upload.mockReset();
    h.insert.mockReset();
  });

  it('purge succeeds only when Storage removed every object', async () => {
    h.rpc.mockResolvedValue({ data: NAMES, error: null });
    h.remove.mockResolvedValue({ data: NAMES.map((name) => ({ name })), error: null });
    await expect(purgeAvatar('my-avatar')).resolves.toBeUndefined();
    expect(h.remove).toHaveBeenCalledWith(NAMES);
  });

  it('purge fails, naming the files, when remove() matched nothing (RLS) and reported no error', async () => {
    h.rpc.mockResolvedValue({ data: NAMES, error: null });
    h.remove.mockResolvedValue({ data: [], error: null });
    await expect(purgeAvatar('my-avatar')).rejects.toThrow(/my-avatar-96\.webp, my-avatar-512\.webp/);

    h.remove.mockResolvedValue({ data: [{ name: NAMES[0] }], error: null });
    await expect(purgeAvatar('my-avatar')).rejects.toThrow(/my-avatar-512\.webp/);
  });

  it('a seeded avatar with static files only removes nothing from Storage', async () => {
    h.rpc.mockResolvedValue({ data: [], error: null });
    await expect(purgeAvatar('img-01')).resolves.toBeUndefined();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('a failed insert removes both uploads and still shows the insert error', async () => {
    h.upload.mockResolvedValue({ error: null });
    h.insert.mockResolvedValue({ error: { message: 'duplicate key' } });
    h.remove.mockResolvedValue({ data: [], error: null });
    const blob = new Blob(['x'], { type: 'image/webp' });
    await expect(addAvatar({ id: 'my-avatar', title_en: 'Mine', title_el: '', status: 'unpublished', sort: 10, thumb: blob, full: blob }))
      .rejects.toMatchObject({ message: 'duplicate key' });
    expect(h.remove).toHaveBeenCalledWith(NAMES);
  });
});
