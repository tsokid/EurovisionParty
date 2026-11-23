import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../../src/stores/gameStore';
import { useInvite } from '../../src/hooks/useInvite';
import i18n from '../../src/i18n';

describe('invite text', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('el');
    useGameStore.setState({
      room: { code: 'ABC123', max_players: 20 } as never,
      roomPassword: 'secret-pw-42',
      player: { is_host: true } as never,
    });
  });

  it('never contains the room password, but says where to get it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = renderHook(() => useInvite());
    await act(async () => { await result.current.copyInvite(); });
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('ABC123');
    expect(text).not.toContain('secret-pw-42');
    expect(text).toContain('όποιον έφτιαξε το δωμάτιο');
  });

  it('the host QR still carries the password', () => {
    const { result } = renderHook(() => useInvite());
    expect(result.current.qrUrl).toContain('#k=');
  });
});
