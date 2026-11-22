import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import i18n from '../../../src/i18n';
import { useGameStore } from '../../../src/stores/gameStore';
import BottomNav, { GAME_TABS, isTabLocked } from '../../../src/components/layout/BottomNav';
import PhaseStrip from '../../../src/components/layout/PhaseStrip';
import PhaseBanner, { usePhaseBanner, PHASE_BANNER_MS } from '../../../src/components/layout/PhaseBanner';
import LobbyScreen from '../../../src/components/lobby/LobbyScreen';
import { ScoreChip } from '../../../src/components/stage';
import { roomJoinUrl, useInvite } from '../../../src/hooks/useInvite';
import type { Player, Room, RoomPhase } from '../../../src/lib/types';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('framer-motion', async (orig) => {
  const mod = await orig<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => reduced.value };
});

beforeAll(async () => {
  await i18n.changeLanguage('el');
});

const room = (phase: RoomPhase): Room => ({
  id: 'r1', code: 'K3PW7X', host_id: 'u1', host_name: 'x', year: 2026, phase, max_players: 20,
  quiz_rounds: 3, duel_limit: 10, created_at: '2026-05-16T18:00:00Z', phase_updated_at: null,
  quiz_opened_at: null, predictions_opened_at: null, predictions_locked_at: null,
  results_source: 'pending', results_confirmed: false, last_activity_at: '2026-05-16T18:00:00Z',
});
const player = (id: string, name: string, extra: Partial<Player> = {}): Player => ({
  id, room_id: 'r1', user_id: `u-${id}`, name, avatar_emoji: '🎤', avatar_id: 'av-01', country_flag: null,
  quiz_points: 0, pred_points: 0, duel_points: 0, points_spent: 0, total_points: 0,
  is_host: false, is_active: true, status: 'active', left_at: null, decline_count: 0,
  last_seen_at: null, joined_at: '2026-05-16T18:00:00Z', ...extra,
});

beforeEach(() => {
  reduced.value = false;
  useGameStore.getState().reset();
});

// ── Tabs ─────────────────────────────────────────────────────────────
describe('game tabs', () => {
  it('lists Προβλέψεις / Κουίζ / Μονομαχίες / Βαθμολογία in that order', () => {
    useGameStore.getState().setRoom(room('predictions_open'));
    render(<BottomNav phase="predictions_open" />);
    const nav = screen.getByRole('navigation', { name: 'Ενότητες παιχνιδιού' });
    const labels = within(nav).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Προβλέψεις', 'Κουίζ', 'Μονομαχίες', 'Βαθμολογία']);
    expect(GAME_TABS.map((t) => t.id)).toEqual(['predictions', 'quiz', 'duels', 'leaderboard']);
  });

  it('keeps the existing lock rules for every phase', () => {
    const locked = (phase: string) => GAME_TABS.filter((t) => isTabLocked(t.id, phase)).map((t) => t.id);
    expect(locked('pre_night')).toEqual(['predictions']);
    expect(locked('predictions_open')).toEqual([]);
    expect(locked('voting_live')).toEqual(['quiz', 'duels']);
    expect(locked('final')).toEqual(['quiz', 'duels']);
    expect(locked('lobby')).toEqual(['predictions']);
  });

  it('renders locked tabs disabled with a lock and an accessible hint', () => {
    render(<BottomNav phase="voting_live" />);
    const quiz = screen.getByRole('button', { name: 'Κουίζ · Κλειδωμένο σε αυτή τη φάση' });
    expect(quiz).toBeDisabled();
    expect(quiz).toHaveAttribute('aria-disabled', 'true');
    expect(quiz.querySelector('.gs-pin.l svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Βαθμολογία' })).toBeEnabled();
  });

  it('shows every section locked in the lobby (desktop rail), with the start hint', () => {
    render(<BottomNav variant="rail" phase="lobby" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      expect(b).toBeDisabled();
      expect(b.getAttribute('aria-label')).toMatch(/· Ανοίγει με την έναρξη$/);
    }
  });

  it('switches the active tab on click and marks it as the current page', () => {
    useGameStore.getState().setActiveTab('quiz');
    render(<BottomNav phase="predictions_open" />);
    fireEvent.click(screen.getByRole('button', { name: 'Βαθμολογία' }));
    expect(useGameStore.getState().activeTab).toBe('leaderboard');
    expect(screen.getByRole('button', { name: 'Βαθμολογία' })).toHaveAttribute('aria-current', 'page');
  });
});

