import { useEffect, useState } from 'react';

/**
 * Whole days from `now` (the viewer's local calendar day) to a `YYYY-MM-DD`
 * date: 0 on the day itself, negative once it has passed. Null without a date.
 */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/**
 * Days to `iso`, computed in the browser after mount. The prerendered HTML and
 * the first client render both get null (no hydration mismatch, no build-day
 * number frozen into the page); callers reserve the space so nothing shifts.
 */
export function useDaysUntil(iso: string | null | undefined): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    setDays(daysUntil(iso));
  }, [iso]);
  return days;
}
