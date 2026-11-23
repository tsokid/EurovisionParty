// The header and footer editors (Track 3 P2): EN/EL side by side, add a link
// by picking a page, hide, delete with undo, reorder, inline validation, Save
// keeps a draft, Publish opens the site-wide publish screen (P5: preview first).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastHost } from '../../src/admin/ui/kit';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

const api = vi.hoisted(() => ({
  cmsGet: vi.fn(async () => null),
  cmsList: vi.fn(async () => []),
  cmsSave: vi.fn(async () => '2026-11-22T12:00:00Z'),
  cmsDiscard: vi.fn(async () => {}),
  publish: vi.fn(async () => ({ status: 'ok', files_changed: 1 })),
}));
vi.mock('../../src/admin/modules/pages/cmsApi', () => ({
  cmsGet: api.cmsGet, cmsList: api.cmsList, cmsSave: api.cmsSave, cmsDiscard: api.cmsDiscard, isConflict: () => false,
}));
vi.mock('../../src/admin/modules/contests/publish', () => ({
  usePublisher: () => ({ publish: api.publish, publishing: false, outcome: null, summary: { changed_years: [], changed_docs: [], since: null } }),
  outcomeText: () => 'Published',
}));

import { publishedSiteDoc } from '../../src/lib/cms/siteChrome';
import FooterEditor from '../../src/admin/modules/site/FooterEditor';
import { useSiteDraft } from '../../src/admin/modules/site/useSiteDraft';
import HeaderEditor from '../../src/admin/modules/site/HeaderEditor';

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}</output>;
}
const wrap = (ui: ReactNode) => render(<MemoryRouter><ToastHost>{ui}<Where /></ToastHost></MemoryRouter>);
const enInputs = () => screen.getAllByRole('textbox', { name: 'Κείμενο · English' }) as HTMLInputElement[];
const elInputs = () => screen.getAllByRole('textbox', { name: 'Κείμενο · Ελληνικά' }) as HTMLInputElement[];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useSiteDraft (final review M4)', () => {
  it('has no publish of its own: a site-wide doc goes live only through the preview publish screen', async () => {
    const { result } = renderHook(() => useSiteDraft('site-footer'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect('publish' in result.current).toBe(false);
    expect(api.publish).not.toHaveBeenCalled();
  });
});

