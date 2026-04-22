# Room Exit, Rejoin & Reconnection Design

**Date:** 2026-04-22  
**Status:** Approved  

---

## Overview

Four capabilities are being added to Eurovision Party:

1. **Visit Other Rooms** — soft exit; player goes "away" but keeps all progress
2. **Exit Game** — abandon with a 2-hour grace period before points are permanently lost
3. **Reconnect** — automatic recovery with a visible banner and catch-up fetch
4. **Your Rooms panel** — home screen list of all rooms the user has joined, with live status

---

## 1. Data Model

### Migration: `players` table

Add two columns:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `status` | `enum('active','away','exited')` | `'active'` | No |
| `left_at` | `timestamptz` | — | Yes |

Keep `is_active` in sync for backward compatibility: `is_active = (status = 'active')`. This avoids breaking any existing queries during the transition.

### State machine

```
active ──[Visit Other Rooms]──► away   (left_at = null,  is_active = true)
active ──[Exit Game confirm]──► exited (left_at = now(), is_active = false)
away   ──[Rejoin from home]───► active (left_at = null)
exited ──[Rejoin < 2h]────────► active (left_at = null, points preserved)
exited ──[Rejoin ≥ 2h]────────► blocked (locked out, "game expired" shown)
```

---

## 2. Home Screen — Your Rooms Panel

### Component: `YourRoomsPanel`

**Location:** `src/components/home/YourRoomsPanel.tsx`  
Rendered in `WelcomeScreen` above the Create/Join buttons. Hidden when localStorage has no entries.

### Data flow

1. Read localStorage key `europarty_rooms` → array of `{ roomCode, playerId, roomId }`
2. On mount, fire one batched Supabase query:
   ```sql
   SELECT p.id, p.status, p.left_at, p.total_points, p.quiz_points,
          p.pred_points, p.duel_points, r.phase, r.code,
          host.name AS host_name
   FROM players p
   JOIN rooms r ON r.id = p.room_id
   JOIN players host ON host.room_id = r.id AND host.is_host = true
   WHERE p.id = ANY($playerIds)
   ```
3. Derive badge per row (see table below)
4. Show panel; each tappable row navigates to `/room/[code]`

### Badge logic

| Player `status` | `left_at` | Room `phase` | Badge |
|-----------------|-----------|--------------|-------|
| `active` | — | any | `LIVE` (green) |
| `away` | — | any | `AWAY` (yellow) |
| `exited` | < 2h ago | any | `AWAY` (yellow) |
| `exited` | ≥ 2h ago | any | `ENDED` (grey, disabled) |
| any | — | `finished` | `ENDED` (grey, disabled) |

### Row layout

Two lines, no icons:
- Line 1: host's name (bold)
- Line 2: room code · your total points

Panel scrolls internally (`max-height: ~168px`). Fade mask at bottom signals overflow.

---

## 3. Exit Flows

### Shared function: `leaveRoom(mode: 'away' | 'exit')`

In `src/hooks/useRoom.ts`. Replaces the current `leaveRoom()`.

```typescript
async function leaveRoom(mode: 'away' | 'exit'): Promise<void> {
  // 1. Write status to DB
  await supabase.from('players').update({
    status: mode === 'away' ? 'away' : 'exited',
    is_active: mode === 'away',
    left_at: mode === 'exit' ? new Date().toISOString() : null,
  }).eq('id', currentPlayer.id);

  // 2. Remove localStorage entry
  removeRoomSession(currentRoom.code);

  // 3. Tear down Realtime channel
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }

  // 4. Reset store
  reset();

  // 5. Navigate home
  navigate('/');
}
```

### Visit Other Rooms

- **Trigger:** "Visit Other Rooms" CTA in the exit strip
- **Confirmation:** None — instant
- **Effect:** `leaveRoom('away')`
- **Other players see:** leaderboard badge dims to "away"

### Exit Game

- **Trigger:** "Exit Game" CTA → confirmation modal
- **Modal copy:**
  > *"This will remove you from the game. You can rejoin within 2 hours to recover your points. After that, your progress is gone permanently."*
