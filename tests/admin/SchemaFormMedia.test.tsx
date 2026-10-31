// SchemaForm widgets of CMS 3c: image, video, mediaRef (picker), richText
// (toolbar + live preview) and blocks (add / reorder / remove, aligned across
// locales). Supabase (media_list, Storage) is mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { z } from 'zod';
import { blocks, group, image, richText, video } from '../../supabase/functions/_shared/cms/fields';
import { documentSchema } from '../../supabase/functions/_shared/cms/validate';
import type { ValidationError } from '../../supabase/functions/_shared/cms/validate';
import { SchemaForm, type DocValue } from '../../src/admin/modules/pages/form/SchemaForm';
import { __resetMediaCacheForTests, type MediaRow } from '../../src/admin/modules/pages/media/mediaApi';

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
  signed: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      h.rpc(name, args);
      if (name === 'media_list') return Promise.resolve({ data: h.rows, error: null });
      if (name === 'media_register') return Promise.resolve({ data: args.p_id ?? 'variant', error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) => {
          h.signed(paths);
          return Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}`, error: null })), error: null });
        },
        upload: (path: string) => {
          h.upload(path);
          return Promise.resolve({ data: { path }, error: null });
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
    row(VID, 'video', `${VID}.mp4`, { bytes: 5 * 1024 * 1024 }),
  ];
  h.rpc.mockReset();
  h.signed.mockReset();
  h.upload.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(schema: z.ZodType, initial: DocValue, errors: (v: DocValue) => ValidationError[] = () => []) {
  let current = initial;
  function Host() {
    const [value, setValue] = useState<DocValue>(current);
    return (
      <MemoryRouter>
        <SchemaForm
          schema={schema}
          value={value}
          onChange={(next) => {
            current = next;
            setValue(next);
          }}
          errors={errors(value)}
          warnings={[]}
        />
      </MemoryRouter>
    );
  }
  render(<Host />);
  return { value: () => current as { en: Record<string, unknown>; el: Record<string, unknown> } };
}

describe('image widget', () => {
  const schema = group({ hero: image({ label: 'Hero' }) });
  const doc = (media: string) => ({ en: { hero: { media, alt: 'Stage' } }, el: { hero: { media, alt: 'Σκηνή' } } });

  it('shows the thumbnail through a signed URL (the 800 w copy) and alt text EN/EL side by side', async () => {
    setup(schema, doc(`cms-media/${IMG}`));
    const thumb = await screen.findByRole('img', { name: 'Hero › Image' });
    expect(thumb).toHaveAttribute('src', `https://signed.test/${IMG}-800.webp`);
    expect(screen.getByText('1600×900 · 2 KB')).toBeInTheDocument();
    expect(screen.getByLabelText('Hero › Alt text (EN)')).toHaveValue('Stage');
    expect(screen.getByLabelText('Hero › Alt text (EL)')).toHaveValue('Σκηνή');
    // The file is shared: one control, not one per locale.
    expect(screen.getAllByRole('button', { name: /^Choose image for Hero › Image/ })).toHaveLength(1);
  });

  it('picking a file from the library writes the same reference to both locales', async () => {
    const form = setup(schema, doc(''));
    expect(screen.getByText('No image chosen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose image for Hero › Image (EN + EL)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose image for Hero › Image (EN + EL)' });
    // Images only, no variants; thumbnails are the 800 w copies when they exist.
    const choices = await within(dialog).findAllByRole('button', { name: /^Choose .*\.webp$/ });
    expect(choices.map((b) => b.getAttribute('aria-label'))).toEqual([`Choose ${IMG}.webp`, `Choose ${IMG2}.webp`]);
    // Decorative thumbnail (alt=""): the button names the file.
    expect(choices[0].querySelector('img')).toHaveAttribute('src', `https://signed.test/${IMG}-800.webp`);
    fireEvent.click(choices[1]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(form.value().en.hero).toEqual({ media: `cms-media/${IMG2}`, alt: 'Stage' });
    expect(form.value().el.hero).toEqual({ media: `cms-media/${IMG2}`, alt: 'Σκηνή' });
  });

  it('clear empties the reference in both locales', async () => {
    const form = setup(schema, doc(`cms-media/${IMG}`));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Hero › Image (EN + EL)' }));
    expect((form.value().en.hero as { media: string }).media).toBe('');
    expect((form.value().el.hero as { media: string }).media).toBe('');
  });

  it('does not draw the width and height publish writes in (derived): a published doc edits like a draft', async () => {
    const published = { media: '/media/0123456789ab.webp', alt: 'Stage', width: 1600, height: 900 };
    const form = setup(schema, { en: { hero: published }, el: { hero: { ...published, alt: 'Σκηνή' } } });
    expect(screen.getByLabelText('Hero › Alt text (EN)')).toHaveValue('Stage');
    expect(screen.queryByText('Width')).toBeNull();
    expect(screen.queryByText('Height')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Hero › (Width|Height)/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Hero › Alt text (EN)'), { target: { value: 'Arena' } });
    expect(form.value().en.hero).toEqual({ ...published, alt: 'Arena' });
  });

  it('a reference missing from the library says so', async () => {
    setup(schema, doc('cms-media/ffffffff-5a4d-4c2e-9f10-1234567890ab'));
    expect(await screen.findByText(/not in the media library/)).toBeInTheDocument();
  });
});

