// The routed admin shell (CMS P0): every screen at its own URL, back/forward
// and reload restore it, the breadcrumb and "View live" follow the screen,
// and the unsaved-edits guard asks before a route change, sign-out or unload.
// The modules are stand-ins that show the selection the route passes in.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useUnsavedGuard, UNSAVED_TEXT } from '../../src/admin/unsavedGuard';
import AdminShell from '../../src/admin/AdminShell';
import type { AdminAuth } from '../../src/admin/useAdminAuth';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

function DirtyBox() {
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);
  return (
    <label>
      Dirty
      <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} />
    </label>
  );
}

vi.mock('../../src/admin/modules/Contests', () => ({
  default: (p: { year: number | null; section: string; iso: string | null; onSelect: (y: number | null) => void }) => (
    <div>
      <p>Contests module: {String(p.year)} {p.section} {String(p.iso)}</p>
      <button type="button" onClick={() => p.onSelect(2026)}>Edit 2026</button>
      <DirtyBox />
    </div>
  ),
}));
vi.mock('../../src/admin/modules/Pages', async () => {
  const { useAdminLive } = await import('../../src/admin/adminMeta');
  return {
    default: function PagesStub(p: { docId: string | null; onOpen: (d: string | null) => void }) {
      useAdminLive(p.docId === 'faq' ? '/faq' : null);
      return (
        <div>
          <p>Pages module: {String(p.docId)}</p>
          <button type="button" onClick={() => p.onOpen('about')}>Open about</button>
          <DirtyBox />
        </div>
      );
    },
  };
});
vi.mock('../../src/admin/modules/Winners', () => ({
  default: (p: { roomId: string | null }) => <p>Winners module: {String(p.roomId)}</p>,
}));
vi.mock('../../src/admin/modules/EurovisionParser', () => ({
  default: (p: { year: number | null; onPickYear: (y: number) => void }) => (
    <div>
      <p>Parser module: {String(p.year)}</p>
      <button type="button" onClick={() => p.onPickYear(2025)}>Pick 2025</button>
    </div>
  ),
}));
vi.mock('../../src/admin/modules/PhaseMonitor', () => ({ default: () => <p>Monitor module</p> }));
vi.mock('../../src/admin/modules/SuperAdmins', () => ({ default: () => <p>Super admins module</p> }));
vi.mock('../../src/admin/modules/contests/PublishBar', () => ({ PublishBar: () => <p>Publish bar</p> }));
vi.mock('../../src/admin/modules/contests/publish', () => ({ usePublisher: () => ({}) }));
vi.mock('../../src/admin/modules/site/HeaderEditor', () => ({ default: () => <p>Header editor</p> }));
vi.mock('../../src/admin/modules/site/FooterEditor', () => ({
  default: (p: { column: string | null }) => <p>Footer editor: {String(p.column)}</p>,
  COLUMN_TITLE: { about: 'Σχετικά', 'how-to-play': 'Πώς παίζεται', eurovision: 'Eurovision', help: 'Βοήθεια' },
}));
vi.mock('../../src/admin/modules/site/SettingsEditor', () => ({ default: () => <p>Settings editor</p> }));
vi.mock('../../src/admin/modules/avatars/AvatarsLibrary', () => ({ default: () => <p>Avatars library</p> }));


const auth = { email: 'a@b.c', logout: vi.fn(), status: 'authenticated' } as unknown as AdminAuth;

