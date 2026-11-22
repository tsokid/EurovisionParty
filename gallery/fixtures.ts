// gallery/fixtures.ts
// Fake data for the design gallery. Shapes mirror src/lib/types.ts and the
// column lists the screens select. The 2026 grand-final line-up (ISO codes,
// artists, songs, final places and points) comes from the content-live-hub
// test fixture so it matches the real published results.

import type {
  Room, Player, Prediction, Duel, DuelAnswer, QuizAnswer, Notification, RoomPhase,
} from '../src/lib/types';
import type { WinnerRow } from '../src/lib/winners';
import { QUESTIONS } from '../src/lib/questions';
import contest2026 from '../tests/fixtures/content-live-hub/contests/2026.json';
import contest2025 from '../tests/fixtures/content-live-hub/contests/2025.json';
import { scorePredictions } from '../src/lib/scoringEngine';

const ROOM_ID = 'room-design';
const NOW = Date.now();
const iso = (minsAgo: number) => new Date(NOW - minsAgo * 60_000).toISOString();

// ── Room ─────────────────────────────────────────────────────────────
export function makeRoom(phase: RoomPhase, year = 2026): Room {
  return {
    id: ROOM_ID,
    code: 'DESIGN',
    host_id: 'user-me',
    host_name: 'Ελένη',
    year,
    phase,
    max_players: 20,
    quiz_rounds: 3,
    duel_limit: 10,
    created_at: iso(180),
    phase_updated_at: iso(20),
    quiz_opened_at: iso(150),
    predictions_opened_at: phase === 'lobby' || phase === 'pre_night' ? null : iso(60),
    predictions_locked_at: phase === 'voting_live' || phase === 'final' ? iso(25) : null,
    results_source: phase === 'final' ? 'eurovision.com' : 'pending',
    results_confirmed: phase === 'final',
    last_activity_at: iso(1),
  };
}

export const ROOM_PASSWORD = 'douze';

/** The live room row the fake DB serves (gallery phase flips update it). */
export const ROOM_ROW_REF: { current: Room | null } = { current: null };

// ── Players ──────────────────────────────────────────────────────────
function player(
  id: string, name: string, emoji: string, quiz: number, pred: number, duel: number, extra: Partial<Player> = {},
): Player {
  return {
    id,
    room_id: ROOM_ID,
    user_id: id === 'p-me' ? 'user-me' : `user-${id}`,
    name,
    avatar_emoji: emoji,
    country_flag: null,
    quiz_points: quiz,
    pred_points: pred,
    duel_points: duel,
    points_spent: 0,
    total_points: quiz + pred + duel,
    is_host: false,
    is_active: true,
    status: 'active',
    left_at: null,
    decline_count: 0,
    last_seen_at: iso(1),
    joined_at: iso(170),
    ...extra,
  };
}

/** Points per phase: before predictions are scored pred_points is 0. */
export function makePlayers(phase: RoomPhase): Player[] {
  const scored = phase === 'final';
  const early = phase === 'lobby';
  const k = early ? 0 : 1;
  return [
    player('p-me', 'Ελένη', '🎤', 184 * k, scored ? 140 : 0, 24 * k, { is_host: true, decline_count: 1 }),
    player('p-nikos', 'Νίκος', '🦄', 212 * k, scored ? 90 : 0, -12 * k),
    player('p-maria', 'Μαρία', '💃', 156 * k, scored ? 120 : 0, 36 * k),
    player('p-kostas', 'Κώστας', '🎸', 128 * k, scored ? 60 : 0, 0),
    player('p-sofia', 'Sofia', '🌟', 96 * k, scored ? 110 : 0, -24 * k),
    player('p-alex', 'Alex', '🔥', 72 * k, scored ? 40 : 0, 12 * k, { status: early ? 'active' : 'away' }),
  ];
}

export const ME_ID = 'p-me';