describe('useSiteDraft discard (re-review N4)', () => {
  it('a saved draft identical to the site counts as live (no Publish)', async () => {
    api.cmsGet.mockResolvedValueOnce({ doc_id: 'site-footer', doc_type: 'site-footer', data: JSON.parse(JSON.stringify(publishedSiteDoc('site-footer'))), updated_at: '2026-11-22T12:00:00Z' } as never);
    const { result } = renderHook(() => useSiteDraft('site-footer'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe('live');
  });

  it('a refused Discard shows why instead of failing silently, and keeps the draft', async () => {
    const changed = JSON.parse(JSON.stringify(publishedSiteDoc('site-footer')));
    changed.en.tagline = `${changed.en.tagline}.`;
    api.cmsGet.mockResolvedValueOnce({ doc_id: 'site-footer', doc_type: 'site-footer', data: changed, updated_at: '2026-11-22T12:00:00Z' } as never);
    api.cmsDiscard.mockRejectedValueOnce(new Error('document changed by someone else; reload'));
    const { result } = renderHook(() => useSiteDraft('site-footer'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBe('draft');
    await act(async () => { await result.current.discard(); });
    expect(api.cmsDiscard).toHaveBeenCalledWith('site-footer', '2026-11-22T12:00:00Z');
    expect(result.current.discardError).toContain('document changed by someone else');
    expect(result.current.status).toBe('draft');
  });
});

describe('footer editor', () => {
  it('shows a column with its links in both languages', async () => {
    wrap(<FooterEditor column="help" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Βοήθεια' });
    await screen.findByTestId('autosave-pill');
    expect(enInputs().map((i) => i.value)).toEqual(['FAQ', 'Create a Room', 'Join a Room', 'Leave / Delete a Room', 'How Points Are Calculated', 'Privacy Policy', 'Terms of Use']);
    expect(elInputs()[0].value).toBe('Συχνές Ερωτήσεις');
    expect(screen.getByText('Ίδιο με το site')).toBeInTheDocument();
  });

  it('deletes a link with undo', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    fireEvent.click(screen.getAllByRole('button', { name: 'Διαγραφή' })[1]);
    expect(enInputs().map((i) => i.value)).toEqual(['What is Eurovision Games', 'Cookies & Consent']);
    const toast = screen.getAllByRole('status').find((n) => /Διαγράφηκε/.test(n.textContent ?? ''))!;
    expect(toast.textContent).toMatch(/Διαγράφηκε: «Δωρεάν Online Παιχνίδι Eurovision»/);
    fireEvent.click(within(toast).getByRole('button', { name: 'Αναίρεση' }));
    expect(enInputs().map((i) => i.value)).toEqual(['What is Eurovision Games', 'Free Online Eurovision Game', 'Cookies & Consent']);
  });

  it('blocks Publish on an empty label and says where', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    fireEvent.change(elInputs()[0], { target: { value: ' ' } });
    expect(screen.getByText('Γράψε κάτι εδώ')).toBeInTheDocument();
    expect(elInputs()[0]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Δημοσίευση' })).toBeDisabled();
    expect(screen.getByText(/Διόρθωσε το σημείο με κόκκινο/)).toBeInTheDocument();
  });

  it('adds a page from the searchable list; pages already in the column are disabled', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    fireEvent.click(screen.getByRole('button', { name: 'Προσθήκη συνδέσμου' }));
    const dialog = screen.getByRole('dialog', { name: 'Προσθήκη συνδέσμου' });
    expect(within(dialog).getByRole('button', { name: /Cookies & consent/ })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Αναζήτηση σελίδας' }), { target: { value: 'rules' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Rules/ }));
    // The label the site already uses for that page, in both languages.
    expect(enInputs().at(-1)!.value).toBe('Rules');
    expect(elInputs().at(-1)!.value).toBe('Κανόνες');
  });

  it('a page already in the column cannot be picked again (an FAQ question is a different place)', async () => {
    wrap(<FooterEditor column="help" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Βοήθεια' });
    await screen.findByTestId('autosave-pill');
    // Point "Create a Room" (/faq#create) at /faq, which the column already has.
    fireEvent.click(screen.getAllByRole('button', { name: /FAQ · Δημιουργία δωματίου/ })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Αλλαγή σελίδας' });
    expect(within(dialog).getByRole('button', { name: /^FAQ\s*\/faq\s*Ήδη στη λίστα$/ })).toBeDisabled();
  });

  it('hides a link without deleting it', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    fireEvent.click(screen.getAllByRole('switch', { name: 'Απόκρυψη από το site' })[0]);
    expect(screen.getByText('Δεν φαίνεται')).toBeInTheDocument();
    expect(enInputs()).toHaveLength(3);
  });

  it('reorders with the arrows', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    fireEvent.click(screen.getAllByRole('button', { name: 'Μετακίνηση κάτω' })[0]);
    expect(enInputs().map((i) => i.value)).toEqual(['Free Online Eurovision Game', 'What is Eurovision Games', 'Cookies & Consent']);
  });

  it('edits autosave as a draft; Publish warns it affects every page, then runs the pipeline', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByRole('heading', { name: 'Υποσέλιδο · Σχετικά' });
    await screen.findByTestId('autosave-pill');
    expect(screen.queryByRole('button', { name: 'Αποθήκευση' })).toBeNull();
    fireEvent.change(enInputs()[0], { target: { value: 'About us' } });
    expect(screen.getByText('Μη αποθηκευμένες αλλαγές')).toBeInTheDocument();
    expect(screen.getByTestId('autosave-pill').textContent).toBe('Αποθήκευση…');
    fireEvent.focusOut(enInputs()[0]);
    await waitFor(() => expect(api.cmsSave).toHaveBeenCalledTimes(1));
    const [docId, docType, doc, expected] = api.cmsSave.mock.calls[0] as unknown as [string, string, { en: { columns: Array<{ links: Array<{ label: string }> }> } }, string | null];
    expect([docId, docType, expected]).toEqual(['site-footer', 'site-footer', null]);
    expect(doc.en.columns[0].links[0].label).toBe('About us');
    await screen.findByText('Πρόχειρο, χωρίς δημοσίευση');
    expect(screen.getByRole('link', { name: 'Ιστορικό' }).getAttribute('href')).toBe('/admin/footer/history');

    // P5: Publish saves, then opens the doc's publish screen (diff, Vercel preview, go live); nothing ships from here.
    fireEvent.click(screen.getByRole('button', { name: 'Δημοσίευση' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/admin/footer/publish'));
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('an invalid edit is kept locally and never sent', async () => {
    wrap(<FooterEditor column="about" />);
    await screen.findByTestId('autosave-pill');
    fireEvent.change(elInputs()[0], { target: { value: ' ' } });
    fireEvent.focusOut(elInputs()[0]);
    await waitFor(() => expect(screen.getByTestId('autosave-pill').getAttribute('data-status')).toBe('invalid'));
    expect(api.cmsSave).not.toHaveBeenCalled();
  });
});

describe('header editor', () => {
  it('lists the links and the How to play menu with its own links; /rules is there as shipped', async () => {
    wrap(<HeaderEditor />);
    await screen.findByRole('heading', { name: 'Κεφαλίδα' });
    await screen.findByTestId('autosave-pill');
    expect(enInputs().map((i) => i.value)).toEqual(['Eurovision {year}', 'Eurovision Night', 'How to Play', 'Trivia', 'Predictions', 'Rules', 'Scoring', 'Other FAQ']);
    expect(screen.getByText('Σύνδεσμοι του μενού')).toBeInTheDocument();
  });

  it('header links cannot go to another site', async () => {
    wrap(<HeaderEditor />);
    await screen.findByRole('heading', { name: 'Κεφαλίδα' });
    await screen.findByTestId('autosave-pill');
    fireEvent.click(screen.getAllByRole('button', { name: 'Προσθήκη συνδέσμου' })[0]);
    expect(screen.queryByRole('textbox', { name: 'Διεύθυνση άλλου site' })).toBeNull();
  });
});
