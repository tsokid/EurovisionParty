/**
 * The bell's phase entries (28 Nov 2026, migration 106).
 *
 * When the owner changes the phase (set_game_phase) or Finalize ends the
 * night (_move_all_to_final), the server stores one notification per active
 * player, as before, but no longer pushes each one: the room's own push
 * already reaches every phone. The app adds the bell entry from that room
 * push, with the same type, payload and time the server stored, and swaps it
 * for the stored row as soon as a fetch brings the row in.
 *
 * Exactly the server's rules:
 *   pre_night / predictions_open / voting_live → another of the three:
 *       type = the new phase ('phase_changed' for pre_night)
 *   anything → final: type 'phase_changed'
 *   lobby → anything (the host starts the room): no notification.
 */
import type { Notification, Room } from './types';

export const PHASE_NOTIFICATION_TYPES = ['phase_changed', 'predictions_open', 'voting_live'] as const;
const OWNER_PHASES = ['pre_night', 'predictions_open', 'voting_live'];
const LOCAL_PREFIX = 'local-phase:';

export function isPhaseNotification(n: Pick<Notification, 'type'>): boolean {
  return (PHASE_NOTIFICATION_TYPES as readonly string[]).includes(n.type);
}

export function isLocalNotification(n: Pick<Notification, 'id'>): boolean {
  return n.id.startsWith(LOCAL_PREFIX);
}

/** The bell entry the server stored for this phase change, or null. */
export function phaseNotificationFor(
  prevPhase: string | null | undefined,
  room: Pick<Room, 'id' | 'phase' | 'phase_updated_at'>,
  playerId: string,
): Notification | null {
  const next = room.phase;
  if (!prevPhase || prevPhase === next || !room.phase_updated_at) return null;
  let type: string | null = null;
  let reason = 'owner';
  if (next === 'final') {
    type = 'phase_changed';
    reason = 'results_finalized';
  } else if (OWNER_PHASES.includes(prevPhase) && OWNER_PHASES.includes(next)) {
    type = next === 'pre_night' ? 'phase_changed' : next;
  }
  if (!type) return null;
  return {
    id: `${LOCAL_PREFIX}${room.id}:${next}:${room.phase_updated_at}`,
    room_id: room.id,
    player_id: playerId,
    type,
    payload: { to: next, reason },
    is_read: false,
    created_at: room.phase_updated_at,
    expires_at: null,
  };
}

/** The same phase change: same room, same target phase, same server time. */
export function isSamePhaseEvent(a: Notification, b: Notification): boolean {
  return isPhaseNotification(a) && isPhaseNotification(b)
    && a.room_id === b.room_id
    && a.payload?.to === b.payload?.to
    && Date.parse(a.created_at) === Date.parse(b.created_at);
}

/**
 * Adds a notification to the list: a stored row replaces the app's own
 * entry for the same phase change (keeping "read" if either was read); the
 * app's entry is skipped when the stored row is already there.
 */
export function mergeNotification(list: Notification[], notif: Notification): Notification[] {
  if (list.some((n) => n.id === notif.id)) return list;
  const twin = list.findIndex((n) => isSamePhaseEvent(n, notif));
  if (twin >= 0) {
    const existing = list[twin];
    if (isLocalNotification(notif) || !isLocalNotification(existing)) return list;
    const next = [...list];
    next[twin] = { ...notif, is_read: notif.is_read || existing.is_read };
    return next;
  }
  return [notif, ...list].slice(0, 100);
}