/** Avatar ids for the default cast (Task 5: the game bar shows the art). */
const CAST_AVATARS: Record<string, string> = {
  'p-me': 'av-01', 'p-nikos': 'av-04', 'p-maria': 'av-03', 'p-kostas': 'av-05', 'p-sofia': 'av-02', 'p-alex': 'av-06',
};
export function withAvatars(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, avatar_id: p.avatar_id ?? CAST_AVATARS[p.id] ?? null }));
}

/**
 * Lobby cast (boards lobby-after-{m,d}): stage names only, joined in order.
 * `host` picks who created the room, so the same data shows the host and
 * the guest view.
 */
export function makeLobbyPlayers(count: number, host: 'me' | 'other'): Player[] {
  const cast: [string, string, string][] = [
    ['p-me', 'Douze Points', 'av-01'],
    ['p-wind', 'Wind Machine', 'av-07'],
    ['p-glitter', 'Glitter Bomb', 'av-03'],
    ['p-key', 'Key Change', 'av-12'],
    ['p-ballad', 'Μπαλάντα Mode', 'av-09'],
    ['p-disco', 'Disco Μπαμπέσα', 'av-15'],
  ];
  const order = host === 'me' ? cast : [cast[1], cast[0], ...cast.slice(2)];
  return order.slice(0, count).map(([id, name, avatar], i) =>
    player(id, name, '🎤', 0, 0, 0, { avatar_id: avatar, is_host: i === 0, joined_at: iso(12 - i * 3) }));
}

// ── 2026 Grand Final line-up ─────────────────────────────────────────
interface ContestEntry {
  iso: string; name_en: string; name_el: string; artist: string | null; song: string | null;
  in_final: boolean; final_place: number | null; final_running_order: number | null;
  total_points: number | null; jury_points: number | null; televote_points: number | null;
  year: number;
}

const finalists = (contest2026 as { entries: ContestEntry[] }).entries
  .filter((e) => e.in_final)
  .sort((a, b) => (a.final_place ?? 99) - (b.final_place ?? 99));

/** Rows for entries_with_names / current_participants (running order = final place when the source has none). */
export const ENTRIES = finalists.map((e) => ({
  year: 2026,
  in_final: true,
  iso: e.iso,
  name_en: e.name_en,
  name_el: e.name_el,
  artist: e.artist,
  song: e.song,
  final_running_order: e.final_running_order ?? e.final_place,
  final_place: e.final_place,
  total_points: e.total_points,
  jury_points: e.jury_points,
  televote_points: e.televote_points,
}));

/** Pre-final rows: same line-up, no results yet. */
export const ENTRIES_NO_RESULTS = ENTRIES.map((e) => ({
  ...e, final_place: null, total_points: null, jury_points: null, televote_points: null,
}));

const byPlace = (p: number) => finalists[p - 1].iso;
const N = finalists.length;

// ── Predictions ──────────────────────────────────────────────────────
// Top 5: two exact hits, two in-top-5, one miss. Worst 5: one exact, two in.
const MY_TOP5 = [byPlace(1), byPlace(3), byPlace(2), byPlace(7), byPlace(5)];
const MY_WORST5 = [byPlace(N), byPlace(N - 2), byPlace(N - 6), byPlace(N - 1), byPlace(N - 10)];

function prediction(
  playerId: string, top5: string[], worst5: string[], scored: boolean, t5 = 0, w5 = 0,
): Prediction {
  return {
    id: `pred-${playerId}`,
    room_id: ROOM_ID,
    player_id: playerId,
    top5,
    worst5,
    submitted_at: iso(45),
    is_locked: scored,
    top5_points: scored ? t5 : null,
    worst5_points: scored ? w5 : null,
    total_points: scored ? t5 + w5 : 0,
    scored_at: scored ? iso(5) : null,
  };
}

/** Half-filled picker (predictions_open, not yet submitted). */
export const PREDICTION_PARTIAL = prediction(ME_ID, MY_TOP5.slice(0, 3), MY_WORST5.slice(0, 2), false);
/** Fully submitted, not scored. */
export const PREDICTION_SUBMITTED = prediction(ME_ID, MY_TOP5, MY_WORST5, false);
/**
 * Final phase: points present for the results screen. scored_at stays null so
 * PredictionsResultsScreen (which reads only top5/worst5/*_points) is the view.
 */
