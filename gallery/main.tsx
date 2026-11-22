// gallery/main.tsx — dev-only screen gallery (vite.gallery.config.ts).
// ?screen=<id> renders one in-game screen full-page with fixture data;
// without it, an index of links. All Supabase traffic goes to
// gallery/fakeSupabase.ts (aliased in place of src/lib/supabase.ts).

import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../src/i18n';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { RoomPage } from '../src/pages/RoomPage';
import { HomePage } from '../src/pages/HomePage';
import LocaleRoot from '../src/components/seo/LocaleRoot';
import AppShell from '../src/components/layout/AppShell';
import PredictionsScreen from '../src/components/predictions/PredictionsScreen';
import DuelPlayScreen from '../src/components/duels/DuelPlayScreen';
import DuelResultCard from '../src/components/duels/DuelResultCard';
import { useGameStore, type QuizProgress } from '../src/stores/gameStore';
import type { Player, Room, RoomPhase, TabId } from '../src/lib/types';
import { setFakeDb, type FakeTables } from './fakeSupabase';
import * as F from './fixtures';
import StagePrimitives from './StagePrimitives';
import AvatarSheet from './AvatarSheet';
import '../src/index.css';

// ── Screens ──────────────────────────────────────────────────────────
type Render = 'room' | 'home' | 'predictions-locked' | 'duel-play' | 'duel-result' | 'stage' | 'avatars';