describe('media picker', () => {
  it('uploads a new file and picks it', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(NEW);
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    const schema = group({ clip: video({ label: 'Clip' }) });
    const form = setup(schema, { en: { clip: { media: '', poster: '', autoplay: false } }, el: { clip: { media: '', poster: '', autoplay: false } } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose video for Clip › Video (EN + EL)' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('button', { name: `Choose ${VID}.mp4` })).toBeInTheDocument();
    const file = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText('Upload new video'), { target: { files: [file] } });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(h.upload).toHaveBeenCalledWith(`${NEW}.mp4`);
    expect(h.rpc).toHaveBeenCalledWith('media_register', expect.objectContaining({ p_id: NEW, p_kind: 'video' }));
    expect((form.value().en.clip as { media: string }).media).toBe(`cms-media/${NEW}`);
    expect((form.value().el.clip as { media: string }).media).toBe(`cms-media/${NEW}`);
  });

  it('shows an upload error and stays open', async () => {
    const schema = group({ clip: video({ label: 'Clip' }) });
    setup(schema, { en: { clip: { media: '', poster: '', autoplay: false } }, el: { clip: { media: '', poster: '', autoplay: false } } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose video for Clip › Video (EN + EL)' }));
    const dialog = await screen.findByRole('dialog');
    const file = new File([new Uint8Array(10)], 'clip.webm', { type: 'video/webm' });
    await act(async () => {
      fireEvent.change(within(dialog).getByLabelText('Upload new video'), { target: { files: [file] } });
    });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not upload clip.webm: only MP4 (H.264) video is accepted');
    expect(h.upload).not.toHaveBeenCalled();
  });

  it('Escape closes it without changing anything', async () => {
    const schema = group({ hero: image({ label: 'Hero' }) });
    const form = setup(schema, { en: { hero: { media: '', alt: '' } }, el: { hero: { media: '', alt: '' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose image for Hero › Image (EN + EL)' }));
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(form.value().en.hero).toEqual({ media: '', alt: '' });
  });
});

describe('video widget', () => {
  const schema = group({ clip: video({ label: 'Clip' }) });
  const clip = (poster: string) => ({ media: `cms-media/${VID}`, poster, autoplay: false });

  it('shows the file name, the poster thumbnail and an autoplay switch for both locales', async () => {
    const form = setup(schema, { en: { clip: clip(`cms-media/${IMG}`) }, el: { clip: clip(`cms-media/${IMG}`) } });
    expect(await screen.findByText(`${VID}.mp4`)).toBeInTheDocument();
    expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Clip › Poster image' })).toHaveAttribute('src', `https://signed.test/${IMG}-800.webp`);
    expect(screen.queryByText(/poster image is required/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Clip › Autoplay (EN + EL)'));
    expect((form.value().en.clip as { autoplay: boolean }).autoplay).toBe(true);
    expect((form.value().el.clip as { autoplay: boolean }).autoplay).toBe(true);
    // Captions are optional.
    expect(screen.getByRole('button', { name: 'Add Clip › Captions' })).toBeInTheDocument();
  });

  it('a video without a poster asks for one', async () => {
    setup(schema, { en: { clip: clip('') }, el: { clip: clip('') } });
    expect(await screen.findByText('A poster image is required: it shows until the video plays.')).toBeInTheDocument();
  });
});

describe('richText widget', () => {
  const schema = group({ story: richText({ label: 'Story' }) });
  /** Errors as validateDocument reports them (zod issues of the document schema). */
  const validate = (v: DocValue): ValidationError[] => {
    const r = documentSchema(schema).safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => ({ locale: i.path[0] as 'en' | 'el', path: i.path.slice(1).join('.'), message: i.message }));
  };

  it('toolbar buttons insert Markdown around the selection of that locale only', () => {
    const form = setup(schema, { en: { story: 'Hello world' }, el: { story: 'Γεια' } });
    const en = screen.getByLabelText('Story (EN)') as HTMLTextAreaElement;
    en.setSelectionRange(6, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Bold (Story (EN))' }));
    expect(form.value().en.story).toBe('Hello **world**');
    expect(form.value().el.story).toBe('Γεια');
    for (const name of ['Italic', 'Link', 'List', 'Heading']) {
      expect(screen.getByRole('button', { name: `${name} (Story (EL))` })).toBeInTheDocument();
    }
  });

  it('renders a live preview through RichText', () => {
    setup(schema, { en: { story: '### Title\n\nSome **bold** and a [link](/faq)\n\n- one\n- two' }, el: { story: '' } });
    const preview = screen.getByTestId('richtext-preview-en');
    expect(within(preview).getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(within(preview).getByText('bold').tagName).toBe('STRONG');
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2);
    expect(within(preview).getByRole('link', { name: 'link' })).toBeInTheDocument();
    expect(screen.queryByTestId('richtext-preview-el')).toBeNull();
  });

  it('shows validator errors with their line numbers', () => {
    setup(schema, { en: { story: 'Fine\n## Too big' }, el: { story: 'Ok' } }, validate);
    expect(screen.getByText('Line 2: Only ### headings are supported')).toBeInTheDocument();
    expect(screen.getByLabelText('Story (EN)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Story (EL)')).not.toHaveAttribute('aria-invalid');
  });
});

describe('blocks widget', () => {
  const schema = group({ zone: blocks({ label: 'Zone' }) });
  const empty = () => ({ en: { zone: [] as unknown[] }, el: { zone: [] as unknown[] } });

  const addBlock = (type: string) => {
    fireEvent.change(screen.getByLabelText('Block type for Zone'), { target: { value: type } });
    fireEvent.click(screen.getByRole('button', { name: 'Add block to Zone' }));
  };

  it('adds a block of the chosen type at the same index in both locales', () => {
    const form = setup(schema, empty());
    addBlock('text');
    addBlock('cta');
    expect(form.value().en.zone).toEqual([{ type: 'text', body: '' }, { type: 'cta', title: '', body: '', label: '', href: '' }]);
    expect(form.value().el.zone).toEqual(form.value().en.zone);
    expect(form.value().el.zone).not.toBe(form.value().en.zone);
  });

  it('draws each block from its own type: the same key is a different field per type', () => {
    setup(schema, {
      en: { zone: [{ type: 'text', body: 'Rich' }, { type: 'cta', title: 'T', body: 'Plain', label: 'Go', href: '/faq' }] },
      el: { zone: [{ type: 'text', body: 'Πλούσιο' }, { type: 'cta', title: 'Τ', body: 'Απλό', label: 'Πάμε', href: '/faq' }] },
    });
    expect(screen.getByRole('group', { name: 'Block 1: Text' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Block 2: Call to action' })).toBeInTheDocument();
    // text.body is richText (toolbar), cta.body is multiline (none).
    expect(screen.getByRole('button', { name: 'Bold (Zone › Block 1 › Text (EN))' })).toBeInTheDocument();
    expect(screen.getByLabelText('Zone › Block 2 › Text (EN)')).toHaveValue('Plain');
    expect(screen.queryByRole('button', { name: 'Bold (Zone › Block 2 › Text (EN))' })).toBeNull();
    // The shared type is not an editable field.
    expect(screen.queryByLabelText(/› Type/)).toBeNull();
    expect(screen.getByLabelText('Zone › Block 2 › Button link (EN + EL)')).toHaveValue('/faq');
  });

  it('reorder and remove keep the locales aligned', () => {
    const form = setup(schema, {
      en: { zone: [{ type: 'text', body: 'A' }, { type: 'callout', tone: 'info', body: 'B' }, { type: 'text', body: 'C' }] },
      el: { zone: [{ type: 'text', body: 'Α' }, { type: 'callout', tone: 'info', body: 'Β' }, { type: 'text', body: 'Γ' }] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move Zone › Block 1 down' }));
    expect(form.value().en.zone).toEqual([{ type: 'callout', tone: 'info', body: 'B' }, { type: 'text', body: 'A' }, { type: 'text', body: 'C' }]);
    expect((form.value().el.zone as { body: string }[]).map((b) => b.body)).toEqual(['Β', 'Α', 'Γ']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Zone › Block 3 up' }));
    expect((form.value().el.zone as { body: string }[]).map((b) => b.body)).toEqual(['Β', 'Γ', 'Α']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Zone › Block 1' }));
    expect((form.value().en.zone as { body: string }[]).map((b) => b.body)).toEqual(['C', 'A']);
    expect((form.value().el.zone as { body: string }[]).map((b) => b.body)).toEqual(['Γ', 'Α']);
    expect(screen.getByRole('button', { name: 'Move Zone › Block 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Zone › Block 2 down' })).toBeDisabled();
  });

  it('a shared field inside a block writes both locales', () => {
    const form = setup(schema, {
      en: { zone: [{ type: 'callout', tone: 'info', body: 'B' }] },
      el: { zone: [{ type: 'callout', tone: 'info', body: 'Β' }] },
    });
    fireEvent.change(screen.getByLabelText('Zone › Block 1 › Tone (EN + EL)'), { target: { value: 'warn' } });
    expect((form.value().en.zone as { tone: string }[])[0].tone).toBe('warn');
    expect((form.value().el.zone as { tone: string }[])[0].tone).toBe('warn');
  });

  it('an image block edits its media once and its alt text per locale', async () => {
    setup(schema, {
      en: { zone: [{ type: 'image', image: { media: `cms-media/${IMG}`, alt: 'Stage' } }] },
      el: { zone: [{ type: 'image', image: { media: `cms-media/${IMG}`, alt: 'Σκηνή' } }] },
    });
    expect(await screen.findByRole('img', { name: 'Zone › Block 1 › Image › Image' })).toHaveAttribute('src', `https://signed.test/${IMG}-800.webp`);
    expect(screen.getByLabelText('Zone › Block 1 › Image › Alt text (EL)')).toHaveValue('Σκηνή');
  });

  it('blocks whose types differ between locales are flagged, not merged', () => {
    setup(schema, {
      en: { zone: [{ type: 'text', body: 'A' }] },
      el: { zone: [{ type: 'cta', title: '', body: '', label: '', href: '' }] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('EN is a Text block, EL a Call to action block: remove this block and add it again');
  });
});
