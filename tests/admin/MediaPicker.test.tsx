// The media library dialog on its own: delete (media_delete + Storage
// removal, with an in-dialog confirm), closing while an upload runs, and
// keyboard focus (trap, Escape, restore). Supabase is mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MediaPicker } from '../../src/admin/modules/pages/media/MediaPicker';
import {
  __resetMediaCacheForTests, libraryRows, mediaDelete, type MediaRow,
} from '../../src/admin/modules/pages/media/mediaApi';

const IMG = '0b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const IMG2 = '1b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const VID = '2b7c1f3e-5a4d-4c2e-9f10-1234567890ab';
const NEW = '9b7c1f3e-5a4d-4c2e-9f10-1234567890ab';

const row = (id: string, kind: MediaRow['kind'], path: string, extra: Partial<MediaRow> = {}): MediaRow => ({
  id, kind, storage_path: path, variant_of: null, mime: kind === 'image' ? 'image/webp' : 'video/mp4', bytes: 2048,
  width: kind === 'image' ? 1600 : null, height: kind === 'image' ? 900 : null, sha256: 'a'.repeat(64),
  published_path: null, created_at: '2026-10-31T10:00:00Z', ...extra,
});

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  rpc: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  deleteError: null as { message: string } | null,
  removeError: null as { message: string } | null,
  /** When set, Storage uploads wait for this promise. */
  uploadGate: null as Promise<void> | null,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.rpc(name, args);
      if (name === 'media_list') return Promise.resolve({ data: h.rows, error: null });
      if (name === 'media_register') return Promise.resolve({ data: args.p_id ?? 'variant', error: null });
      if (name === 'media_delete') {
        if (h.deleteError) return Promise.resolve({ data: null, error: h.deleteError });
        const id = args.p_id as string;
        const gone = (h.rows as MediaRow[]).filter((r) => r.id === id || r.variant_of === id);
        h.rows = (h.rows as MediaRow[]).filter((r) => !gone.includes(r));
        return Promise.resolve({ data: gone.map((r) => r.storage_path).sort(), error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: (paths: string[]) =>
          Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}`, error: null })), error: null }),
        upload: async (path: string) => {
          h.upload(path);
          if (h.uploadGate) await h.uploadGate;
          return { data: { path }, error: null };
        },
        remove: (paths: string[]) => {
          h.remove(bucket, paths);
          return Promise.resolve({ data: [], error: h.removeError });
        },
      }),
    },
  },
}));

beforeEach(() => {
  __resetMediaCacheForTests();
  h.rows = [
    row(IMG, 'image', `${IMG}.webp`),
    row('v1', 'image', `${IMG}-800.webp`, { variant_of: IMG, width: 800, height: 450 }),
    row(IMG2, 'image', `${IMG2}.webp`),
    row(VID, 'video', `${VID}.mp4`),
  ];
  h.rpc.mockReset();
  h.remove.mockReset();
  h.upload.mockReset();
  h.deleteError = null;
  h.removeError = null;
  h.uploadGate = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mediaDelete', () => {
  it('calls media_delete, then removes the returned paths from the cms-media bucket', async () => {
    await mediaDelete(IMG);
    expect(h.rpc).toHaveBeenCalledWith('media_delete', { p_id: IMG });
    expect(h.remove).toHaveBeenCalledWith('cms-media', [`${IMG}-800.webp`, `${IMG}.webp`]);
    // The library cache is dropped: the next read refetches without the row.
    expect((await libraryRows()).map((r) => r.id)).toEqual([IMG2, VID]);
  });

  it('throws the RPC error (in use) and touches no Storage object', async () => {
    h.deleteError = { message: 'media in use by about, home' };
    await expect(mediaDelete(IMG)).rejects.toMatchObject({ message: 'media in use by about, home' });
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('a Storage failure after the row is gone says the files are left for the sweep', async () => {
    h.removeError = { message: 'storage down' };
    await expect(mediaDelete(IMG)).rejects.toThrow(/deleted from the library.*storage down/);
  });
});

function renderPicker(kind: MediaRow['kind'] = 'image') {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const utils = render(<MediaPicker kind={kind} fieldName="Hero › Image" onPick={onPick} onClose={onClose} />);
  return { onPick, onClose, ...utils };
}

describe('MediaPicker delete', () => {
  it('asks for confirmation inside the dialog, deletes, and refreshes the list', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onPick } = renderPicker();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: `Choose ${IMG}.webp` });
    fireEvent.click(within(dialog).getByRole('button', { name: `Delete ${IMG}.webp` }));
    // Nothing deleted yet: a confirm step in the row.
    expect(h.rpc).not.toHaveBeenCalledWith('media_delete', expect.anything());
    expect(within(dialog).getByText(/Delete this file\? This cannot be undone/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: `Confirm delete ${IMG}.webp` }));
    });
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: `Choose ${IMG}.webp` })).toBeNull());
    expect(within(dialog).getByRole('button', { name: `Choose ${IMG2}.webp` })).toBeInTheDocument();
    expect(h.remove).toHaveBeenCalledWith('cms-media', [`${IMG}-800.webp`, `${IMG}.webp`]);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('cancel leaves the file alone', async () => {
    renderPicker();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: `Delete ${IMG}.webp` }));
    fireEvent.click(within(dialog).getByRole('button', { name: `Cancel delete ${IMG}.webp` }));
    expect(within(dialog).queryByText(/Delete this file\?/)).toBeNull();
    expect(h.rpc).not.toHaveBeenCalledWith('media_delete', expect.anything());
  });

  it('shows "in use by …" clearly and keeps the file in the list', async () => {
    h.deleteError = { message: 'media in use by about, home' };
    renderPicker();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: `Delete ${IMG}.webp` }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: `Confirm delete ${IMG}.webp` }));
    });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      `Could not delete ${IMG}.webp: media in use by about, home`,
    );
    expect(within(dialog).getByRole('button', { name: `Choose ${IMG}.webp` })).toBeInTheDocument();
    expect(h.remove).not.toHaveBeenCalled();
  });
});

describe('MediaPicker while uploading', () => {
  const startUpload = async (dialog: HTMLElement) => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(NEW);
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    let release!: () => void;
    h.uploadGate = new Promise<void>((r) => { release = r; });
    const file = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText('Upload new video'), { target: { files: [file] } });
    });
    await waitFor(() => expect(h.upload).toHaveBeenCalled());
    return release;
  };

  it('closing (unmounting) mid-upload never calls onPick afterwards', async () => {
    const { onPick, unmount } = renderPicker('video');
    const dialog = await screen.findByRole('dialog');
    const release = await startUpload(dialog);
    unmount();
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(h.rpc).toHaveBeenCalledWith('media_register', expect.objectContaining({ p_id: NEW }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Escape, the backdrop and the Close button do not close it during an upload', async () => {
    const { onClose, onPick } = renderPicker('video');
    const dialog = await screen.findByRole('dialog');
    const release = await startUpload(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      release();
    });
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(`cms-media/${NEW}`));
  });
});

describe('MediaPicker focus', () => {
  it('focuses the dialog, traps Tab inside it, and Escape closes it', async () => {
    const { onClose } = renderPicker();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: `Choose ${IMG}.webp` });
    expect(document.activeElement).toBe(dialog);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const buttons = within(dialog).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    // Shift+Tab from the first control wraps to the last, Tab from the last wraps to the first.
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the element that opened it when it closes', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Choose…';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = renderPicker();
    const dialog = await screen.findByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
