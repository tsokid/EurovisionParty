# EuroParty 2026 — Complete Technical Specification

**Version:** 1.0  
**Stack:** React + Vite + TypeScript + Tailwind + Supabase  
**Target:** Eurovision Grand Final, 16 May 2026, Vienna  

---

## 1. Architecture Overview

```
Players (mobile browsers)
        ↓
  React + Vite PWA
        ↓
  Supabase (Postgres + Realtime + Edge Functions)
        ↓
  Results Adapter (pluggable — scraper / API / manual)
```

### Core Design Principles
- **Rooms persist in DB** — host device going offline does not kill the room
- **Quiz is fully async** — no real-time sync needed; each player answers independently
- **Timer is server-validated** — client sends answer + timestamp; server checks against `question_opened_at`
- **Results source is pluggable** — swap scraper/API/manual without touching game logic
- **Host is game master** — controls phase transitions; players are passengers

---

## 2. Game Phases

```
PHASE 1: LOBBY
  Room created → persists indefinitely
  Players join anytime with room code
  Host configures settings

PHASE 2: PRE_NIGHT (days before Grand Final)
  Quiz Rounds 1–3 open for all players
  Each round: 10 questions, async, individually timed
  Duels: async challenge window (accept within phase)
  Intel Market: open for spending

PHASE 3: SHOW_NIGHT (Grand Final evening)
  Host triggers when show begins
  Quiz Round 3 if not completed
  Duels continue
  Predictions: LOCKED for entry (deadline passed)

PHASE 4: PREDICTIONS_OPEN (after last act performs)
  Host triggers "All acts performed"
  Predictions NOW open for player input
  Window: ~30 min while voting happens on TV

PHASE 5: VOTING_LIVE (during results show)
  Predictions locked
  Results being fetched/entered
  Leaderboard updating live

PHASE 6: FINAL
  All results confirmed
  Final scoring complete
  Leaderboard locked — winner declared
```

---

## 3. Complete Supabase Schema

### 3.1 rooms

```sql
CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(6) UNIQUE NOT NULL,       -- e.g. "EUR26"
  host_id       UUID REFERENCES auth.users(id),
  host_name     VARCHAR(50) NOT NULL,
  year          INTEGER NOT NULL DEFAULT 2026,
  phase         VARCHAR(30) NOT NULL DEFAULT 'lobby',
  -- phases: lobby | pre_night | show_night | predictions_open | voting_live | final
  
  -- Settings
  max_players   INTEGER DEFAULT 20,
  quiz_rounds   INTEGER DEFAULT 3,
  duel_limit    INTEGER DEFAULT 3,               -- max duels per player per phase
  
  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT now(),
  phase_updated_at TIMESTAMPTZ DEFAULT now(),
  quiz_opened_at   TIMESTAMPTZ,                  -- when host opened current round
  predictions_opened_at TIMESTAMPTZ,
  predictions_locked_at TIMESTAMPTZ,
  
  -- Results
  results_source VARCHAR(20) DEFAULT 'pending',  -- pending | scraper | api | manual
  results_confirmed BOOLEAN DEFAULT false,
  
  CONSTRAINT valid_phase CHECK (phase IN (
    'lobby','pre_night','show_night',
    'predictions_open','voting_live','final'
  ))
);

-- Index for fast room lookup by code
CREATE INDEX idx_rooms_code ON rooms(code);
```

### 3.2 players

```sql
CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id),  -- nullable (anon players)
  
  -- Identity
  name          VARCHAR(50) NOT NULL,
  avatar_emoji  VARCHAR(10) DEFAULT '🎤',
  country_flag  VARCHAR(10),                     -- optional flag avatar
  
  -- Scores (denormalised for fast leaderboard reads)
  quiz_points   INTEGER DEFAULT 0,
  pred_points   INTEGER DEFAULT 0,
  duel_points   INTEGER DEFAULT 0,              -- can be negative
  points_spent  INTEGER DEFAULT 0,              -- Intel Market spend
  
  -- Computed (updated by trigger)
  total_points  INTEGER GENERATED ALWAYS AS (
    quiz_points + pred_points + duel_points - points_spent
  ) STORED,
  
  -- Status
  is_host       BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,           -- false if player left
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  joined_at     TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(room_id, name)                         -- unique name per room
);

CREATE INDEX idx_players_room ON players(room_id);
CREATE INDEX idx_players_total ON players(room_id, total_points DESC);
```

### 3.3 quiz_rounds

