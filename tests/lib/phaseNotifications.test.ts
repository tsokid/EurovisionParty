// The bell's phase entries come from the room push (106) with the server's
// own rules, and give way to the stored row when a fetch brings it in.
import { describe, it, expect } from 'vitest';
import { mergeNotification, phaseNotificationFor } from '../../src/lib/phaseNotifications';
import type { Notification } from '../../src/lib/types';

const AT = '2027-05-15T19:00:00.123456+00:00';
const room = (phase: string) => ({ id: 'r1', phase, phase_updated_at: AT }) as never;

describe('phaseNotificationFor', () => {
  it('follows the server: owner phases and final notify, the host starting the room does not', () => {
    expect(phaseNotificationFor('pre_night', room('predictions_open'), 'p1')?.type).toBe('predictions_open');
    expect(phaseNotificationFor('predictions_open', room('voting_live'), 'p1')?.type).toBe('voting_live');
    expect(phaseNotificationFor('voting_live', room('pre_night'), 'p1')?.type).toBe('phase_changed');
    expect(phaseNotificationFor('voting_live', room('final'), 'p1')).toMatchObject({
      type: 'phase_changed', payload: { to: 'final', reason: 'results_finalized' }, created_at: AT, is_read: false,
    });
    expect(phaseNotificationFor('lobby', room('pre_night'), 'p1')).toBeNull();
    expect(phaseNotificationFor('lobby', room('predictions_open'), 'p1')).toBeNull();
    expect(phaseNotificationFor('voting_live', room('voting_live'), 'p1')).toBeNull();
    expect(phaseNotificationFor(null, room('voting_live'), 'p1')).toBeNull();
  });
});

describe('mergeNotification', () => {
  const local = phaseNotificationFor('pre_night', room('predictions_open'), 'p1')!;
  const stored: Notification = {
    id: '9c1b0000-0000-4000-8000-000000000001', room_id: 'r1', player_id: 'p1', type: 'predictions_open',
    payload: { to: 'predictions_open', reason: 'owner' }, is_read: false,
    created_at: '2027-05-15T19:00:00.123+00:00', expires_at: null,
  };

  it('the stored row replaces the app entry and keeps it read', () => {
    const list = mergeNotification([{ ...local, is_read: true }], stored);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(stored.id);
    expect(list[0].is_read).toBe(true);
  });

  it('the app entry is skipped when the stored row is already there', () => {
    const list = [stored];
    expect(mergeNotification(list, local)).toBe(list);
  });

  it('other notifications are added and deduplicated by id', () => {
    const duel: Notification = { ...stored, id: 'd1', type: 'duel_challenge', payload: {} };
    const list = mergeNotification([stored], duel);
    expect(list.map((n) => n.id)).toEqual(['d1', stored.id]);
    expect(mergeNotification(list, duel)).toBe(list);
  });
});
