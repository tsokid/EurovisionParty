// Telling a failed lazy-chunk load from a runtime error in the admin
// (AdminLoadBoundary shows different messages for the two).

const CHUNK_TAG = Symbol.for('eurovision.chunkLoadError');

type Tagged = Error & { [CHUNK_TAG]?: true };

/** The browsers' (and bundlers') messages for a failed dynamic import. */
const CHUNK_MESSAGE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

/** Tag an error from a lazy `import()`: `.catch((e) => { throw markChunkLoadError(e); })`. */
export function markChunkLoadError(e: unknown): Error {
  const error: Tagged = e instanceof Error ? e : new Error(String(e));
  error[CHUNK_TAG] = true;
  return error;
}

/** A failed chunk load: tagged by markChunkLoadError, or a known message. */
export function isChunkLoadError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if ((e as Tagged)[CHUNK_TAG]) return true;
  return CHUNK_MESSAGE.test(`${e.name}: ${e.message}`);
}
