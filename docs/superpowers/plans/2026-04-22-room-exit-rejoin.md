# Room Exit, Rejoin & Reconnection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Visit Other Rooms" (soft exit), "Exit Game" (abandon with 2h grace period), auto-reconnection with catch-up, and a "Your Rooms" panel on the home screen.

**Architecture:** A new `status` enum (`active | away | exited`) on the `players` table drives all state transitions; a DB trigger keeps `is_active` in sync for backward compatibility. The exit flows share a single `leaveRoom(mode)` function. The reconnect banner reads from a new `isReconnecting` flag in the Zustand store, which each hook's status callback writes to.

**Tech Stack:** React, TypeScript, Supabase (PostgreSQL + Realtime), Zustand, Tailwind CSS, react-i18next

**Spec:** `docs/superpowers/specs/2026-04-22-room-exit-rejoin-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/015_player_status.sql` | Add `status` enum, `left_at`, sync trigger |
| Modify | `src/lib/types.ts` | Add `status`, `left_at` to `Player` |
| Modify | `src/stores/gameStore.ts` | Add `isReconnecting` flag |
| Modify | `src/hooks/useRejoin.ts` | Fix query + grace period logic + clear status on rejoin |
| Modify | `src/hooks/useRoom.ts` | `leaveRoom(mode)`, reconnect detection, expose `refetchRoom` |
| Modify | `src/hooks/useLeaderboard.ts` | Expose `refetchPlayers`, update filter for `away` players |
| Modify | `src/hooks/useNotifications.ts` | Expose `refetchNotifications` |
| Modify | `src/hooks/useDuels.ts` | Expose `refetchDuels` |
| Create | `src/components/home/YourRoomsPanel.tsx` | Home screen rooms list |
| Modify | `src/components/onboarding/WelcomeScreen.tsx` | Mount `YourRoomsPanel` |
| Create | `src/components/room/ExitGameModal.tsx` | Abandon confirmation modal |
| Modify | `src/components/layout/AppShell.tsx` | Reconnect banner |
| Modify | `src/components/layout/Header.tsx` | Replace single leave button with two exit options |
| Modify | `src/pages/RoomPage.tsx` | Catch-up fetch on reconnect |
| Modify | `src/i18n/locales/en.json` | New strings |
| Modify | `src/i18n/locales/el.json` | New strings (Greek) |

---

## Task 1: DB Migration — player status enum

**Files:**
- Create: `supabase/migrations/015_player_status.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/015_player_status.sql

-- 1. Create the enum type
CREATE TYPE player_status AS ENUM ('active', 'away', 'exited');

-- 2. Add status column (defaults active for all existing rows)
ALTER TABLE players
  ADD COLUMN status player_status NOT NULL DEFAULT 'active',
  ADD COLUMN left_at TIMESTAMPTZ;

-- 3. Backfill: rows that were inactive before this migration → exited
UPDATE players SET status = 'exited' WHERE is_active = false;

-- 4. Trigger: keep is_active in sync with status automatically
--    active  → is_active = true
--    away    → is_active = true  (still participates in game)
--    exited  → is_active = false
CREATE OR REPLACE FUNCTION sync_player_is_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_active := (NEW.status IN ('active', 'away'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_player_is_active
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION sync_player_is_active();
```

- [ ] **Step 2: Apply migration via Supabase dashboard or CLI**

```bash
# If using Supabase CLI:
npx supabase db push
# Or paste the SQL into the Supabase dashboard SQL editor and run it.
```

Expected: no errors, `players` table now has `status` and `left_at` columns.

- [ ] **Step 3: Verify in Supabase dashboard**

