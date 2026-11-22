// The live avatars library (migration 089): the picker reads the published
// avatars from the table, falls back to the static registry when the table
// is unreachable (and on the server), and unknown or deleted ids draw the
// fallback (initials on a tint), as before.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  __resetAvatarLibraryForTests, __setAvatarClientForTests, loadAvatarLibrary, resolveAvatar, rowToEntry, avatarFileUrl,
  usePickerAvatars, type AvatarRow,
} from '../../../src/components/stage/avatars/library';
import { AVATARS } from '../../../src/components/stage/avatars/registry';
import { Avatar } from '../../../src/components/stage/Avatar';
import AvatarPicker from '../../../src/components/onboarding/AvatarPicker';

type Reply = { data: unknown; error: unknown };

/** A fake client: `from('avatars')` answers `rows`, `rpc('avatar_entries')` answers `entries`. */
function fakeClient(opts: { rows?: AvatarRow[] | null; entries?: AvatarRow[]; fail?: boolean }) {
  const calls = { from: 0, rpc: [] as unknown[] };
  const reply = (r: Reply) => {
    const q: Record<string, unknown> = new Proxy({}, {
      get: (_t, prop) => (prop === 'then' ? (res: (v: Reply) => void) => res(r) : () => q),
    });
    return q;
  };
  const client = {
    from: () => {
      calls.from += 1;
      if (opts.fail) throw new Error('network down');
      return reply(opts.rows === null ? { data: null, error: { message: 'boom' } } : { data: opts.rows ?? [], error: null });
    },
    rpc: (_name: string, args: { p_ids: string[] }) => {
      calls.rpc.push(args.p_ids);
      const ids = new Set(args.p_ids);
      return Promise.resolve({ data: (opts.entries ?? []).filter((r) => ids.has(r.id)), error: null });
    },
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/avatars/${p}` } }) }) },
  };
  return { client, calls };
}

const row = (id: string, title = id): AvatarRow => ({ id, title_en: title, title_el: '', thumb_path: `${id}-96.webp`, full_path: `${id}-512.webp` });

function PickerIds() {
  const list = usePickerAvatars();
  return <p data-testid="ids">{list.map((a) => a.id).join(',')}</p>;
}

const OFFLINE = { from: () => { throw new Error('offline'); }, rpc: () => Promise.reject(new Error('offline')), storage: { from: () => ({}) } };

beforeEach(() => {
  __resetAvatarLibraryForTests();
});
afterAll(() => {
  __setAvatarClientForTests(OFFLINE);
  __resetAvatarLibraryForTests();
});

describe('avatar picker source', () => {
  it('offers the published avatars in table order once they load', async () => {
    const { client } = fakeClient({ rows: [row('up-b', 'B'), row('img-02'), row('up-a', 'A')] });
    __setAvatarClientForTests(client);
    render(<PickerIds />);
    // The static set first (no flash of nothing), then the table.
    expect(screen.getByTestId('ids').textContent).toBe(AVATARS.map((a) => a.id).join(','));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('up-b,img-02,up-a'));
  });

  it('falls back to the static registry when the table is unreachable', async () => {
    const { client, calls } = fakeClient({ fail: true });
    __setAvatarClientForTests(client);
    render(<PickerIds />);
    await act(async () => { await loadAvatarLibrary(); });
    expect(calls.from).toBeGreaterThan(0);
    expect(screen.getByTestId('ids').textContent).toBe(AVATARS.map((a) => a.id).join(','));
  });

  it('falls back to the static registry on a query error or an empty table', async () => {
    for (const rows of [null, []]) {
      __resetAvatarLibraryForTests();
      __setAvatarClientForTests(fakeClient({ rows }).client);
      await loadAvatarLibrary();
      const { unmount } = render(<PickerIds />);
      expect(screen.getByTestId('ids').textContent).toBe(AVATARS.map((a) => a.id).join(','));
      unmount();
    }
  });

  it('renders the static registry on the server, without asking the table', () => {
    const { client, calls } = fakeClient({ rows: [row('up-x')] });
    __setAvatarClientForTests(client);
    const html = renderToString(<PickerIds />);
    expect(html).toContain(AVATARS[0].id);
    expect(calls.from).toBe(0);
  });

  it('caches the list: a second load within the cache time does not query again', async () => {
    const { client, calls } = fakeClient({ rows: [row('up-a')] });
    __setAvatarClientForTests(client);
    await loadAvatarLibrary();
    await loadAvatarLibrary();
    expect(calls.from).toBe(1);
  });

  it('the picker grid shows the live list and the chosen avatar', async () => {
    __setAvatarClientForTests(fakeClient({ rows: [row('up-a', 'Alpha'), row('up-b', 'Beta')] }).client);
    render(<AvatarPicker value="up-b" onChange={() => {}} />);
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2));
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('rendering an avatar id', () => {
  it('an unknown id draws the initials fallback', () => {
    render(<Avatar name="Πούλια Λάμψη" avatarId="no-such-avatar" decorative={false} />);
    const el = screen.getByRole('img', { name: 'Πούλια Λάμψη' });
    expect(el.textContent).toBe('ΠΛ');
    expect(el.querySelector('[data-avatar-art]')).toBeNull();
  });

  it('an uploaded avatar a player chose renders from avatar_entries, even unpublished', async () => {
    const { client, calls } = fakeClient({ rows: [row('up-a')], entries: [row('up-old', 'Old')] });
    __setAvatarClientForTests(client);
    render(<Avatar name="Πούλια" avatarId="up-old" decorative={false} />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Πούλια' }).querySelector('img')).not.toBeNull());
    expect(screen.getByRole('img', { name: 'Πούλια' }).querySelector('img')!.getAttribute('src')).toBe('https://cdn.test/avatars/up-old-96.webp');
    expect(calls.rpc).toEqual([['up-old']]);
  });

  it('a deleted shipped avatar falls back once the library knows it is gone', async () => {
    // img-01 ships in the static registry; the table no longer has it (deleted).
    __setAvatarClientForTests(fakeClient({ rows: [row('img-02')], entries: [] }).client);
    render(<Avatar name="Ντίσκο" avatarId="img-01" decorative={false} />);
    const el = () => screen.getByRole('img', { name: 'Ντίσκο' });
    await waitFor(() => expect(el().textContent).toBe('ΝΤ'));
  });

  it('a shipped avatar still renders when the table is unreachable', async () => {
    __setAvatarClientForTests(fakeClient({ fail: true }).client);
    render(<Avatar name="Ντίσκο" avatarId="img-01" decorative={false} />);
    await act(async () => { await loadAvatarLibrary(); });
    expect(screen.getByRole('img', { name: 'Ντίσκο' }).querySelector('[data-avatar-art="img-01"]')).not.toBeNull();
  });

  it('code-built SVG avatars (old rows) keep their art and are never looked up', async () => {
    const { client, calls } = fakeClient({ rows: [row('img-02')] });
    __setAvatarClientForTests(client);
    await loadAvatarLibrary();
    expect(resolveAvatar('av-05')?.id).toBe('av-05');
    render(<Avatar name="X" avatarId="av-05" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls.rpc).toEqual([]);
  });

  it('row paths: static paths stay, bucket objects become public Storage URLs; Greek title falls back to English', () => {
    expect(avatarFileUrl('/avatars/img-01-96.webp?v=1')).toBe('/avatars/img-01-96.webp?v=1');
    const e = rowToEntry(row('up-a', 'Alpha'), fakeClient({}).client as never);
    expect(e).toMatchObject({ kind: 'image', id: 'up-a', title: { en: 'Alpha', el: 'Alpha' }, full: 'https://cdn.test/avatars/up-a-512.webp' });
  });
});
