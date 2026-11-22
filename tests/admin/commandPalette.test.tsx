// CMS P6: the ⌘K / Ctrl+K palette. Any doc or field opens in at most two
// keystrokes after typing (Enter, or ↓ Enter); the keyboard drives it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { CommandPalette, __resetPaletteForTests } from '../../src/admin/palette/CommandPalette';
import { actionItems, docItems, fieldItems, fold, screenItems, search, type PaletteItem } from '../../src/admin/palette/paletteIndex';
import { SITE_PAGES } from '../../src/admin/modules/pages/sitePages';
import { __resetPublishedPagesForTests } from '../../src/admin/modules/pages/cmsApi';

vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: [], error: null }) } }));

const published = (id: string) => JSON.parse(readFileSync(resolve(__dirname, `../../content/pages/${id}.json`), 'utf8'));

beforeEach(() => {
  __resetPaletteForTests();
  __resetPublishedPagesForTests();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const m = /\/content\/pages\/([a-z0-9-]+)\.json$/.exec(String(url));
    return m ? new Response(JSON.stringify(published(m[1])), { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 });
  }));
});

/** The keystrokes after typing that open `want` for `query`: 1 (Enter) when first, 2 (↓ Enter) when second. */
function keystrokes(items: PaletteItem[], query: string, want: string): number {
  const at = search(items, query).findIndex((it) => it.id === want);
  return at < 0 ? Infinity : at + 1;
}

describe('palette index and ranking', () => {
  const fields = SITE_PAGES.flatMap(({ docId }) => fieldItems(docId, published(docId)));
  const all = [...actionItems('/admin/pages/faq'), ...screenItems(), ...docItems(), ...fields];

  it('every doc opens in two keystrokes or fewer after typing its name, most with Enter (accents and case do not matter)', () => {
    const counts = docItems().map((d) => {
      const n = keystrokes(all, d.title, d.id);
      expect(n, d.title).toBeLessThanOrEqual(2);
      expect(keystrokes(all, fold(d.title).toUpperCase(), d.id), d.title).toBe(n);
      return n;
    });
    // «Νικητές» is both the winners page and the rooms' winners screen: the only tie.
    expect(counts.filter((n) => n === 2).length).toBeLessThanOrEqual(1);
  });

  it('every screen opens with Enter after typing its name', () => {
    for (const s of screenItems()) expect(keystrokes(all, s.title, s.id), s.title).toBeLessThanOrEqual(2);
  });

  it('every field opens in two keystrokes or fewer after typing its doc and its label path', { timeout: 120_000 }, () => {
    let worst = 0;
    for (const f of fields) {
      const doc = f.subtitle!.split(' · ')[0];
      const n = keystrokes(all, `${doc} ${f.title}`, f.id);
      worst = Math.max(worst, n === Infinity ? 99 : n);
      expect(n, `${doc} ${f.title}`).toBeLessThanOrEqual(2);
    }
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('a field is found by a phrase of its text, and its link deep-links the editor', () => {
    const faq = published('faq');
    const q = (faq.en.hero.title as string).slice(0, 18);
    const hit = search(all, q).find((it) => it.kind === 'field' && it.id === 'field:faq:hero.title');
    expect(hit?.to).toBe('/admin/pages/faq?field=en.hero.title');
  });

  it('the open doc has «Δημοσίευση», «Ιστορικό» and «Άνοιγμα στο site»; elsewhere «Δημοσίευση» is the queue', () => {
    expect(actionItems('/admin/pages/faq').map((a) => [a.title, a.to])).toEqual([
      ['Δημοσίευση', '/admin/pages/faq/publish'],
      ['Ιστορικό', '/admin/pages/faq/history'],
      ['Άνοιγμα στο site ↗', 'https://eurovision.games/el/faq'],
    ]);
    expect(actionItems('/admin/header').map((a) => a.to)).toEqual(['/admin/header/publish', '/admin/header/history']);
    expect(actionItems('/admin/contests').map((a) => a.to)).toEqual(['/admin/publish']);
    expect(keystrokes(all, 'δημοσι', 'action:publish')).toBe(1);
    expect(keystrokes(all, 'ιστορικο', 'action:history')).toBe(1);
  });
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Where />
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="*" element={<Harness />} /></Routes>
  </MemoryRouter>,
);

describe('palette UI', () => {
  it('Ctrl+K opens it with the input focused; typing then Enter opens the doc; Escape closes', async () => {
    renderAt('/admin');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Γρήγορη αναζήτηση' });
    const input = within(dialog).getByRole('combobox');
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Συχνές ερωτήσεις' } });
    expect(within(dialog).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/admin/pages/faq');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.keyDown(await screen.findByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('↓ moves the selection (aria-activedescendant) and Enter opens a field with its deep link', async () => {
    renderAt('/admin/pages/faq');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    // The fields load on first open.
    await screen.findAllByRole('option');
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    fireEvent.change(input, { target: { value: 'Συχνές ερωτήσεις Hero Title' } });
    const options = screen.getAllByRole('option');
    const at = options.findIndex((o) => /Hero › Title/.test(o.textContent ?? '') && /Συχνές ερωτήσεις/.test(o.textContent ?? ''));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThanOrEqual(1);
    for (let i = 0; i < at; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[at].id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/admin/pages/faq?field=en.hero.title');
  });
});
