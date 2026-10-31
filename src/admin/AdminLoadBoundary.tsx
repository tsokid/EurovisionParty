// Around the lazy admin chunk: after a deploy, a tab opened before it asks
// for an AdminRoute-<old hash>.js that no longer exists, and the lazy import
// rejects. Instead of a blank page, offer a reload (which fetches the new
// index.html and chunk names).
import { Component, type ReactNode } from 'react';

export const ADMIN_LOAD_ERROR = 'The admin could not be loaded. The site may have just been updated.';

type Props = { children: ReactNode; reload?: () => void };

export class AdminLoadBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const reload = this.props.reload ?? (() => window.location.reload());
    return (
      <div role="alert" className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[rgb(10,5,25)] p-6 text-center text-white">
        <p>{ADMIN_LOAD_ERROR}</p>
        <p className="text-xs text-white/50 break-all">{this.state.error.message}</p>
        <button type="button" onClick={reload} className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold text-sm cursor-pointer">
          Reload
        </button>
      </div>
    );
  }
}