```sql
CREATE TABLE quiz_rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,               -- 1, 2, or 3
  
  -- Question IDs assigned to this round (10 per round)
  question_ids  INTEGER[] NOT NULL,             -- array of 10 question IDs
  
  -- Timing
  opened_at     TIMESTAMPTZ,                    -- when host opened this round
  closes_at     TIMESTAMPTZ,                    -- optional deadline
  
  status        VARCHAR(20) DEFAULT 'pending',  -- pending | open | closed
  
  UNIQUE(room_id, round_number)
);
```

### 3.4 quiz_answers

```sql
CREATE TABLE quiz_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE CASCADE,
  round_number    INTEGER NOT NULL,
  question_id     INTEGER NOT NULL,             -- references question bank
  
  -- Answer data
  answer_index    INTEGER NOT NULL,             -- 0-3 (which option picked)
  is_correct      BOOLEAN NOT NULL,
  
  -- Timing (used for score calculation)
  question_opened_at  TIMESTAMPTZ NOT NULL,     -- copied from quiz_rounds.opened_at
  answered_at         TIMESTAMPTZ NOT NULL,     -- client timestamp (server-validated)
  response_seconds    NUMERIC(5,2),             -- server-calculated diff
  
  -- Score awarded
  points_awarded  INTEGER NOT NULL DEFAULT 0,   -- 100 / 60 / 30 / 0
  
  -- Anti-cheat: server rejects if answered_at > opened_at + 15s
  CONSTRAINT answer_within_window CHECK (
    answered_at <= question_opened_at + interval '16 seconds'
  ),
  
  UNIQUE(player_id, question_id, round_number)  -- one answer per question
);

CREATE INDEX idx_answers_player ON quiz_answers(player_id, round_number);
CREATE INDEX idx_answers_room ON quiz_answers(room_id, question_id);
```

### 3.5 question_assignments

```sql
-- Tracks which questions have been used per room (prevents repeats)
CREATE TABLE question_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  position    INTEGER NOT NULL,                -- 1-10 position within round
  
  UNIQUE(room_id, question_id)                 -- no repeats within a room
);
```

### 3.6 predictions

```sql
CREATE TABLE predictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  
  -- Predictions (stored as ordered arrays of country_ids)
  top5        VARCHAR(5)[] NOT NULL,            -- e.g. ['se','fr','fi','at','gr']
  worst5      VARCHAR(5)[] NOT NULL,            -- e.g. ['de','gb','it','al','cy']
  
  -- Status
  submitted_at    TIMESTAMPTZ DEFAULT now(),
  is_locked       BOOLEAN DEFAULT false,        -- locked when predictions phase ends
  
  -- Scoring (populated after results confirmed)
  top5_points     INTEGER,
  worst5_points   INTEGER,
  total_points    INTEGER GENERATED ALWAYS AS (
    COALESCE(top5_points, 0) + COALESCE(worst5_points, 0)
  ) STORED,
  scored_at       TIMESTAMPTZ,
  
  UNIQUE(room_id, player_id)                   -- one prediction set per player
);
```

### 3.7 duels

```sql
CREATE TABLE duels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Participants
  challenger_id   UUID REFERENCES players(id),
  challenged_id   UUID REFERENCES players(id),
  
  -- The question
  question_id     INTEGER NOT NULL,
  
  -- Status flow: pending → accepted → answered → completed | expired | declined
  status          VARCHAR(20) DEFAULT 'pending',
  
  -- Timing
  created_at      TIMESTAMPTZ DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,                 -- end of current phase
  completed_at    TIMESTAMPTZ,
  
  -- Answers (set independently)
  challenger_answer   INTEGER,                 -- 0-3
  challenger_answered_at TIMESTAMPTZ,
  challenged_answer   INTEGER,                 -- 0-3
  challenged_answered_at TIMESTAMPTZ,
  
  -- Result
  winner_id       UUID REFERENCES players(id),
  loser_id        UUID REFERENCES players(id),
  points_transferred INTEGER DEFAULT 12,
  
  CONSTRAINT no_self_duel CHECK (challenger_id != challenged_id),
  CONSTRAINT valid_status CHECK (status IN (
    'pending','accepted','answered','completed','expired','declined'
  )),
  -- One open duel per pair at a time
  CONSTRAINT one_active_duel UNIQUE NULLS NOT DISTINCT (
    room_id, challenger_id, challenged_id
  )
);

CREATE INDEX idx_duels_challenged ON duels(challenged_id, status);
CREATE INDEX idx_duels_room ON duels(room_id, status);
```

