// Home page for players who already have rooms (owner chose option A):
// live first, then away, idle or ended rooms folded under
// «Παλιά δωμάτια»; newest first in each group; leave/delete in the ⋯ menu.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../src/i18n';
import type { RoomEntry } from '../../../src/hooks/useUserRooms';

const leave = vi.fn(async () => {});
const remove = vi.fn(async () => {});
vi.mock('../../../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../src/hooks/useUserRooms', async (orig) => {
  const real = await orig<typeof import('../../../src/hooks/useUserRooms')>();
  return { ...real, useUserRooms: () => ({ rooms: [], loaded: true, leave, remove }) };
});

const { sortRooms, isOldRoom } = await import('../../../src/hooks/useUserRooms');
const { default: RoomsHome } = await import('../../../src/components/home/RoomsHome');

beforeAll(async () => { await i18n.changeLanguage('el'); });

const NOW = Date.parse('2026-11-26T20:00:00Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
function room(code: string, over: Partial<RoomEntry> = {}): RoomEntry {
  return {
    playerId: `p-${code}`, roomId: `r-${code}`, roomCode: code, hostName: 'Νίκος',
    totalPoints: 10, status: 'active', leftAt: null, phase: 'lobby', isHost: false,
    joinedAt: ago(1), lastActivityAt: ago(0), ...over,
  };
}

describe('sortRooms / isOldRoom', () => {
  it('orders live, then away, newest joined first in each', () => {
    const out = sortRooms([
      room('AWAY01', { status: 'away', joinedAt: ago(1) }),
      room('LIVE01', { joinedAt: ago(5) }),
      room('LIVE02', { joinedAt: ago(1) }),
    ]);
    expect(out.map((r) => r.roomCode)).toEqual(['LIVE02', 'LIVE01', 'AWAY01']);
  });
  it('calls a room old after 30 idle days, or when it ended', () => {
    expect(isOldRoom(room('A', { lastActivityAt: ago(29) }), NOW)).toBe(false);
    expect(isOldRoom(room('B', { lastActivityAt: ago(31) }), NOW)).toBe(true);
    expect(isOldRoom(room('C', { phase: 'finished' }), NOW)).toBe(true);
    expect(isOldRoom(room('D', { lastActivityAt: null }), NOW)).toBe(false);
  });
});

describe('<RoomsHome />', () => {
  const rooms = [
    room('MINE01', { isHost: true, hostName: 'Ελένη', totalPoints: 120 }),
    room('LIVE02', { hostName: 'Νίκος', totalPoints: 45 }),
    room('AWAY03', { status: 'away', hostName: 'Μαρία' }),
    room('OLD004', { status: 'exited', lastActivityAt: ago(60) }),
  ];
  const setup = () => {
    const onCreate = vi.fn();
    const onJoinWithCode = vi.fn();
    render(
      <MemoryRouter>
        <RoomsHome rooms={sortRooms(rooms)} onCreate={onCreate} onJoinWithCode={onJoinWithCode} />
      </MemoryRouter>,
    );
    return { onCreate, onJoinWithCode };
  };

  it('groups live and away rooms and folds old ones', () => {
    setup();
    const live = screen.getByRole('region', { name: 'ΖΩΝΤΑΝΑ · 2' });
    expect(within(live).getByText('MINE01')).toBeTruthy();
    expect(within(live).getByText(/Host: εσύ/)).toBeTruthy();
    expect(within(live).getByText(/Host: Νίκος/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'ΕΚΤΟΣ · 1' })).getByRole('button', { name: 'Επανείσοδος' })).toBeTruthy();

    const old = screen.getByRole('button', { name: /Παλιά δωμάτια/ });
    expect(old.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('OLD004')?.closest('[hidden]')).toBeTruthy();
    fireEvent.click(old);
    expect(old.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('OLD004').closest('[hidden]')).toBeNull();
  });

  it('puts leave and delete in the ⋯ menu: delete only for the host', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Επιλογές για το δωμάτιο MINE01' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Έξοδος' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Διαγραφή δωματίου' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Επιλογές για το δωμάτιο LIVE02' }));
    expect(screen.queryByRole('menuitem', { name: 'Διαγραφή δωματίου' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Έξοδος' }));
    expect(leave).toHaveBeenCalledWith(expect.objectContaining({ roomCode: 'LIVE02' }));
  });

  it('keeps «Νέο δωμάτιο» and «Μπες με κωδικό»', () => {
    const { onCreate, onJoinWithCode } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Νέο δωμάτιο' }));
    fireEvent.click(screen.getByRole('button', { name: 'Μπες με κωδικό' }));
    expect(onCreate).toHaveBeenCalled();
    expect(onJoinWithCode).toHaveBeenCalled();
  });
});
