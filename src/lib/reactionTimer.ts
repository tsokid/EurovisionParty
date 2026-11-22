// Reaction timer for quiz and duel answers.
//
// Measured on the device with performance.now() (monotonic, immune to the
// phone's wall-clock offset from the server). It starts when the answer
// buttons become tappable (after the question's entrance animation) and stops
// at the tap, so the reveal / advance delays, the chip hold, network latency
// and clock skew no longer count as "thinking time".

export interface ReactionTimer {
  /** Starts the clock. Ignored when it is already running or stopped. */
  start(): void;
  /**
   * Stops the clock and returns the whole milliseconds since start. Repeated
   * calls return the same value. Returns null when start() never ran.
   */
  stop(): number | null;
  /** Milliseconds so far (frozen after stop), or null before start. */
  elapsed(): number | null;
  /** Back to the initial state, for the next question. */
  reset(): void;
  readonly started: boolean;
}

export function createReactionTimer(now: () => number = () => performance.now()): ReactionTimer {
  let startedAt: number | null = null;
  let frozen: number | null = null;
  const ms = (end: number) => Math.max(0, Math.round(end - (startedAt as number)));
  return {
    start() {
      if (startedAt !== null) return;
      startedAt = now();
    },
    stop() {
      if (startedAt === null) return null;
      if (frozen === null) frozen = ms(now());
      return frozen;
    },
    elapsed() {
      if (startedAt === null) return null;
      return frozen ?? ms(now());
    },
    reset() {
      startedAt = null;
      frozen = null;
    },
    get started() {
      return startedAt !== null;
    },
  };
}

/** PostgREST "no function matches these arguments" (PGRST202): the database
 *  predates migration 083, so the client retries without p_response_ms. */
export function isMissingRpcSignature(err: { code?: string } | null | undefined): boolean {
  return err?.code === 'PGRST202';
}
