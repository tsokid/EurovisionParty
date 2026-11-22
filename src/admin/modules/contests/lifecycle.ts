// Pure lifecycle rules for the admin Contests module.
// allowedActions mirrors the guards of start_contest, finalize_contest,
// archive_contest and unarchive_contest (migrations 071 and 078) so the
// UI only offers legal buttons. The SQL stays authoritative: anything the
// UI cannot see (finalize needs at least one final_place) is refused there
// and surfaces through formatError.
import { t } from '../../i18n';

export type ContestStage = 'upcoming' | 'current' | 'finalized' | 'archived';

export type ContestRow = {
  year: number;
  city: string;
  city_slug: string;
  host_iso: string | null;
  stage: ContestStage;
  final_date: string | null;
  indexable: boolean;
  entry_count: number;
};

export type ContestAction = 'start' | 'finalize' | 'archive' | 'unarchive';

export const ACTION_LABELS: Record<ContestAction, string> = {
  start: t.contests.actions.start,
  finalize: t.contests.actions.finalize,
  archive: t.contests.actions.archive,
  unarchive: t.contests.actions.unarchive,
};

/**
 * Lifecycle buttons that are legal for `c`, given every contest in `all`.
 */
export function allowedActions(c: ContestRow, all: ContestRow[]): ContestAction[] {
  switch (c.stage) {
    case 'upcoming': {
      const live = all.some((r) => r.year !== c.year && (r.stage === 'current' || r.stage === 'finalized'));
      return live ? [] : ['start'];
    }
    case 'current':
      return ['finalize'];
    case 'finalized':
      return ['archive'];
    case 'archived': {
      const latest = Math.max(...all.filter((r) => r.stage === 'archived').map((r) => r.year));
      const live = all.some((r) => r.stage === 'current' || r.stage === 'finalized');
      return c.year === latest && !live ? ['unarchive'] : [];
    }
  }
}

/** One plain-English sentence saying exactly what `action` changes. */
export function confirmText(action: ContestAction, c: ContestRow): string {
  const y = c.year;
  switch (action) {
    case 'start':
      return t.contests.confirm.start(y);
    case 'finalize':
      return t.contests.confirm.finalize(y);
    case 'archive':
      return t.contests.confirm.archive(y);
    case 'unarchive':
      return t.contests.confirm.unarchive(y);
  }
}