interface Scenario {
  id: string;
  label: string;
  render: Render;
  phase: RoomPhase;
  tab?: TabId;
  homeUrl?: string;
  prediction?: object | null;
  quizProgress?: (roomId: string, playerId: string) => QuizProgress;
  /** Click away the final-phase WinnerCrown overlay. */
  dismissCrown?: boolean;
  /** Override the cast (default: F.makePlayers + avatars). */
  players?: () => Player[];
  /** Move the room to this phase after `phaseChangeAfterMs`, the way a
   *  realtime update would (store + fake DB), to show the phase banner. */
  phaseChangeTo?: RoomPhase;
  phaseChangeAfterMs?: number;
  /** Task 6: a real grand-final lineup (2025 = 26 finalists, 2026 = 25) and
   *  which saved prediction the player has. */
  lineup?: 2025 | 2026;
  pick?: 'none' | 'partial' | 'full' | 'scored';
  /** Click this button (accessible name) once the screen has loaded. */
  autoClick?: string;
  note?: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'welcome', label: 'Welcome (home)', render: 'home', phase: 'lobby', homeUrl: '/el' },
  { id: 'join', label: 'Join room form', render: 'home', phase: 'lobby', homeUrl: '/el?action=join' },
  { id: 'onboarding-create', label: 'Onboarding: create a room', render: 'home', phase: 'lobby', homeUrl: '/el?action=create', note: 'Redesign Task 4: stage name, secret real name, avatar picker.' },
  { id: 'onboarding-join', label: 'Onboarding: join a room (code prefilled)', render: 'home', phase: 'lobby', homeUrl: '/el?join=DESIGN', note: 'Redesign Task 4: the invite-link variant.' },
  { id: 'lobby', label: 'Lobby', render: 'room', phase: 'lobby' },
  { id: 'lobby-host', label: 'Lobby as host, 3 players (QR)', render: 'room', phase: 'lobby', players: () => F.makeLobbyPlayers(3, 'me'), note: 'Redesign Task 5: game bar, phase strip, QR, Start.' },
  { id: 'lobby-host-1', label: 'Lobby as host, alone (Start disabled)', render: 'room', phase: 'lobby', players: () => F.makeLobbyPlayers(1, 'me') },
  { id: 'lobby-guest', label: 'Lobby as guest, 6 players', render: 'room', phase: 'lobby', players: () => F.makeLobbyPlayers(6, 'other'), note: 'Redesign Task 5: guest sees the waiting line.' },
  { id: 'shell-pre-night', label: 'Shell · pre_night (Board tab)', render: 'room', phase: 'pre_night', tab: 'leaderboard', note: 'Redesign Task 5: Predictions locked.' },
  { id: 'shell-predictions-open', label: 'Shell · predictions_open (Board tab)', render: 'room', phase: 'predictions_open', tab: 'leaderboard' },
  { id: 'shell-voting-live', label: 'Shell · voting_live (Board tab)', render: 'room', phase: 'voting_live', tab: 'leaderboard', prediction: F.PREDICTION_SUBMITTED, note: 'Quiz and Duels locked.' },
  { id: 'shell-final', label: 'Shell · final (Predictions tab)', render: 'room', phase: 'final', tab: 'predictions', prediction: F.PREDICTION_SCORED, dismissCrown: true },
  { id: 'phase-banner', label: 'Phase-change banner (pre_night → predictions_open)', render: 'room', phase: 'pre_night', tab: 'quiz', phaseChangeTo: 'predictions_open', phaseChangeAfterMs: 1500, note: 'Redesign Task 5: motion #5, fired from the store phase.' },
  { id: 'phase-banner-voting', label: 'Phase-change banner (→ voting_live)', render: 'room', phase: 'predictions_open', tab: 'leaderboard', prediction: F.PREDICTION_SUBMITTED, phaseChangeTo: 'voting_live', phaseChangeAfterMs: 1500 },
  { id: 'pre-night', label: 'Pre-night (default Quiz tab)', render: 'room', phase: 'pre_night', tab: 'quiz' },
  { id: 'predictions-open', label: 'Predictions picker', render: 'room', phase: 'predictions_open', tab: 'predictions', prediction: F.PREDICTION_PARTIAL },
  {
    id: 'predictions-locked', label: 'Predictions submitted / locked', render: 'predictions-locked', phase: 'voting_live',
    prediction: F.PREDICTION_SUBMITTED,
    note: 'Component fallback: RoomPage routes the Predictions tab to VotingLiveScreen in voting_live, so PredictionsScreen is rendered directly in AppShell.',
  },
  { id: 'voting-live', label: 'Voting live', render: 'room', phase: 'voting_live', tab: 'predictions', prediction: F.PREDICTION_SUBMITTED },
  {
    id: 'quiz-question', label: 'Quiz question', render: 'room', phase: 'predictions_open', tab: 'quiz',
    quizProgress: (roomId, playerId) => ({
      roomId, playerId, phase: 'playing', roundNumber: 1, questionIndex: 3,
      questionIds: F.QUIZ_QUESTION_IDS, usedQuestionIds: F.QUIZ_QUESTION_IDS, roundAnswers: F.ROUND1_ANSWERS.slice(0, 3),
    }),
  },
  {
    id: 'quiz-round-results', label: 'Quiz round results', render: 'room', phase: 'predictions_open', tab: 'quiz',
    quizProgress: (roomId, playerId) => ({
      roomId, playerId, phase: 'results', roundNumber: 1, questionIndex: 9,
      questionIds: F.QUIZ_QUESTION_IDS, usedQuestionIds: F.QUIZ_QUESTION_IDS, roundAnswers: F.ROUND1_ANSWERS,
    }),
  },
  { id: 'duels-list', label: 'Duels list', render: 'room', phase: 'predictions_open', tab: 'duels' },
  { id: 'duel-play', label: 'Duel play', render: 'duel-play', phase: 'predictions_open', tab: 'duels', note: 'Component fallback: DuelPlayScreen is local state of DuelsScreen.' },
  { id: 'duel-result', label: 'Duel result (steal / double)', render: 'duel-result', phase: 'predictions_open', tab: 'duels', note: 'Component fallback: DuelResultCard in AppShell.' },
  { id: 'leaderboard', label: 'Leaderboard', render: 'room', phase: 'predictions_open', tab: 'leaderboard' },
  { id: 'intel', label: 'Intel market', render: 'room', phase: 'predictions_open', tab: 'intel' },
  { id: 'final-results', label: 'Final results (predictions)', render: 'room', phase: 'final', tab: 'predictions', prediction: F.PREDICTION_SCORED, dismissCrown: true },
  // ── Task 6: predictions, voting, prediction results (26 finalists; *-25 = 25) ──
  { id: 'pk-empty', label: 'Predictions · empty (26 finalists)', render: 'room', phase: 'predictions_open', tab: 'predictions', lineup: 2025, pick: 'none', note: 'Redesign Task 6: tap-to-assign, Worst 5 = 22–26.' },
  { id: 'pk-empty-25', label: 'Predictions · empty (25 finalists)', render: 'room', phase: 'predictions_open', tab: 'predictions', lineup: 2026, pick: 'none', note: 'Worst 5 = 21–25.' },
  { id: 'pk-partial', label: 'Predictions · partial 5/10 (26)', render: 'room', phase: 'predictions_open', tab: 'predictions', lineup: 2025, pick: 'partial' },
  { id: 'pk-full', label: 'Predictions · full, still editable (26)', render: 'room', phase: 'predictions_open', tab: 'predictions', lineup: 2025, pick: 'full', autoClick: 'Αλλαγή προβλέψεων', note: 'Saved 10/10, reopened for changes.' },
  { id: 'pk-submitted', label: 'Predictions · submitted summary (26)', render: 'room', phase: 'predictions_open', tab: 'predictions', lineup: 2025, pick: 'full' },
  { id: 'pk-locked', label: 'Predictions · locked / sealed (26)', render: 'predictions-locked', phase: 'voting_live', lineup: 2025, pick: 'full', note: 'PredictionsScreen outside predictions_open (lock snap + stamp).' },
  { id: 'voting-picks', label: 'Voting live with locked picks (26)', render: 'room', phase: 'voting_live', tab: 'predictions', lineup: 2025, pick: 'full' },
  { id: 'voting-picks-25', label: 'Voting live with locked picks (25)', render: 'room', phase: 'voting_live', tab: 'predictions', lineup: 2026, pick: 'full' },
  { id: 'results-breakdown', label: 'Prediction results breakdown (26)', render: 'room', phase: 'final', tab: 'predictions', lineup: 2025, pick: 'scored', dismissCrown: true },
  { id: 'results-breakdown-25', label: 'Prediction results breakdown (25)', render: 'room', phase: 'final', tab: 'predictions', lineup: 2026, pick: 'scored', dismissCrown: true },
  { id: 'winners-crown', label: 'Winner crown reveal', render: 'room', phase: 'final', tab: 'leaderboard', prediction: F.PREDICTION_SCORED },
  { id: 'winners', label: 'Winners carousel', render: 'room', phase: 'final', tab: 'leaderboard', prediction: F.PREDICTION_SCORED, dismissCrown: true },
  { id: 'avatars', label: 'Avatar set (96px, 32px, <Avatar>)', render: 'avatars', phase: 'lobby', note: 'Redesign Task 4: src/components/stage/avatars registry.' },
  { id: 'stage-primitives', label: 'Stage primitives (design system)', render: 'stage', phase: 'lobby', note: 'Redesign Task 1: every src/components/stage primitive, in 390px and 1440px iframes.' },
];

