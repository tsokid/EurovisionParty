// A background tab sends nothing: the timer runs only while the tab is visible.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { visibleInterval } from '../../src/lib/visibleInterval';

let state: DocumentVisibilityState = 'visible';
const setVisibility = (s: DocumentVisibilityState) => {
  state = s;
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('visibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('ticks while visible', () => {
    const fn = vi.fn();
    const stop = visibleInterval(fn, 1000);
    vi.advanceTimersByTime(3500);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
  });

  it('a hidden tab never ticks, and runs once on return', () => {
    const fn = vi.fn();
    const stop = visibleInterval(fn, 1000);
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(0);
    setVisibility('visible');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops for good after cleanup', () => {
    const fn = vi.fn();
    const stop = visibleInterval(fn, 1000);
    stop();
    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('jitter keeps each wait within ±half the jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fn = vi.fn();
    const stop = visibleInterval(fn, 1000, { jitter: 0.5 });
    vi.advanceTimersByTime(749);
    expect(fn).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});