export const PREDICTION_SCORED = { ...prediction(ME_ID, MY_TOP5, MY_WORST5, true, 100, 40), scored_at: null };

// ── Task 6: lineups with a given finalist count ─────────────────────
/**
 * Predictions fixtures for one year's grand final: 2025 has 26 finalists
 * (Worst 5 = 22–26), 2026 has 25 (21–25). Same pick pattern as above:
 * Top 5 two exact + two right-list; Worst 5 one exact + two right-list.
 */
export function lineup(year: 2025 | 2026) {
  const src = (year === 2025 ? contest2025 : contest2026) as { entries: ContestEntry[] };
  const fin = src.entries.filter((e) => e.in_final).sort((a, b) => (a.final_place ?? 99) - (b.final_place ?? 99));
  const n = fin.length;
  const at = (p: number) => fin[p - 1].iso;
  const entries = fin.map((e) => ({
    year, in_final: true, iso: e.iso, name_en: e.name_en, name_el: e.name_el, artist: e.artist, song: e.song,
    final_running_order: e.final_running_order ?? e.final_place, final_place: e.final_place,
    total_points: e.total_points, jury_points: e.jury_points, televote_points: e.televote_points,
  }));
  const top5 = [at(1), at(3), at(2), at(7), at(5)];
  // worst5[0] = predicted last place (the scoring's order).
  const worst5 = [at(n), at(n - 2), at(n - 6), at(n - 1), at(n - 10)];
  const score = scorePredictions(top5, worst5, fin.map((e) => e.iso));
  return {
    n,
    entries,
    entriesNoResults: entries.map((e) => ({ ...e, final_place: null, total_points: null, jury_points: null, televote_points: null })),
    partial: prediction(ME_ID, top5.slice(0, 3), worst5.slice(0, 2), false),
    full: prediction(ME_ID, top5, worst5, false),
    scored: { ...prediction(ME_ID, top5, worst5, true, score.top5Points, score.worst5Points), scored_at: null },
  };
}

// ── Quiz ─────────────────────────────────────────────────────────────
export const QUIZ_QUESTION_IDS = QUESTIONS.slice(0, 10).map((q) => q.id);

/** Round-1 answers for the round-results screen: 7/10 correct, mixed speeds. */
export const ROUND1_ANSWERS: QuizAnswer[] = QUIZ_QUESTION_IDS.map((qid, i) => {
  const q = QUESTIONS.find((x) => x.id === qid)!;
  const correct = ![2, 5, 8].includes(i);
  const secs = [2.1, 4.3, 9.8, 1.6, 6.2, 15, 3.4, 11.7, 5.5, 2.8][i];
  const points = !correct ? 0 : secs <= 3 ? 12 : secs <= 7 ? 8 : 4;
  return {
    id: `qa-me-${qid}`,
    room_id: ROOM_ID,
    player_id: ME_ID,
    round_number: 1,
    question_id: qid,
    answer_index: secs >= 15 ? null : correct ? q.correct_index : (q.correct_index + 1) % q.options.length,
    is_correct: correct,
    question_opened_at: iso(30 + i),
    answered_at: iso(30 + i),
    response_seconds: secs,
    points_awarded: points,
  };
});

// ── Duels ────────────────────────────────────────────────────────────
const dq = (start: number) => QUESTIONS.slice(start, start + 3).map((q) => q.id);

function duelAnswers(ids: number[], correctMask: boolean[], ms: number[]): DuelAnswer[] {
  return ids.map((id, i) => {
    const q = QUESTIONS.find((x) => x.id === id)!;
    const ok = correctMask[i];
    return {
      questionId: id,
      answerIndex: ok ? q.correct_index : (q.correct_index + 1) % q.options.length,
      answeredAt: iso(10),
      responseMs: ms[i],
      points: ok ? Math.max(0, 12 - Math.floor(ms[i] / 1000)) : 0,
    };
  });
}
const sum = (a: DuelAnswer[]) => a.reduce((s, x) => s + x.points, 0);

