// ============================================================
// Eurovision Party Game - TypeScript Types
// Mirrors the Supabase database schema from 001_initial_schema.sql
// ============================================================

// --- Enums ---

export type RoomPhase =
  | 'lobby'
  | 'pre_night'
  | 'predictions_open'
  | 'voting_live'
  | 'final';

export type DuelStatus =
  | 'pending'
  | 'accepted'
  | 'answering'
  | 'completed'
  | 'expired'
  | 'declined';

export type DuelDecision = 'steal' | 'double';

export interface DuelAnswer {
  questionId: number;
  answerIndex: number;
  answeredAt: string;
  responseMs: number;
  points: number;
}

export type IntelRevealType = 'top3' | 'top10' | 'worst3';

export type ResultsSource = 'pending' | string;

export type NotificationType = string;

export type TabId = 'quiz' | 'predictions' | 'duels' | 'intel' | 'leaderboard';

// --- Tables ---

export interface Room {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  year: number;
  phase: RoomPhase;
  max_players: number;
  quiz_rounds: number;
  duel_limit: number;
  created_at: string;
  phase_updated_at: string | null;
  quiz_opened_at: string | null;
  predictions_opened_at: string | null;
  predictions_locked_at: string | null;
  results_source: ResultsSource;
  results_confirmed: boolean;
  last_activity_at: string;
}

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

export interface QuizRound {
  id: string;
  room_id: string;
  round_number: number;
  question_ids: number[];
  opened_at: string | null;
  closes_at: string | null;
  status: 'pending' | 'active' | 'completed' | string;
}

export interface QuizAnswer {
  id: string;
  room_id: string;
  player_id: string;
  round_number: number;
  question_id: number;
  answer_index: number | null;
  is_correct: boolean | null;
  question_opened_at: string;
  answered_at: string;
  response_seconds: number | null;
  points_awarded: number;
}

export interface QuestionAssignment {
  id: string;
  room_id: string;
  question_id: number;
  round_number: number;
  position: number;
}

export interface Prediction {
  id: string;
  room_id: string;
  player_id: string;
  top5: string[];
  worst5: string[];
  submitted_at: string;
  is_locked: boolean;
  top5_points: number | null;
  worst5_points: number | null;
  total_points: number;
  scored_at: string | null;
}

export interface Duel {
  id: string;
  room_id: string;
  challenger_id: string;
  challenged_id: string;
  question_id: number | null;
  question_ids: number[];
  status: DuelStatus;
  created_at: string;
  accepted_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  // Legacy single-answer fields
  challenger_answer: number | null;
  challenger_answered_at: string | null;
  challenged_answer: number | null;
  challenged_answered_at: string | null;
  // New multi-answer fields
  challenger_answers: DuelAnswer[];
  challenged_answers: DuelAnswer[];
  challenger_score: number;
  challenged_score: number;
  // Result
  winner_id: string | null;
  loser_id: string | null;
  points_transferred: number;
  // Rematch
  is_rematch: boolean;
  parent_duel_id: string | null;
  // Post-duel decision
  winner_decision: DuelDecision | null;
  decision_made_at: string | null;
}

export interface IntelReveal {
  id: string;
  room_id: string;
  player_id: string;
  reveal_type: IntelRevealType;
  points_cost: number;
  revealed_at: string;
}

export interface Result {
  id: string;
  room_id: string;
  final_ranking: Record<string, unknown> | null;
  source: string | null;
  source_url: string | null;
  fetched_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  is_partial: boolean;
  positions_confirmed: number;
  created_at: string;
}

export interface Notification {
  id: string;
  room_id: string;
  player_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  expires_at: string | null;
}

// --- Utility types ---

/** A question from the local question bank (not a DB table) */
export interface QuizQuestion {
  id: number;
  question: string;
  question_el?: string;
  options: string[];
  options_el?: string[];
  correct_index: number;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/** Country entry for the 2026 Grand Final */
export interface Country {
  id: string;
  name: string;
  name_el: string;
  /** Artist representing the country */
  artist?: string;
  /** Song title */
  song?: string;
  /** Language(s) of the song */
  language?: string;
  /** Which semi-final the country competes/votes in: 1, 2, 'big5', 'host' */
  semi?: 1 | 2 | 'big5' | 'host';
  /** Running order within the semi-final (1-15) */
  runningOrder?: number;
  flag: string;
}
