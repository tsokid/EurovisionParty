// Around the lazy admin chunk, and the admin itself:
// - Chunk-load error: after a deploy, a tab opened before it asks for an
//   AdminRoute-<old hash>.js that no longer exists, and the lazy import
//   rejects. Instead of a blank page, offer a reload (which fetches the new
//   index.html and chunk names).
// - Runtime error: a bug while rendering the admin. Say so, with its message,
//   rather than blaming a deploy; a reload is still the way out.
import { Component, type ReactNode } from 'react';
import { isChunkLoadError } from './chunkLoadError';

export const ADMIN_LOAD_ERROR = 'The admin could not be loaded. The site may have just been updated.';
export const ADMIN_RUNTIME_ERROR = 'Something went wrong in the admin';

type Props = { children: ReactNode; reload?: () => void };

export class AdminLoadBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reload = this.props.reload ?? (() => window.location.reload());
    const chunk = isChunkLoadError(error);
    return (
      <div role="alert" className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[rgb(10,5,25)] p-6 text-center text-white">
        {chunk ? (
          <>
            <p>{ADMIN_LOAD_ERROR}</p>
            <p className="text-xs text-white/50 break-all">{error.message}</p>
          </>
        ) : (
          <p className="break-words">{`${ADMIN_RUNTIME_ERROR}: ${error.message}`}</p>
        )}
        <button type="button" onClick={reload} className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm cursor-pointer">
          Reload
        </button>
      </div>
    );
  }
}