// ── Seeding ──────────────────────────────────────────────────────────
function seed(s: Scenario) {
  if (s.render === 'stage' || s.render === 'avatars') return; // static sheet, no data
  // Skip first-entry overlays and audio, the same flags the app checks.
  try {
    localStorage.setItem('eurovision-games-intro-seen-DESIGN', '1');
    localStorage.setItem('eurovision-games-muted', '1');
    localStorage.removeItem('europarty_rooms');
  } catch { /* ignore */ }

  const room = F.makeRoom(s.phase, s.lineup ?? 2026);
  const L = s.lineup ? F.lineup(s.lineup) : null;
  const pickRow = L && s.pick && s.pick !== 'none' ? L[s.pick] : null;
  const players = s.players ? s.players() : F.withAvatars(F.makePlayers(s.phase));
  const me = players.find((p) => p.id === F.ME_ID)!;
  const final = s.phase === 'final';

  F.ROOM_ROW_REF.current = room;
  const tables: FakeTables = {
    get rooms() { return [F.ROOM_ROW_REF.current as unknown as Record<string, unknown>]; },
    players,
    predictions: L
      ? (pickRow ? [pickRow as unknown as Record<string, unknown>] : [])
      : s.prediction ? [s.prediction as Record<string, unknown>] : [],
    entries_with_names: L ? (final ? L.entries : L.entriesNoResults) : final ? F.ENTRIES : F.ENTRIES_NO_RESULTS,
    current_participants: F.ENTRIES_NO_RESULTS,
    duels: F.DUELS,
    notifications: F.NOTIFICATIONS,
    quiz_answers: [...F.OTHER_QUIZ_ANSWERS],
    quiz_rounds: [],
    question_assignments: [],
    intel_reveals: [{ id: 'ir1', room_id: room.id, player_id: me.id, reveal_type: 'top3', points_cost: 30, revealed_at: new Date().toISOString() }],
    winners: final ? F.WINNERS : [],
    tie_votes: [],
    tie_vote_choices: [],
    sudden_death_rounds: [],
    sudden_death_answers: [],
    results: [],
  };
  const top3 = F.ENTRIES.slice(0, 3).map((e) => e.iso);
  setFakeDb(tables, {
    compute_winners: () => F.WINNERS.length,
    get_intel_reveal: ({ p_reveal_type }) =>
      p_reveal_type === 'top3' ? { available: true, data: top3 } : { available: false },
    submit_quiz_answer: () => ({ id: 'fake-answer', points_awarded: 8, response_seconds: 4.2 }),
    submit_duel_answers: () => null,
    advance_room_phase: () => null,
  });

  const st = useGameStore.getState();
  st.reset();
  if (s.render === 'home') return; // signed-in visitor, not yet in a room
  st.setRoom(room);
  st.setPlayer(me);
  st.setPlayers(players);
  st.setRoomPassword(F.ROOM_PASSWORD);
  if (s.tab) st.setActiveTab(s.tab);
  if (s.quizProgress) st.setQuizProgress(s.quizProgress(room.id, me.id));
}

