import type { Locale } from '../../lib/seo/locale';

interface HomeCopy {
  meta: { title: string; description: string };
}

// Taken verbatim from the static defaults in index.html. No Greek home meta
// copy exists yet, so both locales share the English strings for now.
const META: HomeCopy['meta'] = {
  title: 'Eurovision Games 2026 · Free Party Game — Predictions, Trivia & Live Scoring',
  description:
    'Free Eurovision 2026 party game for watch nights. Predict results live, battle friends in trivia duels, and score points as you watch the Grand Final. No sign-up needed.',
};

export const copy: Record<Locale, HomeCopy> = {
  en: { meta: META },
  el: { meta: META },
};
