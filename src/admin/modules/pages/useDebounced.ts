import { useEffect, useState } from 'react';

/**
 * `value`, `ms` after it last changed. With `immediate` (e.g. a freshly
 * loaded document, not a keystroke) the value passes through at once.
 */
export function useDebounced<T>(value: T, ms: number, immediate = false): T {
  const [late, setLate] = useState(value);
  // Adjusting state while rendering: a loaded value must not wait, and the
  // next keystroke must debounce from it, not from an older value.
  if (immediate && late !== value) setLate(value);
  useEffect(() => {
    if (immediate) return;
    const t = setTimeout(() => setLate(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, immediate]);
  return immediate ? value : late;
}