// ── Views ────────────────────────────────────────────────────────────
function PhaseFlip({ to, afterMs }: { to: RoomPhase; afterMs: number }) {
  useEffect(() => {
    const id = setTimeout(() => {
      const st = useGameStore.getState();
      if (!st.room) return;
      const next: Room = { ...st.room, phase: to, phase_updated_at: new Date().toISOString() };
      F.ROOM_ROW_REF.current = next; // what the polling fallback reads
      st.setRoom(next);
    }, afterMs);
    return () => clearTimeout(id);
  }, [to, afterMs]);
  return null;
}

function AutoClick({ name }: { name: string }) {
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);
      if (el) { el.click(); clearInterval(id); }
      if (++tries > 60) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [name]);
  return null;
}

function DismissCrown() {
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const el = document.querySelector<HTMLElement>('div.fixed.inset-0.z-\\[100\\]');
      if (el) { el.click(); clearInterval(id); }
      if (++tries > 40) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);
  return null;
}

function Screen({ s }: { s: Scenario }): ReactNode {
  const noop = () => {};
  switch (s.render) {
    case 'home':
      return (
        <MemoryRouter initialEntries={[s.homeUrl ?? '/el']}>
          <Routes>
            <Route path="/:locale" element={<LocaleRoot />}>
              <Route index element={<HomePage />} />
            </Route>
            <Route path="*" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      );
    case 'room':
      return (
        <MemoryRouter initialEntries={['/room/DESIGN']}>
          <Routes>
            <Route path="/room/:roomCode" element={<><RoomPage />{s.dismissCrown && <DismissCrown />}{s.autoClick && <AutoClick name={s.autoClick} />}{s.phaseChangeTo && <PhaseFlip to={s.phaseChangeTo} afterMs={s.phaseChangeAfterMs ?? 1500} />}</>} />
            <Route path="*" element={<p style={{ color: 'white', padding: 24 }}>Navigated away from the room (gallery).</p>} />
          </Routes>
        </MemoryRouter>
      );
    case 'predictions-locked':
      return (
        <MemoryRouter initialEntries={['/room/DESIGN']}>
          <AppShell showHeader showNav phase={s.phase} onExitPress={noop}>
            <PredictionsScreen />
          </AppShell>
        </MemoryRouter>
      );
    case 'duel-play':
      return (
        <MemoryRouter initialEntries={['/room/DESIGN']}>
          <AppShell showHeader showNav phase={s.phase} onExitPress={noop}>
            <DuelPlayScreen duel={F.duelById('duel-myturn')} playerId={F.ME_ID} onComplete={noop} onCancel={noop} />
          </AppShell>
        </MemoryRouter>
      );
    case 'avatars':
      return <AvatarSheet />;
    case 'stage':
      return <StagePrimitives frame={new URLSearchParams(location.search).has('frame')} />;
    case 'duel-result':
      return (
        <MemoryRouter initialEntries={['/room/DESIGN']}>
          <AppShell showHeader showNav phase={s.phase} onExitPress={noop}>
            <div className="flex flex-col max-w-3xl w-full mx-auto px-3 sm:px-5 lg:px-6 pb-6 gap-3">
              <DuelResultCard duel={F.duelById('duel-won')} onDecision={noop} />
              <DuelResultCard duel={F.duelById('duel-lost')} onRematch={noop} hasRematch={false} />
            </div>
          </AppShell>
        </MemoryRouter>
      );
  }
}

function Index() {
  return (
    <div className="min-h-svh bg-euro-gradient text-white p-6">
      <h1 className="text-3xl font-extrabold mb-1">Screen gallery</h1>
      <p className="text-white/60 mb-6 text-sm">Fake data only — no Supabase traffic. Room DESIGN · 2026.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((s) => (
          <li key={s.id}>
            <a className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10" href={`?screen=${s.id}`}>
              <span className="font-bold">{s.label}</span>
              <span className="block text-xs text-white/50 font-mono">{s.id}</span>
              {s.note && <span className="block text-xs text-white/40 mt-1">{s.note}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Boot ─────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'el';
const screenId = params.get('screen');
const scenario = SCENARIOS.find((s) => s.id === screenId) ?? null;

// The cookie banner (vanilla-cookieconsent, mounted by LocaleRoot) is out of scope here.
const style = document.createElement('style');
style.textContent = '#cc-main{display:none!important}';
document.head.appendChild(style);

(window as unknown as { __GALLERY_SCREENS__: string[] }).__GALLERY_SCREENS__ = SCENARIOS.map((s) => s.id);

void i18n.changeLanguage(lang).then(() => {
  document.documentElement.lang = lang;
  if (scenario) seed(scenario);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        {scenario ? <Screen s={scenario} /> : screenId ? <p style={{ color: 'white', padding: 24 }}>Unknown screen “{screenId}”.</p> : <Index />}
      </ErrorBoundary>
    </StrictMode>,
  );
});