### 3.8 intel_reveals

```sql
CREATE TABLE intel_reveals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  
  reveal_type VARCHAR(20) NOT NULL,            -- top3 | top10 | worst3
  points_cost INTEGER NOT NULL,                -- 50 | 150 | 50
  revealed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(room_id, player_id, reveal_type)      -- can't buy same reveal twice
);
```

### 3.9 results

```sql
CREATE TABLE results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Final rankings (25 finalists)
  final_ranking JSONB NOT NULL,
  -- Format: [{"position": 1, "country_id": "se"}, ...]
  
  -- Source metadata
  source          VARCHAR(20) NOT NULL,        -- scraper | api | manual
  source_url      VARCHAR(500),
  fetched_at      TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    UUID REFERENCES players(id), -- host who confirmed
  
  -- Status
  is_partial      BOOLEAN DEFAULT false,       -- true during live entry
  positions_confirmed INTEGER DEFAULT 0,       -- how many positions entered so far
  
  created_at  TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(room_id)                              -- one result set per room
);
```

### 3.10 notifications

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE, -- recipient
  
  type        VARCHAR(30) NOT NULL,
  -- types: duel_challenge | duel_result | phase_change | predictions_open | results_partial
  
  payload     JSONB DEFAULT '{}',              -- type-specific data
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ                      -- auto-dismiss after this
);

CREATE INDEX idx_notifs_player ON notifications(player_id, is_read, created_at DESC);
```

---

## 4. Question Randomizer Logic

### 4.1 Algorithm

```typescript
// src/lib/questionRandomizer.ts

interface QuestionFilter {
  excludeIds: number[]          // already used in this room
  categories?: string[]         // filter by category
  difficulty?: 'easy' | 'medium' | 'hard'  // filter by difficulty
  count: number                 // how many to pick
}

function selectRoundQuestions(filter: QuestionFilter): Question[] {
  const pool = ALL_QUESTIONS.filter(q =>
    !filter.excludeIds.includes(q.id) &&
    (!filter.categories || filter.categories.includes(q.category)) &&
    (!filter.difficulty || q.difficulty === filter.difficulty)
  )
  
  // Shuffle pool using Fisher-Yates
  const shuffled = fisherYatesShuffle(pool)
  
  // Return first N questions
  return shuffled.slice(0, filter.count)
}
```

### 4.2 Round Composition (per round of 10 questions)

| Category | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| 2026 entries | 1 | 2 | 1 | 4 |
| History | 0 | 1 | 1 | 2 |
| Trivia | 1 | 1 | 0 | 2 |
| Lyrics | 0 | 1 | 0 | 1 |
| Records/Geography/Staging | 0 | 0 | 1 | 1 |
| **Total** | **2** | **5** | **3** | **10** |

### 4.3 No-Repeat Guarantee

```typescript
// When host opens a new round:
async function openRound(roomId: string, roundNumber: number) {
  // 1. Fetch all question IDs already used in this room
  const { data: used } = await supabase
    .from('question_assignments')
    .select('question_id')
    .eq('room_id', roomId)
  
  const usedIds = used.map(u => u.question_id)
  
  // 2. Select 10 new questions following composition rules
  const selected = selectRoundQuestions({
    excludeIds: usedIds,
    count: 10
  })
  
  // 3. Store assignments
  await supabase.from('question_assignments').insert(
    selected.map((q, i) => ({
      room_id: roomId,
      question_id: q.id,
      round_number: roundNumber,
      position: i + 1
    }))
  )
  
  // 4. Open the round
  await supabase.from('quiz_rounds').upsert({
    room_id: roomId,
    round_number: roundNumber,
    question_ids: selected.map(q => q.id),
    opened_at: new Date().toISOString(),
    status: 'open'
  })
}
```

### 4.4 Anti-Cheat: Server Timestamp Validation

```typescript
// Supabase Edge Function: submit-answer
export async function submitAnswer(req: Request) {
  const { playerId, questionId, answerIndex, clientTimestamp } = await req.json()
  
  // Get the round open time from DB
  const { data: round } = await supabase
    .from('quiz_rounds')
    .select('opened_at')
    .eq('room_id', roomId)
    .single()
  
  const openedAt = new Date(round.opened_at)
  const answeredAt = new Date(clientTimestamp)
  const serverNow = new Date()
  
  // Reject if client timestamp is in the future or too far in the past
  if (answeredAt > serverNow || answeredAt < openedAt) {
    // Use server time instead
    answeredAt = serverNow
  }
  
  const responseSeconds = (answeredAt.getTime() - openedAt.getTime()) / 1000
  
  // Cap at 15s
  const cappedSeconds = Math.min(responseSeconds, 15)
  
  // Calculate points
  const points = cappedSeconds <= 5 ? 100
               : cappedSeconds <= 10 ? 60
               : cappedSeconds <= 15 ? 30
               : 0
  
  // Store answer
  await supabase.from('quiz_answers').insert({
    player_id: playerId,
    question_id: questionId,
    answer_index: answerIndex,
    is_correct: isCorrect,
    question_opened_at: round.opened_at,
    answered_at: answeredAt.toISOString(),
    response_seconds: cappedSeconds,
    points_awarded: points
  })
  
  // Update player score
  await supabase.rpc('increment_quiz_points', {
    p_player_id: playerId,
    p_points: points
  })
  
  return { points, responseSeconds: cappedSeconds }
}
```

---

## 5. Predictions Scoring Logic

```typescript
function scorePredictions(
  playerTop5: string[],     // ['se','fr','fi','at','gr']
  playerWorst5: string[],   // ['de','gb','it','al','cy']
  officialTop25: string[]   // full official ranking, position 1 = index 0
): { top5Points: number, worst5Points: number } {
  
  const officialTop5 = officialTop25.slice(0, 5)
  const officialWorst5 = officialTop25.slice(20, 25).reverse() // 25th = worst

  let top5Points = 0
  playerTop5.forEach((countryId, i) => {
    const officialPosition = officialTop5.indexOf(countryId)
    if (officialPosition === i) {
      top5Points += 50   // exact position
    } else if (officialPosition !== -1) {
      top5Points += 20   // in top 5, wrong position
    }
  })
  
  let worst5Points = 0
  playerWorst5.forEach((countryId, i) => {
    const officialPosition = officialWorst5.indexOf(countryId)
    if (officialPosition === i) {
      worst5Points += 30  // exact position
    } else if (officialPosition !== -1) {
      worst5Points += 10  // in worst 5, wrong position
    }
  })
  
  return { top5Points, worst5Points }
  // Max possible: 50*5 + 30*5 = 250 + 150 = 400 pts
}
```

---

## 6. Results Source — Pluggable Adapter

```typescript
// src/lib/resultsAdapter.ts

