// The question bank in /admin: row shape, topics, eras and the round mix.
// roundMix mirrors public.quiz_round_mix (098) so the admin shows exactly
// what the server will serve; eraOf mirrors public.question_era.

export const TOPICS = [
  'winner', 'runner_up', 'result', 'performer', 'song', 'songwriter', 'language',
  'staging', 'stage_guest', 'host', 'national_selection', 'participation',
  'rules', 'records', 'lyrics', 'iconic',
] as const;
export type Topic = (typeof TOPICS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// verified = Ενεργή (the only state served to players); review = Για έλεγχο.
export const STATUSES = ['verified', 'review', 'draft', 'retired'] as const;
export type Status = (typeof STATUSES)[number];

export const ERAS = ['current', 'previous', 'recent', 'classic'] as const;
export type Era = (typeof ERAS)[number];

export interface QuestionRow {
  id: number;
  correct_index: number;
  contest_year: number | null;
  iso: string | null;
  topic: Topic;
  difficulty: Difficulty;
  question_en: string;
  question_el: string;
  options_en: string[];
  options_el: string[];
  fact: string;
  source: string | null;
  note: string | null;
  lyric_check: boolean;
  time_sensitive: boolean;
  status: Status;
  verified_at: string | null;
  updated_at: string;
}

export const QUESTION_COLUMNS =
  'id, correct_index, contest_year, iso, topic, difficulty, question_en, question_el, options_en, options_el, ' +
  'fact, source, note, lyric_check, time_sensitive, status, verified_at, updated_at';

export type Mix = Record<Era, number>;
export const DEFAULT_MIX: Mix = { current: 30, previous: 30, recent: 20, classic: 20 };

/** current: this year · previous: last year · recent: 2–5 years back · classic: older, or not about one year. */
export function eraOf(contestYear: number | null, liveYear: number): Era {
  if (contestYear == null) return 'classic';
  const d = liveYear - contestYear;
  if (d <= 0) return 'current';
  if (d === 1) return 'previous';
  if (d <= 5) return 'recent';
  return 'classic';
}

export const mixTotal = (m: Mix): number => ERAS.reduce((s, e) => s + m[e], 0);

/**
 * Questions per era in a round of `size` (largest remainder; ties go to the
 * newer era), so the counts always add up to `size` when the mix adds to 100.
 */
export function roundMix(m: Mix, size = 10): Mix {
  const parts = ERAS.map((era, ord) => ({ era, ord, base: Math.floor((m[era] * size) / 100), rem: (m[era] * size) % 100 }));
  const left = size - parts.reduce((s, p) => s + p.base, 0);
  const bonus = new Set([...parts].sort((a, b) => b.rem - a.rem || a.ord - b.ord).slice(0, Math.max(0, left)).map((p) => p.era));
  return Object.fromEntries(parts.map((p) => [p.era, p.base + (bonus.has(p.era) ? 1 : 0)])) as Mix;
}

/** Why a question cannot be saved as it is, or null. Mirrors the 098 checks. */
export function questionProblem(q: Pick<QuestionRow,
  'question_en' | 'question_el' | 'options_en' | 'options_el' | 'correct_index' | 'fact' | 'status' | 'source'>): string | null {
  const distinct = (o: string[]) => o.length === 4 && o.every((x) => x.trim() !== '')
    && new Set(o.map((x) => x.trim().toLowerCase())).size === 4;
  if (!q.question_el.trim() || !q.question_en.trim()) return 'text';
  if (!distinct(q.options_el) || !distinct(q.options_en)) return 'options';
  if (q.correct_index < 0 || q.correct_index > 3) return 'correct';
  if (!q.fact.trim()) return 'fact';
  if (q.status === 'verified' && !(q.source ?? '').trim()) return 'source';
  return null;
}

// ── List filters ─────────────────────────────────────────────────────────
export interface Filters { q: string; year: string; iso: string; topic: string; status: string; era: string; flag: string }
export const NO_FILTERS: Filters = { q: '', year: '', iso: '', topic: '', status: '', era: '', flag: '' };

export function filterQuestions(rows: QuestionRow[], f: Filters, liveYear: number): QuestionRow[] {
  const needle = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.year === 'none' ? r.contest_year != null : f.year && String(r.contest_year) !== f.year) return false;
    if (f.iso === 'none' ? r.iso != null : f.iso && r.iso !== f.iso) return false;
    if (f.topic && r.topic !== f.topic) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.era && eraOf(r.contest_year, liveYear) !== f.era) return false;
    if (f.flag === 'lyric' && !r.lyric_check) return false;
    if (f.flag === 'time' && !r.time_sensitive) return false;
    if (needle) {
      const hay = [r.question_el, r.question_en, r.fact, ...r.options_el, ...r.options_en, String(r.id)].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

