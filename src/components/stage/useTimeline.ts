import { useCallback, useEffect, useRef } from 'react';

/**
 * setTimeout scheduler for motion sequences (the prototypes' `at(ms, fn)`).
 * `clear()` cancels everything pending (Skip, replay); unmount clears too.
 */
export function useTimeline() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => clear, [clear]);
  return { at, clear };
}
