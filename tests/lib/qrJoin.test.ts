import { describe, it, expect, afterEach, vi } from 'vitest';
import { withQrPassword, captureQrPassword, peekQrPassword, clearQrPassword } from '../../src/lib/qrJoin';
import { roomQrUrl, roomJoinUrl } from '../../src/hooks/useInvite';

afterEach(() => {
  clearQrPassword();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('QR join URL', () => {
  it('puts the encoded password in the fragment, never in the path or query', () => {
    const url = roomQrUrl('K3PW7X', 'p@ss word/?#&=', 'https://eurovision.games');
    expect(url).toBe(`https://eurovision.games/room/K3PW7X#k=${encodeURIComponent('p@ss word/?#&=')}`);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/room/K3PW7X');
    expect(parsed.search).toBe('');
    expect(url.split('#')[0]).not.toContain('p%40ss');
    expect(url.indexOf('?')).toBe(-1);
  });

  it('without a password the QR is the plain join link', () => {
    expect(roomQrUrl('K3PW7X', null, 'https://x.test')).toBe(roomJoinUrl('K3PW7X', 'https://x.test'));
    expect(withQrPassword('https://x.test/room/A', '')).toBe('https://x.test/room/A');
  });
});

describe('QR landing', () => {
  it('reads #k=, strips the fragment with replaceState and keeps it for the room', () => {
    window.history.replaceState(null, '', `/room/K3PW7X?x=1#k=${encodeURIComponent('s3cret+ &é')}`);
    const spy = vi.spyOn(window.history, 'replaceState');
    expect(captureQrPassword('k3pw7x')).toBe('s3cret+ &é');
    expect(spy).toHaveBeenCalledTimes(1);
    const target = String(spy.mock.calls[0][2]);
    expect(target).toBe('/room/K3PW7X?x=1');
    expect(target).not.toContain('#');
    expect(window.location.hash).toBe('');
    expect(peekQrPassword('K3PW7X')).toBe('s3cret+ &é');
    expect(peekQrPassword('OTHER1')).toBeNull();
    clearQrPassword();
    expect(peekQrPassword('K3PW7X')).toBeNull();
  });

  it('leaves the URL alone when there is no password fragment', () => {
    window.history.replaceState(null, '', '/room/K3PW7X#top');
    const spy = vi.spyOn(window.history, 'replaceState');
    expect(captureQrPassword('K3PW7X')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(peekQrPassword('K3PW7X')).toBeNull();
  });
});
