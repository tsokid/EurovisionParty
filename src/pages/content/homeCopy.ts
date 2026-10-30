import type { Locale } from '../../lib/seo/locale';

interface HomeCopy {
  meta: { title: string; description: string };
}

// Taken verbatim from the static defaults in index.html, with the live
// contest's year templated in (null while site.json loads on the client). No
// Greek home meta copy exists yet, so both locales share the English strings.
function meta(year: number | null): HomeCopy['meta'] {
  const y = year === null ? '' : ` ${year}`;
  return {
    title: `Eurovision Games${y} · Free Party Game — Predictions, Trivia & Live Scoring`,
    description:
      `Free Eurovision${y} party game for watch nights. Predict results live, battle friends in trivia duels, and score points as you watch the Grand Final. No sign-up needed.`,
  };
}

export const copy = (year: number | null): Record<Locale, HomeCopy> => ({
  en: { meta: meta(year) },
  el: { meta: meta(year) },
});