Open Table Editor → `players`. Confirm:
- `status` column exists, type `player_status`, all rows show `'active'`
- `left_at` column exists, nullable, all rows show `null`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_player_status.sql
git commit -m "feat: add player status enum and left_at for exit/rejoin flow"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts:64-81`

- [ ] **Step 1: Add `status` and `left_at` to the Player interface**

In `src/lib/types.ts`, find the `Player` interface and replace it with:

```typescript
export interface Player {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  avatar_emoji: string;
  country_flag: string | null;
  quiz_points: number;
  pred_points: number;
  duel_points: number;
  points_spent: number;
  total_points: number;
  is_host: boolean;
  is_active: boolean;
  status: 'active' | 'away' | 'exited';
  left_at: string | null;
  decline_count: number;
  last_seen_at: string | null;
  joined_at: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new type errors from this change.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add status and left_at fields to Player type"
```

---

## Task 3: Add `isReconnecting` to Zustand store

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add `isReconnecting` state and action**

In `src/stores/gameStore.ts`, add to the `GameState` interface:

```typescript
interface GameState {
  // existing fields...
  isReconnecting: boolean;

  // existing actions...
  setIsReconnecting: (v: boolean) => void;
}
```

Add to `initialState`:
```typescript
const initialState = {
  // existing...
  isReconnecting: false,
};
```

Add to the `create` call (after `setError`):
```typescript
setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add isReconnecting flag to game store"
```

---

## Task 4: Fix `useRejoin` — status query + grace period + rejoin activation

**Files:**
- Modify: `src/hooks/useRejoin.ts`

- [ ] **Step 1: Add `'expired'` to `RejoinStatus` and update the query**

Replace the entire `src/hooks/useRejoin.ts` with:

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getRoomSession } from './useRoom';
import type { Room, Player } from '../lib/types';

export type RejoinStatus =
  | 'loading'
  | 'ready'       // store already had room+player
  | 'rejoined'    // successfully restored from DB
  | 'no-auth'     // no anonymous session
  | 'no-room'     // room code doesn't exist
  | 'not-member'  // user has no player record in this room
  | 'expired';    // player exited and 2h grace period has passed

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function twoHoursAgoISO(): string {
  return new Date(Date.now() - TWO_HOURS_MS).toISOString();
}

export function useRejoin(roomCode: string | undefined) {
  const [status, setStatus] = useState<RejoinStatus>('loading');
  const attempted = useRef(false);
  const { room, player, setRoom, setPlayer } = useGameStore();

  useEffect(() => {
    if (room && player) {
      setStatus('ready');
      return;
    }

    if (attempted.current) return;
    if (!roomCode) {
      setStatus('no-room');
      return;
    }

    attempted.current = true;

    async function tryRejoin() {
      try {
        // 1. Look up room by code
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode!.toUpperCase())
          .single();

        if (roomErr || !roomData) {
          setStatus('no-room');
          return;
        }

        const cutoff = twoHoursAgoISO();

        // 2. Try auth-based lookup first
        const { data: { user } } = await supabase.auth.getUser();
        let playerData: Player | null = null;

        if (user) {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id)
            .eq('user_id', user.id)
            .or(`status.in.(active,away),and(status.eq.exited,left_at.gt.${cutoff})`)
            .maybeSingle();

          playerData = data as Player | null;
        }

        // 3. Fallback: localStorage session
        if (!playerData) {
          const saved = getRoomSession(roomCode!);
          if (saved?.playerId) {
            const { data } = await supabase
              .from('players')
              .select('*')
              .eq('id', saved.playerId)
              .eq('room_id', roomData.id)
              .or(`status.in.(active,away),and(status.eq.exited,left_at.gt.${cutoff})`)
              .maybeSingle();

            playerData = data as Player | null;

            if (playerData && user && playerData.user_id !== user.id) {
              await supabase
                .from('players')
                .update({ user_id: user.id })
                .eq('id', playerData.id);
              playerData.user_id = user.id;
            }
          }
        }

        if (!playerData) {
          // Check if they existed but their grace period expired
          if (user) {
            const { data: expired } = await supabase
              .from('players')
              .select('id, status, left_at')
              .eq('room_id', roomData.id)
              .eq('user_id', user.id)
              .eq('status', 'exited')
              .maybeSingle();

            if (expired) {
              setStatus('expired');
              return;
            }
          }

          setStatus('not-member');
          return;
        }

        // 4. Restore player to active
        await supabase
          .from('players')
          .update({
            status: 'active',
            left_at: null,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', playerData.id);

        playerData.status = 'active';
        playerData.left_at = null;

        // 5. Hydrate store
        setRoom(roomData as Room);
        setPlayer(playerData);

        setStatus('rejoined');
      } catch (err) {
        console.error('Rejoin failed:', err);
        setStatus('not-member');
      }
    }

    tryRejoin();
  }, [roomCode, room, player, setRoom, setPlayer]);

  return { status };
}
```

- [ ] **Step 2: Handle `'expired'` in RoomPage**

In `src/pages/RoomPage.tsx`, update the rejoin status effect (around line 79):

```typescript
useEffect(() => {
  if (rejoinStatus === 'no-auth' || rejoinStatus === 'no-room') {
    navigate('/', { replace: true });
  } else if (rejoinStatus === 'not-member') {
    navigate(`/?join=${roomCode}`, { replace: true });
  } else if (rejoinStatus === 'expired') {
    navigate('/', { replace: true });
  }
}, [rejoinStatus, roomCode, navigate]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

1. Join a room, then open Supabase dashboard and manually set a player's `status = 'exited'` and `left_at = now() - interval '3 hours'`.
2. Refresh the room page — should redirect to `/`.
3. Set `left_at = now() - interval '30 minutes'` — refresh again, should rejoin successfully.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRejoin.ts src/pages/RoomPage.tsx
git commit -m "fix: useRejoin uses status enum + 2h grace period instead of is_active"
```

---

## Task 5: Update `useRoom` — `leaveRoom(mode)` + reconnect detection + `refetchRoom`

**Files:**
- Modify: `src/hooks/useRoom.ts`

- [ ] **Step 1: Update `UseRoomReturn` interface**

Find the `interface UseRoomReturn` (around line 48) and replace it:

```typescript
interface UseRoomReturn {
  room: Room | null;
  createRoom: (hostName: string, emoji: string, password: string) => Promise<string>;
  joinRoom: (code: string, name: string, emoji: string, password: string) => Promise<Room>;
  advancePhase: (roomId: string) => Promise<void>;
  leaveRoom: (mode?: 'away' | 'exit') => Promise<void>;
  refetchRoom: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
```

- [ ] **Step 2: Replace `leaveRoom` implementation**

Find the `leaveRoom` callback (lines 322–356) and replace it:

```typescript
const leaveRoom = useCallback(
  async (mode: 'away' | 'exit' = 'away'): Promise<void> => {
    const { room: currentRoom, player: currentPlayer, reset } = useGameStore.getState();
    if (!currentRoom || !currentPlayer) return;

    try {
      await supabase
        .from('players')
        .update({
          status: mode === 'away' ? 'away' : 'exited',
          left_at: mode === 'exit' ? new Date().toISOString() : null,
        })
        .eq('id', currentPlayer.id);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      subscribedRoomIdRef.current = null;

      reset();
    } catch (err) {
      console.error('[useRoom] leaveRoom failed:', err);
    }
  },
  []
);
```

Note: localStorage is intentionally NOT cleared — the entry stays so `YourRoomsPanel` can show the room with AWAY/ENDED badge.

- [ ] **Step 3: Add `refetchRoom`**

Add this callback after `leaveRoom`:

```typescript
const refetchRoom = useCallback(async (): Promise<void> => {
  const { room: currentRoom } = useGameStore.getState();
  if (!currentRoom) return;
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', currentRoom.id)
    .single();
  if (data) setRoom(data as Room);
}, [setRoom]);
```

- [ ] **Step 4: Add reconnect detection to `subscribeToRoom`**

Replace the `.subscribe()` callback inside `subscribeToRoom` (around line 90):

```typescript
.subscribe((status, err) => {
  if (err) console.error('[useRoom] Realtime error:', status, err);
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    useGameStore.getState().setIsReconnecting(true);
  }
  if (status === 'SUBSCRIBED') {
    if (useGameStore.getState().isReconnecting) {
      useGameStore.getState().setIsReconnecting(false);
    }
  }
});
```

- [ ] **Step 5: Export `refetchRoom` from the hook return**

Find the return statement at the end of `useRoom` (line 358) and update it:

```typescript
return { room, createRoom, joinRoom, advancePhase, leaveRoom, refetchRoom, isLoading, error };
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRoom.ts
git commit -m "feat: leaveRoom(mode), reconnect detection, refetchRoom"
```

---

## Task 6: Expose `refetchPlayers` from `useLeaderboard`

**Files:**
- Modify: `src/hooks/useLeaderboard.ts`

- [ ] **Step 1: Update `UseLeaderboardReturn` interface**

Find `interface UseLeaderboardReturn` and replace it:

```typescript
interface UseLeaderboardReturn {
  players: Player[];
  isLoading: boolean;
  refetchPlayers: () => Promise<void>;
}
```

- [ ] **Step 2: Expose `fetchPlayers` as `refetchPlayers` in return value**

Find the return statement in `useLeaderboard` and update it:

```typescript
return { players, isLoading, refetchPlayers: fetchPlayers };
```

(`fetchPlayers` already exists as a `useCallback` in the hook — we're just exposing it.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLeaderboard.ts
git commit -m "feat: expose refetchPlayers from useLeaderboard"
```

---

## Task 7: Expose `refetchNotifications` from `useNotifications`

**Files:**
- Modify: `src/hooks/useNotifications.ts`

- [ ] **Step 1: Update `UseNotificationsReturn` interface**

Find `interface UseNotificationsReturn` and add `refetchNotifications`:

```typescript
interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetchNotifications: () => Promise<void>;
}
```

- [ ] **Step 2: Add `refetchNotifications` callback**

Add this inside `useNotifications`, after the existing fetch `useEffect`:

```typescript
const refetchNotifications = useCallback(async () => {
  if (!playerId) return;
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (data) {
    for (const n of data) addNotification(n as Notification);
  }
}, [playerId, addNotification]);
```

- [ ] **Step 3: Add to return value**

Find the return statement in `useNotifications` and add `refetchNotifications`:

```typescript
return { notifications, unreadCount, markAsRead, markAllRead, refetchNotifications };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNotifications.ts
git commit -m "feat: expose refetchNotifications from useNotifications"
```

---

## Task 8: Expose `refetchDuels` from `useDuels`

**Files:**
- Modify: `src/hooks/useDuels.ts`

- [ ] **Step 1: Update `UseDuelsReturn` interface**

Find `interface UseDuelsReturn` and add:

```typescript
refetchDuels: () => Promise<void>;
```

- [ ] **Step 2: Add `refetchDuels` callback**

Add this inside `useDuels` after the existing `useEffect` for the subscription:

```typescript
const refetchDuels = useCallback(async (): Promise<void> => {
  if (!roomId) return;
  const { data } = await supabase
    .from('duels')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (data) setDuels(data as Duel[]);
}, [roomId]);
```

- [ ] **Step 3: Add to return value**

Find the return statement in `useDuels` and add `refetchDuels`:

```typescript
return {
  duels, pendingDuels, activeDuels, pendingDecisions,
  createDuel, acceptDuel, declineDuel, submitDuelAnswers,
  makeDecision, requestRematch, fetchPlayerDuels,
  refetchDuels,
  isLoading, error,
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDuels.ts
git commit -m "feat: expose refetchDuels from useDuels"
```

---

## Task 9: Add i18n strings

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/el.json`

- [ ] **Step 1: Add strings to `en.json`**

Open `src/i18n/locales/en.json`. Find the `"header"` section and add a new top-level `"exitStrip"` key, plus `"exitModal"`, `"reconnect"`, and `"yourRooms"` sections anywhere in the file (keep alphabetical order if the file uses it):

```json
"exitStrip": {
  "visitOtherRooms": "💤 Visit Other Rooms",
  "exitGame": "🚪 Exit Game"
},
"exitModal": {
  "title": "Exit Game?",
  "body": "This will remove you from the game. You can rejoin within 2 hours to recover your points. After that, your progress is gone permanently.",
  "warn1": "You'll appear as left to other players",
  "warn2": "You can rejoin within 2 hours to recover your points",
  "warn3": "After 2 hours, access and points are gone forever",
  "confirm": "Yes, Exit Game",
  "cancel": "Cancel — Stay in Room"
},
"reconnect": {
  "banner": "Reconnecting… your progress is safe"
},
"yourRooms": {
  "title": "Your Rooms"
}
```

- [ ] **Step 2: Add strings to `el.json`**

Add the same keys to `src/i18n/locales/el.json`:

```json
"exitStrip": {
  "visitOtherRooms": "💤 Επίσκεψη Άλλου Δωματίου",
  "exitGame": "🚪 Έξοδος"
},
"exitModal": {
  "title": "Έξοδος από το παιχνίδι;",
  "body": "Θα αφαιρεθείς από το παιχνίδι. Μπορείς να επιστρέψεις εντός 2 ωρών για να ανακτήσεις τους πόντους σου. Μετά χάνονται οριστικά.",
  "warn1": "Θα φανείς ως αποχωρήσας στους άλλους",
  "warn2": "Επίστρεψε εντός 2 ωρών για να ανακτήσεις τους πόντους",
  "warn3": "Μετά από 2 ώρες, η πρόσβαση και οι πόντοι χάνονται",
  "confirm": "Ναι, Αποχώρηση",
  "cancel": "Άκυρο — Παραμένω"
},
"reconnect": {
  "banner": "Επανασύνδεση… η πρόοδός σου είναι ασφαλής"
},
"yourRooms": {
  "title": "Τα Δωμάτιά σου"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/el.json
git commit -m "feat: add i18n strings for exit, reconnect, and your rooms"
```

---

## Task 10: `YourRoomsPanel` component + wire into `WelcomeScreen`

**Files:**
- Create: `src/components/home/YourRoomsPanel.tsx`
- Modify: `src/components/onboarding/WelcomeScreen.tsx`

- [ ] **Step 1: Create `YourRoomsPanel.tsx`**

Create `src/components/home/YourRoomsPanel.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'europarty_rooms';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface RoomEntry {
  playerId: string;
  roomCode: string;
  hostName: string;
  totalPoints: number;
  status: 'active' | 'away' | 'exited';
  leftAt: string | null;
  phase: string;
}

type Badge = 'LIVE' | 'AWAY' | 'ENDED';

function getBadge(entry: RoomEntry): Badge {
  if (entry.phase === 'finished') return 'ENDED';
  if (entry.status === 'active') return 'LIVE';
  if (entry.status === 'away') return 'AWAY';
  // exited — check grace period
  if (entry.leftAt && Date.now() - new Date(entry.leftAt).getTime() < TWO_HOURS_MS) return 'AWAY';
  return 'ENDED';
}

const badgeClass: Record<Badge, string> = {
  LIVE: 'bg-green-400/20 text-green-400 border border-green-400/30',
  AWAY: 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/25',
  ENDED: 'bg-white/5 text-white/30 border border-white/10',
};

export default function YourRoomsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);

  useEffect(() => {
    async function load() {
      let stored: Record<string, { playerId: string }>;
      try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch {
        return;
      }

      const playerIds = Object.values(stored).map((v) => v.playerId);
      if (!playerIds.length) return;

      const { data } = await supabase
        .from('players')
        .select('id, status, left_at, total_points, rooms!inner(code, phase, host_name)')
        .in('id', playerIds);

      if (!data?.length) return;

      const entries: RoomEntry[] = (data as any[]).map((p) => ({
        playerId: p.id,
        roomCode: p.rooms.code,
        hostName: p.rooms.host_name,
        totalPoints: p.total_points,
        status: p.status,
        leftAt: p.left_at,
        phase: p.rooms.phase,
      }));

      // Sort: LIVE → AWAY → ENDED
      const order: Record<Badge, number> = { LIVE: 0, AWAY: 1, ENDED: 2 };
      entries.sort((a, b) => order[getBadge(a)] - order[getBadge(b)]);

      setRooms(entries);
    }

    load();
  }, []);

  if (!rooms.length) return null;

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 mb-4">
      <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2">
        {t('yourRooms.title')}
      </p>
      <div
        className="max-h-44 overflow-y-auto flex flex-col gap-1.5"
        style={{
          maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
      >
        {rooms.map((entry) => {
          const badge = getBadge(entry);
          const tappable = badge !== 'ENDED';
          return (
            <button
              key={entry.playerId}
              disabled={!tappable}
              onClick={() => tappable && navigate(`/room/${entry.roomCode}`)}
              className={`flex items-center gap-2 p-2 rounded-xl border text-left w-full transition-colors
                ${tappable
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
                  : 'bg-white/[0.03] border-white/5 cursor-default opacity-50'
                }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">
                  {entry.hostName}'s Room
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {entry.roomCode} · {entry.totalPoints} pts
                </p>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass[badge]}`}>
                {badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount `YourRoomsPanel` in `WelcomeScreen`**

In `src/components/onboarding/WelcomeScreen.tsx`:

Add the import at the top:
```tsx
import YourRoomsPanel from '../home/YourRoomsPanel';
```

Inside the JSX, add `<YourRoomsPanel />` directly above the action buttons block (the `<motion.div>` containing Create/Join buttons):

```tsx
{/* Your Rooms — shown when user has prior rooms in localStorage */}
<YourRoomsPanel />

<motion.div
  className="flex flex-col gap-3 w-full max-w-sm"
  // ...existing props
>
```

- [ ] **Step 3: Manual verification**

1. `npm run dev`, open the app in the browser.
2. Create and join a room, then navigate home via the browser back button (don't use leaveRoom yet).
3. The home screen should show "Your Rooms" panel with your room and a LIVE badge.
4. Click the row — should navigate back to the room.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/YourRoomsPanel.tsx src/components/onboarding/WelcomeScreen.tsx
git commit -m "feat: add YourRoomsPanel to home screen"
```

---

## Task 11: `ExitGameModal` component

**Files:**
- Create: `src/components/room/ExitGameModal.tsx`

- [ ] **Step 1: Create the modal**

Create `src/components/room/ExitGameModal.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

interface ExitGameModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExitGameModal({ onConfirm, onCancel }: ExitGameModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-6 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-gradient-to-b from-[#1e0e3e] to-[#130828] border border-red-500/25 rounded-3xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-white/15 rounded-full mx-auto mb-5" />
        <div className="text-4xl text-center mb-3">🚪</div>
        <h2 className="text-lg font-black text-white text-center mb-2">
          {t('exitModal.title')}
        </h2>
        <p className="text-[13px] text-white/55 text-center leading-relaxed mb-5">
          {t('exitModal.body')}
        </p>
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 mb-5 space-y-2">
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn1')}</p>
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn2')}</p>
          <p className="text-[12px] text-white/50">❌ {t('exitModal.warn3')}</p>
        </div>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-extrabold text-sm mb-2 shadow-[0_4px_20px_rgba(220,38,38,0.35)]"
        >
          {t('exitModal.confirm')}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl bg-white/6 border border-white/10 text-white/55 font-bold text-[13px]"
        >
          {t('exitModal.cancel')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/room/ExitGameModal.tsx
git commit -m "feat: add ExitGameModal component"
```

---

## Task 12: Reconnect banner in `AppShell`

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add reconnect banner**

Replace the entire `src/components/layout/AppShell.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../stores/gameStore';
import Header from './Header';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
  showHeader?: boolean;
  showNav?: boolean;
}

export default function AppShell({
  children,
  showHeader = true,
  showNav = true,
}: AppShellProps) {
  const { t } = useTranslation();
  const isReconnecting = useGameStore((s) => s.isReconnecting);

  return (
    <div className="min-h-svh bg-euro-gradient flex flex-col">
      {isReconnecting && (
        <div className="fixed top-3 left-3 right-3 z-50 flex items-center gap-2 bg-yellow-400/15 border border-yellow-400/40 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-yellow-400">
            {t('reconnect.banner')}
          </span>
        </div>
      )}

      {showHeader && <Header />}

      <main className="flex-1 overflow-y-auto">{children}</main>

      {showNav && <BottomNav />}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

1. Run `npm run dev`, join a room.
2. In Supabase dashboard, temporarily pause the realtime connection (or use browser DevTools → Network → set to Offline for 5s then back).
3. The yellow "Reconnecting…" banner should appear, then disappear when connection restores.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: add reconnect banner to AppShell"
```

---

## Task 13: Update `Header` — replace leave button with two exit options

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add `showExitModal` state and import `ExitGameModal`**

Add to the imports at the top of `src/components/layout/Header.tsx`:

```tsx
import ExitGameModal from '../room/ExitGameModal';
```

Add to the state declarations inside the `Header` component (after the existing `useState` calls):

```tsx
const [showExitModal, setShowExitModal] = useState(false);
```

- [ ] **Step 2: Replace the leave button with two exit buttons**

Find the leave button block (lines ~175–186):

```tsx
{/* Leave room */}
<button
  onClick={async () => {
    if (window.confirm(t('header.leaveConfirm'))) {
      await leaveRoom();
      navigate('/', { replace: true });
    }
  }}
  className="w-full mt-3 text-xs text-euro-red/60 hover:text-euro-red text-center py-2 rounded-lg hover:bg-euro-red/10 transition-colors"
>
  {t('header.leaveRoom')}
</button>
```

Replace it with:

```tsx
{/* Exit options */}
<div className="mt-3 flex gap-2">
  <button
    onClick={async () => {
      setShowPhaseMenu(false);
      await leaveRoom('away');
      navigate('/', { replace: true });
    }}
    className="flex-1 text-xs text-yellow-400/70 hover:text-yellow-400 text-center py-2 rounded-lg hover:bg-yellow-400/10 transition-colors border border-yellow-400/20"
  >
    {t('exitStrip.visitOtherRooms')}
  </button>
  <button
    onClick={() => setShowExitModal(true)}
    className="flex-1 text-xs text-euro-red/60 hover:text-euro-red text-center py-2 rounded-lg hover:bg-euro-red/10 transition-colors border border-euro-red/20"
  >
    {t('exitStrip.exitGame')}
  </button>
</div>
```

- [ ] **Step 3: Render `ExitGameModal` when `showExitModal` is true**

Add just before the closing `</>` of the Header return (or at the bottom of the component, outside the phase menu):

```tsx
{showExitModal && (
  <ExitGameModal
    onConfirm={async () => {
      setShowExitModal(false);
      setShowPhaseMenu(false);
      await leaveRoom('exit');
      navigate('/', { replace: true });
    }}
    onCancel={() => setShowExitModal(false)}
  />
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

1. `npm run dev`, join a room, open the phase dropdown in the header.
2. Confirm two buttons appear: "💤 Visit Other Rooms" and "🚪 Exit Game".
3. Click "Visit Other Rooms" — should navigate home. On home, room should show with AWAY badge in Your Rooms panel.
4. Rejoin the room, open phase dropdown again, click "Exit Game" — modal should appear.
5. Click "Yes, Exit Game" — should navigate home. Room shows with AWAY badge (within 2h grace period).
6. Navigate back to the room URL directly — should rejoin successfully (points restored).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: replace single leave button with Visit Other Rooms + Exit Game in header"
```

---

## Task 14: Catch-up fetch in `RoomPage` on reconnect

**Files:**
- Modify: `src/pages/RoomPage.tsx`

- [ ] **Step 1: Destructure new refetch functions from hooks**

In `src/pages/RoomPage.tsx`, update the hook call lines:

```tsx
// Replace:
const { room, advancePhase } = useRoom();
// With:
const { room, advancePhase, refetchRoom } = useRoom();

// Replace:
useLeaderboard(roomId);
// With:
const { refetchPlayers } = useLeaderboard(roomId);

// Replace:
useNotifications(playerId);
// With:
const { refetchNotifications } = useNotifications(playerId);
```

Add `useDuels` import and call (currently `RoomPage` does not call `useDuels` directly — duels are called inside `DuelsScreen`). We only need `refetchDuels` for catch-up, not the full hook. Skip this for `useDuels` — the `DuelsScreen` component will re-subscribe on its own when the Realtime channel reconnects. Remove `refetchDuels` from the catch-up list.

- [ ] **Step 2: Add the catch-up fetch `useEffect`**

Add the following `useRef` and `useEffect` inside `RoomPage`, after the existing polling fallback effect:

```tsx
// Catch-up fetch: when reconnecting transitions true→false, refetch all state
const isReconnecting = useGameStore((s) => s.isReconnecting);
const prevReconnectingRef = useRef(false);
useEffect(() => {
  if (prevReconnectingRef.current && !isReconnecting) {
    Promise.all([refetchRoom(), refetchPlayers(), refetchNotifications()]);
  }
  prevReconnectingRef.current = isReconnecting;
}, [isReconnecting, refetchRoom, refetchPlayers, refetchNotifications]);
```

- [ ] **Step 3: Add `useRef` to imports if not already present**

`useRef` is already imported in `RoomPage.tsx` (line 1). Nothing to add.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

1. Join a room.
2. In browser DevTools → Network tab → set Throttling to "Offline" for 3 seconds, then back to "Online".
3. The reconnect banner should appear and disappear.
4. The room state (players list, room phase) should be up to date after reconnect.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RoomPage.tsx
git commit -m "feat: catch-up fetch on reconnect in RoomPage"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Task 1: DB migration (`status`, `left_at`, trigger)
- ✅ Task 4: Rejoin bug fix + grace period
- ✅ Task 5: `leaveRoom('away')` / `leaveRoom('exit')`
- ✅ Task 10: `YourRoomsPanel` with LIVE/AWAY/ENDED badges
- ✅ Task 11: `ExitGameModal` with 2h warning copy
- ✅ Task 12: Reconnect banner
- ✅ Task 13: Two exit CTAs replacing old leave button
- ✅ Task 14: Catch-up fetch on reconnect
- ✅ Tasks 6–8: `refetchPlayers`, `refetchNotifications`, `refetchDuels` exposed

**Type consistency:**
- `leaveRoom(mode?: 'away' | 'exit')` — used consistently in Tasks 5 and 13
- `RejoinStatus` union updated with `'expired'` in Task 4, handled in `RoomPage` in same task
- `refetchRoom`, `refetchPlayers`, `refetchNotifications` — defined in Tasks 5–7, consumed in Task 14
- `Player.status` and `Player.left_at` — defined in Task 2, used in Tasks 4, 5, 10
