// Pure lifecycle rules for the admin Contests module.
// allowedActions mirrors the guards of start_contest, finalize_contest,
// archive_contest and unarchive_contest (migrations 071 and 078) so the
// UI only offers legal buttons. The SQL stays authoritative: anything the
// UI cannot see (finalize needs at least one final_place) is refused there
// and surfaces through formatError.

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
  start: 'Start',
  finalize: 'Finalize',
  archive: 'Archive',
  unarchive: 'Un-archive',
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
      return `Start ${y}: ${y} becomes the current contest.`;
    case 'finalize':
      return `Finalize ${y}: ${y} becomes finalized and every ${y} room is scored and gets its winners. Results can no longer be changed. This cannot be undone.`;
    case 'archive':
      return `Archive ${y}: ${y} is locked and its page moves to the past contests (the old ${y} address redirects there). Games and the next contest are not affected. You can undo with Un-archive while no other contest is started.`;
    case 'unarchive':
      return `Un-archive ${y}: ${y} goes back to finalized and its results can be corrected again.`;
  }
}