function duel(id: string, partial: Partial<Duel>): Duel {
  return {
    id,
    room_id: ROOM_ID,
    challenger_id: ME_ID,
    challenged_id: 'p-nikos',
    question_id: null,
    question_ids: [],
    status: 'pending',
    created_at: iso(20),
    accepted_at: null,
    expires_at: null,
    completed_at: null,
    challenger_answer: null,
    challenger_answered_at: null,
    challenged_answer: null,
    challenged_answered_at: null,
    challenger_answers: [],
    challenged_answers: [],
    challenger_score: 0,
    challenged_score: 0,
    winner_id: null,
    loser_id: null,
    points_transferred: 0,
    is_rematch: false,
    parent_duel_id: null,
    winner_decision: null,
    decision_made_at: null,
    ...partial,
  };
}

const wonA = duelAnswers(dq(40), [true, true, true], [2100, 3400, 5200]);
const wonB = duelAnswers(dq(40), [true, false, true], [4300, 6100, 8800]);
const lostA = duelAnswers(dq(50), [true, false, false], [5200, 7000, 9000]);
const lostB = duelAnswers(dq(50), [true, true, true], [1800, 2600, 3900]);
const tieA = duelAnswers(dq(60), [true, true, false], [3000, 4000, 12000]);
const waitA = duelAnswers(dq(30), [true, true, false], [2500, 3500, 9500]);

export const DUELS: Duel[] = [
  // Incoming challenge (pending)
  duel('duel-incoming', { challenger_id: 'p-maria', challenged_id: ME_ID, status: 'pending', created_at: iso(3), question_ids: dq(10) }),
  // Sent challenge (pending)
  duel('duel-sent', { challenger_id: ME_ID, challenged_id: 'p-kostas', status: 'pending', created_at: iso(5), question_ids: dq(13) }),
  // In progress: my turn
  duel('duel-myturn', { challenger_id: 'p-sofia', challenged_id: ME_ID, status: 'accepted', accepted_at: iso(6), created_at: iso(8), question_ids: dq(20) }),
  // In progress: waiting for opponent
  duel('duel-waiting', {
    challenger_id: ME_ID, challenged_id: 'p-alex', status: 'answering', accepted_at: iso(9), created_at: iso(10),
    question_ids: dq(30), challenger_answers: waitA, challenger_score: sum(waitA),
  }),
  // Finished, I won, decision pending (steal / double)
  duel('duel-won', {
    challenger_id: ME_ID, challenged_id: 'p-nikos', status: 'completed', accepted_at: iso(14), created_at: iso(15), completed_at: iso(12),
    question_ids: dq(40), challenger_answers: wonA, challenged_answers: wonB,
    challenger_score: sum(wonA), challenged_score: sum(wonB), winner_id: ME_ID, loser_id: 'p-nikos',
  }),
  // Finished, I lost, opponent stole
  duel('duel-lost', {
    challenger_id: ME_ID, challenged_id: 'p-maria', status: 'completed', accepted_at: iso(40), created_at: iso(42), completed_at: iso(38),
    question_ids: dq(50), challenger_answers: lostA, challenged_answers: lostB,
    challenger_score: sum(lostA), challenged_score: sum(lostB), winner_id: 'p-maria', loser_id: ME_ID,
    winner_decision: 'steal', decision_made_at: iso(37), points_transferred: sum(lostB),
  }),
  // Tie
  duel('duel-tie', {
    challenger_id: 'p-kostas', challenged_id: ME_ID, status: 'tie', accepted_at: iso(55), created_at: iso(57), completed_at: iso(52),
    question_ids: dq(60), challenger_answers: tieA, challenged_answers: tieA,
    challenger_score: sum(tieA), challenged_score: sum(tieA),
  }),
  // Room history between other players
  duel('duel-others', {
    challenger_id: 'p-nikos', challenged_id: 'p-sofia', status: 'completed', accepted_at: iso(70), created_at: iso(72), completed_at: iso(68),
    question_ids: dq(70), challenger_answers: wonA, challenged_answers: wonB,
    challenger_score: sum(wonA), challenged_score: sum(wonB), winner_id: 'p-nikos', loser_id: 'p-sofia',
    winner_decision: 'double', decision_made_at: iso(67), points_transferred: sum(wonA),
  }),
];