- **Consequences listed in modal:**
  - You'll appear as left to other players
  - Rejoin within 2 hours to recover points
  - After 2 hours, access and points are gone permanently
- **On confirm:** `leaveRoom('exit')`
- **On cancel:** dismiss modal, stay in room

### Exit CTA strip

Rendered at the bottom of the game screen (inside `RoomPage`, visible during all active phases). Two side-by-side buttons:

| Button | Style | Action |
|--------|-------|--------|
| Visit Other Rooms | Yellow, subdued | `leaveRoom('away')` immediately |
| Exit Game | Red, subdued | Open `ExitGameModal` |

Both buttons are **disabled** while `isReconnecting = true`.

---

## 4. Rejoin Flow (bug fix + grace period)

### Fix in `useRejoin.ts`

Replace the current `is_active=true` query with:

```typescript
// Auth-based lookup
const { data: player } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', userId)
  .eq('room_id', roomId)
  .or(`status.in.(active,away),and(status.eq.exited,left_at.gt.${twoHoursAgo})`)
  .maybeSingle();
```

### On successful rejoin

```typescript
await supabase.from('players').update({
  status: 'active',
  is_active: true,
  left_at: null,
  last_seen_at: new Date().toISOString(),
}).eq('id', player.id);
```

### Grace period expiry

If `status = 'exited'` and `left_at ≥ 2h ago`, return `'not-member'` status from `useRejoin` → show "This game has expired" message on the room page instead of the lobby.

---

## 5. Reconnection

### Detection

In `useRoom.ts` `subscribeToRoom()`, handle the `.subscribe()` status callback:

```typescript
.subscribe((status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    setIsReconnecting(true);
  }
  if (status === 'SUBSCRIBED') {
    if (useGameStore.getState().isReconnecting) {
      setIsReconnecting(false);
      catchUpFetch(); // see below
    }
  }
});
```

`isReconnecting` lives in the Zustand store (`useGameStore`).

### Catch-up fetch

Each hook (`useLeaderboard`, `useDuels`, `useNotifications`) exposes a `refetch()` function. `RoomPage` watches `isReconnecting` via `useEffect` and, when it transitions `true → false`, calls all four in parallel:

```typescript
// RoomPage.tsx
const prevReconnecting = useRef(false);
useEffect(() => {
  if (prevReconnecting.current && !isReconnecting) {
    Promise.all([refetchRoom(), refetchPlayers(), refetchDuels(), refetchNotifications()]);
  }
  prevReconnecting.current = isReconnecting;
}, [isReconnecting]);
```

This keeps the catch-up logic in one place without cross-hook coupling.

### Reconnecting banner

Rendered in `AppShell` when `isReconnecting = true`:

```
[● pulsing dot]  Reconnecting… your progress is safe
```

- Yellow background, fixed top position, above all content
- Dismisses automatically on reconnect
- No user action required

---

## 6. Component & File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260422_player_status.sql` | Add `status` enum, `left_at`, keep `is_active` in sync |
| `src/lib/types.ts` | Add `status`, `left_at` to `Player` interface |
| `src/hooks/useRoom.ts` | `leaveRoom(mode)` replaces `leaveRoom()` |
| `src/hooks/useRejoin.ts` | Query fix + grace period logic |
| `src/store/gameStore.ts` | Add `isReconnecting: boolean` |
| `src/components/home/YourRoomsPanel.tsx` | New component |
| `src/components/onboarding/WelcomeScreen.tsx` | Mount `YourRoomsPanel` |
| `src/components/room/ExitGameModal.tsx` | New modal component |
| `src/components/layout/AppShell.tsx` | Add reconnect banner |
| `src/components/layout/Header.tsx` | Remove old leave button (replaced by exit strip) |
| `src/pages/RoomPage.tsx` | Add exit CTA strip |
| `src/locales/en.json` + `el.json` | Add new i18n strings |

---

## 7. Out of Scope

- Push notifications for "player rejoined"
- Server-side cron to clean up exited players after 2h (ghost cleanup script handles this separately)
- Any changes to host behaviour (host leaving/transferring host role)