// ── Phase strip ──────────────────────────────────────────────────────
describe('<PhaseStrip>', () => {
  it('compact: current phase and the next one, using the phases.* labels', () => {
    render(<PhaseStrip phase="pre_night" variant="compact" />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.replace('→', ''))).toEqual(['Προθέρμανση', 'Οι προβλέψεις είναι ανοιχτές']);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
  });

  it('full: every phase, past ones marked past', () => {
    render(<PhaseStrip phase="voting_live" variant="full" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.slice(0, 3).every((li) => li.classList.contains('past'))).toBe(true);
    expect(items[3]).toHaveAttribute('aria-current', 'step');
    expect(items[3]).toHaveTextContent('Ψηφοφορία σε εξέλιξη');
  });

  it('phase labels never read like a tab name (EL and EN)', () => {
    const phases = ['lobby', 'pre_night', 'predictions_open', 'voting_live', 'final'];
    for (const lng of ['el', 'en']) {
      const fixed = i18n.getFixedT(lng);
      const tabs = new Set(['predict', 'quiz', 'duels', 'board'].map((k) => fixed(`nav.${k}`).toLowerCase()));
      for (const p of phases) expect(tabs.has(fixed(`phases.${p}.label`).toLowerCase())).toBe(false);
    }
    expect(phases.map((p) => i18n.getFixedT('el')(`phases.${p}.label`))).toEqual([
      'Λόμπι', 'Προθέρμανση', 'Οι προβλέψεις είναι ανοιχτές', 'Ψηφοφορία σε εξέλιξη', 'Τελικά αποτελέσματα',
    ]);
    expect(phases.map((p) => i18n.getFixedT('en')(`phases.${p}.label`))).toEqual([
      'Lobby', 'Warm-up', 'Predictions open', 'Voting live', 'Final results',
    ]);
  });

  it('final has no "next"', () => {
    render(<PhaseStrip phase="final" variant="compact" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('is a toggle button when it opens the phase list', () => {
    const onToggle = vi.fn();
    render(<PhaseStrip phase="lobby" variant="compact" onToggle={onToggle} expanded={false} />);
    const btn = screen.getByRole('button', { name: /Όλες οι φάσεις της βραδιάς: Λόμπι/ });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});

// ── Points chip ──────────────────────────────────────────────────────
describe('<ScoreChip>', () => {
  it('counts up to the new total', async () => {
    const { rerender, container } = render(<ScoreChip points={100} srLabel="100 πόντοι" />);
    const shown = () => container.querySelector('.num')!.textContent;
    expect(shown()).toBe('100');
    rerender(<ScoreChip points={160} srLabel="160 πόντοι" />);
    expect(shown()).toBe('100'); // not jumped yet
    await waitFor(() => expect(shown()).toBe('160'), { timeout: 2000 });
    expect(screen.getByText('160 πόντοι')).toHaveClass('sr-only');
  });

  it('shows the new total at once under reduced motion', () => {
    reduced.value = true;
    const { rerender, container } = render(<ScoreChip points={100} srLabel="100" />);
    rerender(<ScoreChip points={160} srLabel="160" />);
    expect(container.querySelector('.num')!.textContent).toBe('160');
  });
});

// ── Phase-change banner ──────────────────────────────────────────────
describe('phase-change banner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function Harness({ phase }: { phase: RoomPhase | undefined }) {
    const b = usePhaseBanner(phase);
    return <PhaseBanner phase={b.shown} onDismiss={b.dismiss} />;
  }

  it('fires on a store phase change, not on the first phase seen, and buzzes', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { rerender } = render(<Harness phase="pre_night" />);
    expect(screen.queryByText('Οι προβλέψεις άνοιξαν!')).toBeNull();
    expect(vibrate).not.toHaveBeenCalled();
    rerender(<Harness phase="predictions_open" />);
    expect(screen.getByText('Οι προβλέψεις άνοιξαν!')).toBeInTheDocument();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('has copy for each later phase and none for the lobby', () => {
    for (const phase of ['pre_night', 'predictions_open', 'voting_live', 'final'] as const) {
      expect(i18n.exists(`phaseBanner.${phase}.title`)).toBe(true);
      expect(i18n.exists(`phaseBanner.${phase}.body`)).toBe(true);
    }
    const { result, rerender } = renderHook(({ p }) => usePhaseBanner(p), { initialProps: { p: 'pre_night' as RoomPhase } });
    rerender({ p: 'lobby' });
    expect(result.current.shown).toBeNull();
  });

  it('goes away by itself, or on dismiss', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ p }) => usePhaseBanner(p), { initialProps: { p: 'predictions_open' as RoomPhase } });
    rerender({ p: 'voting_live' });
    expect(result.current.shown).toBe('voting_live');
    act(() => { vi.advanceTimersByTime(PHASE_BANNER_MS + 10); });
    expect(result.current.shown).toBeNull();
    rerender({ p: 'final' });
    expect(result.current.shown).toBe('final');
    act(() => result.current.dismiss());
    expect(result.current.shown).toBeNull();
  });
});