interface ResultsAdapter {
  fetch(): Promise<RankingResult>
  isAvailable(): Promise<boolean>
}

interface RankingResult {
  ranking: { position: number, country_id: string }[]
  source: string
  fetched_at: string
  is_complete: boolean
  positions_confirmed: number
}

// Adapter 1: Scraper (YOUR SOURCE — URL TBD)
class ScraperAdapter implements ResultsAdapter {
  async fetch(): Promise<RankingResult> {
    const response = await fetch(SCRAPER_ENDPOINT)
    const data = await response.json()
    return this.transform(data)
  }
  private transform(raw: any): RankingResult {
    // Transform raw scraped data to standard format
    // YOU DEFINE THIS when source is confirmed
  }
}

// Adapter 2: Manual fallback (host enters via admin panel)
class ManualAdapter implements ResultsAdapter {
  async fetch(): Promise<RankingResult> {
    const { data } = await supabase
      .from('results')
      .select('final_ranking')
      .eq('room_id', this.roomId)
      .single()
    return data
  }
}

// Factory — tries scraper first, falls back to manual
export async function getResults(roomId: string): Promise<RankingResult> {
  const scraper = new ScraperAdapter()
  
  try {
    if (await scraper.isAvailable()) {
      const result = await scraper.fetch()
      await cacheResults(roomId, result, 'scraper')
      return result
    }
  } catch (e) {
    console.warn('Scraper failed, falling back to manual', e)
  }
  
  return new ManualAdapter(roomId).fetch()
}
```

### Polling Schedule (Grand Final Night)

```typescript
// Supabase Edge Function: poll-results (called on cron)
// During results show: poll every 60 seconds
// After show ends: poll every 5 minutes until confirmed complete

const POLL_SCHEDULE = {
  voting_live:  60,   // seconds between polls
  final:        300,
}
```

---

## 7. Realtime Subscriptions

Only three things need real-time updates — everything else is request/response:

```typescript
// 1. Leaderboard (updates as scores change)
supabase
  .channel('leaderboard')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'players',
    filter: `room_id=eq.${roomId}`
  }, (payload) => updateLeaderboard(payload.new))
  .subscribe()