export const duelById = (id: string) => DUELS.find((d) => d.id === id)!;

// ── Notifications ────────────────────────────────────────────────────
export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', room_id: ROOM_ID, player_id: ME_ID, type: 'duel_challenge', payload: { challengerName: 'Μαρία', challengerId: 'p-maria' }, is_read: false, created_at: iso(3), expires_at: null },
  { id: 'n2', room_id: ROOM_ID, player_id: ME_ID, type: 'duel_won', payload: { points: 31 }, is_read: false, created_at: iso(12), expires_at: null },
  { id: 'n3', room_id: ROOM_ID, player_id: ME_ID, type: 'phase_change', payload: { to: 'predictions_open' }, is_read: true, created_at: iso(60), expires_at: null },
];

// ── Winners (final phase) ────────────────────────────────────────────
export const WINNERS: WinnerRow[] = [
  { id: 'w1', room_id: ROOM_ID, category: 'champion', player_id: 'p-me', metric_value: 348, is_sudden_death_winner: false },
  { id: 'w2', room_id: ROOM_ID, category: 'duelist', player_id: 'p-maria', metric_value: 4, is_sudden_death_winner: false },
  { id: 'w3', room_id: ROOM_ID, category: 'thief', player_id: 'p-maria', metric_value: 36, is_sudden_death_winner: false },
  { id: 'w4', room_id: ROOM_ID, category: 'guru', player_id: 'p-nikos', metric_value: 22, is_sudden_death_winner: false },
  { id: 'w5', room_id: ROOM_ID, category: 'oracle', player_id: 'p-maria', metric_value: 6, is_sudden_death_winner: false },
];

// ── Other players' quiz answers (feeds aggregate views) ─────────────
export const OTHER_QUIZ_ANSWERS: QuizAnswer[] = ['p-nikos', 'p-maria'].flatMap((pid) =>
  ROUND1_ANSWERS.map((a) => ({ ...a, id: `qa-${pid}-${a.question_id}`, player_id: pid })),
);

export { ROOM_ID };

// ── Task 7: stage-name cast for quiz and duels ───────────────────────
const STAGE_CAST: Record<string, [string, string]> = {
  'p-me': ['Lady Televote', 'img-02'], 'p-nikos': ['Douze Points', 'img-01'], 'p-maria': ['Key Change', 'img-11'],
  'p-kostas': ['Disco Μπαμπέσα', 'img-25'], 'p-sofia': ['Glitter Bomb', 'img-37'], 'p-alex': ['Wind Machine', 'img-29'],
};
/** The default cast with stage names and owner-art avatars (no real names anywhere). */
export function withStageNames(players: Player[]): Player[] {
  return players.map((p) => {
    const c = STAGE_CAST[p.id];
    return c ? { ...p, name: c[0], avatar_id: c[1] } : p;
  });
}

/** Round end (motion #3): totals after round 1 (+ROUND1_POINTS for me) and the snapshot at the round start. */
export const ROUND1_POINTS = ROUND1_ANSWERS.reduce((s, a) => s + a.points_awarded, 0);
export function makeRoundEndPlayers(): Player[] {
  const totals: Record<string, number> = { 'p-nikos': 214, 'p-maria': 176, 'p-kostas': 168, 'p-me': 141 + ROUND1_POINTS, 'p-sofia': 120, 'p-alex': 98 };
  return withStageNames(makePlayers('pre_night')).map((p) => ({ ...p, status: 'active', is_active: true, quiz_points: totals[p.id], pred_points: 0, duel_points: 0, total_points: totals[p.id] }));
}
export const ROUND1_START_STANDINGS = [
  { id: 'p-nikos', total: 214 }, { id: 'p-maria', total: 176 }, { id: 'p-kostas', total: 168 },
  { id: 'p-me', total: 141 }, { id: 'p-sofia', total: 120 }, { id: 'p-alex', total: 98 },
];