// ── Lobby ────────────────────────────────────────────────────────────
describe('<LobbyScreen>', () => {
  const host = player('p1', 'Douze Points', { is_host: true, joined_at: '2026-05-16T18:00:00Z' });
  const guest = player('p2', 'Wind Machine', { joined_at: '2026-05-16T18:03:00Z', avatar_id: 'av-07' });

  function seed(me: Player, players: Player[]) {
    const st = useGameStore.getState();
    st.setRoom(room('lobby'));
    st.setPlayer(me);
    st.setPlayers(players);
  }

  it('shows a QR of the room join link and the code', () => {
    seed(host, [host, guest]);
    render(<LobbyScreen onAdvancePhase={vi.fn()} />);
    const qr = screen.getByRole('img', { name: 'QR για είσοδο στο δωμάτιο K3PW7X' });
    expect(qr).toHaveAttribute('data-qr-value', roomJoinUrl('K3PW7X'));
    expect(qr.getAttribute('data-qr-value')).toBe(`${window.location.origin}/room/K3PW7X`);
    expect(screen.getByText('K3PW7X')).toBeInTheDocument();
  });

  it('host QR carries the password in the #k= fragment; guests and invites never do', async () => {
    seed(host, [host, guest]);
    useGameStore.getState().setRoomPassword('ab c/d?');
    const { unmount } = render(<LobbyScreen onAdvancePhase={vi.fn()} />);
    const value = screen.getByRole('img', { name: /K3PW7X/ }).getAttribute('data-qr-value')!;
    expect(value).toBe(`${window.location.origin}/room/K3PW7X#k=${encodeURIComponent('ab c/d?')}`);
    expect(new URL(value).search).toBe('');

    // Invite text: the link is the plain join link, never the QR fragment.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { result } = renderHook(() => useInvite());
    await act(() => result.current.copyInvite());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain(roomJoinUrl('K3PW7X'));
    expect(text).not.toContain('#k=');
    expect(text).not.toContain(encodeURIComponent('ab c/d?'));
    expect(result.current.joinUrl).toBe(roomJoinUrl('K3PW7X'));
    unmount();

    seed(guest, [host, guest]);
    render(<LobbyScreen onAdvancePhase={vi.fn()} />);
    expect(screen.getByRole('img', { name: /K3PW7X/ })).toHaveAttribute('data-qr-value', roomJoinUrl('K3PW7X'));
  });

  it('tiles show avatar + stage name, "εσύ" and the host chip, in join order', () => {
    seed(guest, [guest, host]); // store order is by points; tiles go by joined_at
    const { container } = render(<LobbyScreen onAdvancePhase={vi.fn()} />);
    const tiles = [...container.querySelectorAll('.lb-tile')];
    expect(tiles.map((t) => t.querySelector('.lb-tile-name')!.textContent)).toEqual(['Douze Points', 'Wind Machine']);
    expect(tiles[0]).toHaveTextContent('Host');
    expect(tiles[1]).toHaveTextContent('εσύ');
    expect(tiles[1].querySelector('[data-avatar-id="av-07"]')).not.toBeNull();
  });

  it('host: Start is disabled alone and calls onAdvancePhase with 2+ players', async () => {
    seed(host, [host]);
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<LobbyScreen onAdvancePhase={onAdvance} />);
    for (const b of screen.getAllByRole('button', { name: 'Ξεκίνα το πάρτι' })) expect(b).toBeDisabled();
    expect(screen.getAllByText('Χρειάζονται 1 ακόμα').length).toBeGreaterThan(0);

    act(() => useGameStore.getState().setPlayers([host, guest]));
    rerender(<LobbyScreen onAdvancePhase={onAdvance} />);
    const start = screen.getAllByRole('button', { name: 'Ξεκίνα το πάρτι' })[0];
    expect(start).toBeEnabled();
    fireEvent.click(start);
    await waitFor(() => expect(onAdvance).toHaveBeenCalledTimes(1));
  });

  it('guest: no Start button, a waiting line instead', () => {
    seed(guest, [host, guest]);
    render(<LobbyScreen onAdvancePhase={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ξεκίνα το πάρτι' })).toBeNull();
    expect(screen.getAllByText('Περιμένουμε την έναρξη του πάρτι…').length).toBeGreaterThan(0);
  });

  it('lobby, shell and banner copy has no gendered pronouns or role nouns', () => {
    const el = i18n.getResourceBundle('el', 'translation') as Record<string, Record<string, string>>;
    const strings = [
      ...Object.values(el.lobby), ...Object.values(el.game),
      ...Object.values(el.phaseBanner).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
    ].join(' \n ');
    expect(strings).not.toMatch(/(?<!\p{L})(αυτός|αυτή|αυτόν|αυτήν|ποιος|ποια|ποιον)(?!\p{L})/iu);
    expect(strings).not.toMatch(/οικοδεσπ/i);
  });
});