// 2. Phase changes (host controls game flow)
supabase
  .channel('room-phase')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'rooms',
    filter: `id=eq.${roomId}`
  }, (payload) => handlePhaseChange(payload.new.phase))
  .subscribe()

// 3. Notifications (duel challenges, results updates)
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `player_id=eq.${playerId}`
  }, (payload) => showNotification(payload.new))
  .subscribe()
```

No real-time for quiz answers — they are fire-and-forget to the Edge Function.

---

## 8. Duel Flow (Async)

```
Challenger taps "Challenge Maria"
          ↓
INSERT duel (status: pending, expires_at: end of phase)
INSERT notification for Maria
          ↓
Maria opens app → sees badge "1 pending challenge"
Maria taps "Accept" → duel status: accepted
          ↓
Both players see the SAME question independently
Both answer at their own pace (within 15s timer)
          ↓
Edge Function: resolve_duel()
  - Compare: was each answer correct?
  - If one correct, one wrong → correct player wins
  - If both correct → faster response_seconds wins
  - If both wrong → no points transferred (draw)
  - If one never answered → other player wins by default
          ↓
UPDATE duel (status: completed, winner_id, loser_id)
UPDATE winner quiz_points += 12 (or duel_points)
UPDATE loser duel_points -= 12
INSERT notifications for both players with result
```

---

## 9. Row Level Security (RLS)

```sql
-- Players can only see their own room
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_own_room" ON players
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- Answers are private — player sees only their own
CREATE POLICY "answers_own" ON quiz_answers
  FOR SELECT USING (player_id IN (
    SELECT id FROM players WHERE user_id = auth.uid()
  ));

-- Results are visible to all players in the room
CREATE POLICY "results_room" ON results
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );
```

---

## 10. Question Bank Summary

| Category | Count | Notes |
|---|---|---|
| 2026 entries | 85 | All confirmed artists/songs |
| History | 117 | All-time Eurovision history |
| Trivia | 76 | Format, rules, broadcasters |
| Records | 47 | Records and statistics |
| Geography | 42 | Host cities and countries |
| Lyrics | 53 | Complete-the-lyric format |
| Staging | 36 | Iconic performances |
| **TOTAL** | **500** | IDs 1–500, no gaps |

Difficulty split: Easy 157 / Medium 202 / Hard 141

### Growth Plan

| Year | New Questions | Bank Size |
|---|---|---|
| 2026 | — | 500 |
| 2027 | +30 | 530 |
| 2028 | +30 | 560 |
| 2029 | +30 | 590 |
| 2030 | +30 | 620 |

---

## 11. Scoring Summary

| Action | Points |
|---|---|
| Quiz answer, 0–5s | 100 |
| Quiz answer, 5–10s | 60 |
| Quiz answer, 10–15s | 30 |
| Quiz answer, >15s or wrong | 0 |
| Prediction: exact position (top5) | 50 |
| Prediction: in top5 wrong position | 20 |
| Prediction: exact position (worst5) | 30 |
| Prediction: in worst5 wrong position | 10 |
| Duel win | +12 |
| Duel loss | -12 |
| Intel Market: Top 3 | -50 |
| Intel Market: Top 10 | -150 |
| Intel Market: Worst 3 | -50 |
| **Max possible (all 3 rounds + predictions)** | **3,400** |

---

## 12. Build Priority Order

### Phase 1 — Foundation (build first)
1. Supabase project + schema migration
2. Room creation + join by code
3. Player auth (anonymous, just name + emoji)
4. Phase management (host controls)

### Phase 2 — Quiz Engine
5. Question bank loaded to Supabase
6. Question randomizer + round assignment
7. Quiz UI (answer buttons + local timer)
8. Server-side answer validation Edge Function
9. Score update + leaderboard

### Phase 3 — Predictions
10. Predictions UI (top5 + worst5 picker)
11. Phase-locked submission
12. Scoring engine
13. Results adapter (manual first, scraper when source confirmed)

### Phase 4 — Social
14. Duel challenge + notification system
15. Intel Market
16. Final leaderboard + winner screen

### Phase 5 — Polish
17. PWA manifest + home screen install
18. iOS Safari reconnect handling
19. Results scraper (when source confirmed by you)
20. Yearly update script

---

## 13. Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Edge Functions only
RESULTS_SCRAPER_URL=            # TBD — you'll provide this
RESULTS_API_KEY=                # TBD — if needed
```
