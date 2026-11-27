// 097: a vote or match closed by a client whose clock runs fast gets
// 'too_early' from the server; the client retries until it is due.
import { describe, it, expect, vi } from 'vitest';
import { callWhenDue } from '../../src/lib/callWhenDue';

describe('callWhenDue', () => {
  it('retries while the server says too_early, then returns the result', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'too_early' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'too_early' } })
      .mockResolvedValueOnce({ data: 'accept', error: null });
    const res = await callWhenDue(call, { delayMs: 1 });
    expect(res.data).toBe('accept');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors, and gives up after the last try', async () => {
    const other = vi.fn().mockResolvedValue({ data: null, error: { message: 'not a member of this room' } });
    expect((await callWhenDue(other, { delayMs: 1 })).error?.message).toMatch(/not a member/);
    expect(other).toHaveBeenCalledTimes(1);

    const early = vi.fn().mockResolvedValue({ data: null, error: { message: 'too_early' } });
    await callWhenDue(early, { tries: 3, delayMs: 1 });
    expect(early).toHaveBeenCalledTimes(3);
  });
});