function show(path: string) {
  const router = createMemoryRouter([{ path: '/admin/*', element: <AdminShell auth={auth} /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const beforeUnload = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

const desktopNav = () => screen.getAllByRole('navigation', { name: 'Διαχείριση' })[0];
const crumbs = () => within(screen.getByRole('navigation', { name: 'Διαδρομή' })).getAllByRole('listitem').map((li) => li.textContent?.replace(/^\//, ''));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin URLs', () => {
  it.each([
    ['/admin', 'Publish bar', ['Επισκόπηση']],
    ['/admin/header', 'Header editor', ['Ιστότοπος', 'Κεφαλίδα']],
    ['/admin/footer', 'Footer editor: null', ['Ιστότοπος', 'Υποσέλιδο']],
    ['/admin/footer/help', 'Footer editor: help', ['Ιστότοπος', 'Υποσέλιδο', 'Βοήθεια']],
    ['/admin/pages', 'Pages module: null', ['Ιστότοπος', 'Σελίδες']],
    ['/admin/pages/faq', 'Pages module: faq', ['Ιστότοπος', 'Σελίδες', 'Συχνές ερωτήσεις']],
    ['/admin/pages/archive-2004', 'Pages module: archive-2004', ['Ιστότοπος', 'Σελίδες', 'Χρονιά 2004']],
    ['/admin/contests', 'Contests module: null details null', ['Διαγωνισμοί']],
    ['/admin/contests/2027', 'Contests module: 2027 details null', ['Διαγωνισμοί', '2027']],
    ['/admin/contests/2027/entries', 'Contests module: 2027 entries null', ['Διαγωνισμοί', '2027', 'Συμμετοχές']],
    ['/admin/contests/2027/entries/se', 'Contests module: 2027 entries SE', ['Διαγωνισμοί', '2027', 'Συμμετοχές', 'SE']],
    ['/admin/game/monitor', 'Monitor module', ['Παιχνίδι', 'Φάσεις δωματίων']],
    ['/admin/game/parser', 'Parser module: null', ['Παιχνίδι', 'Parser και χειρισμοί']],
    ['/admin/game/parser/2026', 'Parser module: 2026', ['Παιχνίδι', 'Parser και χειρισμοί', '2026']],
    ['/admin/game/winners', 'Winners module: null', ['Παιχνίδι', 'Νικητές']],
    ['/admin/game/winners/room-1', 'Winners module: room-1', ['Παιχνίδι', 'Νικητές', 'Δωμάτιο']],
    ['/admin/game/avatars', 'Avatars library', ['Παιχνίδι', 'Avatars']],
    ['/admin/media', 'Βιβλιοθήκη πολυμέσων', ['Πολυμέσα']],
    ['/admin/settings', 'Settings editor', ['Ρυθμίσεις', 'Ρυθμίσεις ιστότοπου']],
    ['/admin/system/admins', 'Super admins module', ['Ρυθμίσεις', 'Διαχειριστές']],
  ])('%s renders its screen', async (path, text, trail) => {
    show(path);
    expect(await screen.findAllByText(text)).not.toHaveLength(0);
    expect(crumbs()).toEqual(trail);
  });

  it.each(['/admin/nope', '/admin/pages/no-such-doc', '/admin/contests/abc', '/admin/contests/2027/bogus', '/admin/footer/sideways', '/admin/game/parser/20x6'])(
    '%s says there is nothing there',
    async (path) => {
      show(path);
      expect(await screen.findByRole('heading', { name: 'Δεν υπάρχει κάτι εδώ' })).toBeTruthy();
    },
  );

  it('placeholders are honest: no buttons, and they name their phase', async () => {
    show('/admin/media');
    expect(await screen.findByText('Έρχεται στη φάση P6')).toBeTruthy();
    expect(within(screen.getByRole('main')).queryAllByRole('button')).toHaveLength(0);
  });

  it('header, footer, settings and avatars are no longer marked as coming later', async () => {
    show('/admin/header');
    await screen.findByText('Header editor');
    for (const name of ['Κεφαλίδα', 'Υποσέλιδο', 'Avatars', 'Ρυθμίσεις ιστότοπου']) {
      expect(within(desktopNav()).getByRole('link', { name }).textContent).not.toMatch(/P2/);
    }
  });

  it('nav links, module selections, back and forward all move the URL', async () => {
    const router = show('/admin');
    fireEvent.click(within(desktopNav()).getByRole('link', { name: 'Χρονιές και συμμετοχές' }));
    expect(router.state.location.pathname).toBe('/admin/contests');
    fireEvent.click(screen.getByRole('button', { name: 'Edit 2026' }));
    expect(router.state.location.pathname).toBe('/admin/contests/2026');
    expect(await screen.findByText('Contests module: 2026 details null')).toBeTruthy();
    fireEvent.click(within(desktopNav()).getByRole('link', { name: /Parser/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick 2025' }));
    expect(router.state.location.pathname).toBe('/admin/game/parser/2025');
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/admin/game/parser');
    await act(() => router.navigate(-1));
    expect(await screen.findByText('Contests module: 2026 details null')).toBeTruthy();
    await act(() => router.navigate(1));
    expect(router.state.location.pathname).toBe('/admin/game/parser');
  });

  it('the Pages tree groups pages by where they appear and marks the open one', async () => {
    show('/admin/pages/eurovision-party');
    const nav = desktopNav();
    const none = within(nav).getByRole('button', { name: /Σε κανένα μενού/ });
    expect(none.getAttribute('aria-expanded')).toBe('true');
    const link = within(nav).getByRole('link', { name: 'Eurovision πάρτι' });
    expect(link.getAttribute('aria-current')).toBe('page');
    const header = within(nav).getByRole('button', { name: /^Κεφαλίδα/ });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);
    expect(within(nav).getByRole('link', { name: 'Βραδιά Eurovision' }).getAttribute('href')).toBe('/admin/pages/eurovision-night');
  });

  it('"View live" links to the public page in both locales when the screen has one', async () => {
    show('/admin/pages/faq');
    const en = await screen.findByRole('link', { name: /Άνοιγμα στο site \(EN\)/ });
    expect(en.getAttribute('href')).toBe('/en/faq');
    expect(en.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: /Άνοιγμα στο site \(EL\)/ }).getAttribute('href')).toBe('/el/faq');
    fireEvent.click(screen.getByRole('button', { name: 'Open about' }));
    expect(screen.queryByRole('link', { name: /Άνοιγμα στο site/ })).toBeNull();
  });

  it('shows the signed-in user', () => {
    show('/admin');
    expect(screen.getAllByText('a@b.c').length).toBeGreaterThan(0);
  });

  it('below lg the nav opens as a drawer that closes on navigation', async () => {
    const router = show('/admin');
    fireEvent.click(screen.getByRole('button', { name: 'Άνοιγμα μενού' }));
    const dialog = screen.getByRole('dialog', { name: 'Μενού διαχείρισης' });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Νικητές' }));
    expect(router.state.location.pathname).toBe('/admin/game/winners');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('unsaved-edits guard', () => {
  it('moves freely while nothing is dirty', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const router = show('/admin/pages/faq');
    fireEvent.click(within(desktopNav()).getByRole('link', { name: 'Χρονιές και συμμετοχές' }));
    expect(router.state.location.pathname).toBe('/admin/contests');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before a nav link leaves dirty edits, and stays when cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = show('/admin/pages/faq');
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(within(desktopNav()).getByRole('link', { name: 'Χρονιές και συμμετοχές' }));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(router.state.location.pathname).toBe('/admin/pages/faq');
    expect((screen.getByLabelText('Dirty') as HTMLInputElement).checked).toBe(true);
  });

  it('leaves when confirmed, and the guard is released with the editor', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const router = show('/admin/pages/faq');
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(screen.getByRole('button', { name: 'Open about' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/admin/pages/about');
    expect(await screen.findByText('Pages module: about')).toBeTruthy();
    // The stand-in stays mounted across docs (one route per module), so clear it by hand.
    fireEvent.click(screen.getByLabelText('Dirty'));
    expect(beforeUnload()).toBe(false);
    confirm.mockClear();
    fireEvent.click(within(desktopNav()).getByRole('link', { name: 'Νικητές' }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('back/forward asks too', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = show('/admin');
    fireEvent.click(within(desktopNav()).getByRole('link', { name: 'Χρονιές και συμμετοχές' }));
    fireEvent.click(screen.getByLabelText('Dirty'));
    await act(() => router.navigate(-1));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(router.state.location.pathname).toBe('/admin/contests');
  });

  it('moving within one contest year (details, entries, one entry) keeps the edits without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = show('/admin/contests/2027');
    fireEvent.click(screen.getByLabelText('Dirty'));
    await act(() => router.navigate('/admin/contests/2027/entries/SE'));
    expect(router.state.location.pathname).toBe('/admin/contests/2027/entries/SE');
    expect(confirm).not.toHaveBeenCalled();
    await act(() => router.navigate('/admin/contests/2026'));
    expect(confirm).toHaveBeenCalledWith(UNSAVED_TEXT);
    expect(router.state.location.pathname).toBe('/admin/contests/2027/entries/SE');
  });

  it('sign out asks too', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    show('/admin/pages/faq');
    fireEvent.click(screen.getByLabelText('Dirty'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Αποσύνδεση' })[0]);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('blocks a page unload (tab close, reload) only while dirty', () => {
    show('/admin/contests/2027');
    expect(beforeUnload()).toBe(false);
    fireEvent.click(screen.getByLabelText('Dirty'));
    expect(beforeUnload()).toBe(true);
    fireEvent.click(screen.getByLabelText('Dirty'));
    expect(beforeUnload()).toBe(false);
  });
});
