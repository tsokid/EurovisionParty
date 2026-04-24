import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { crashed: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="min-h-svh bg-euro-gradient flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="text-5xl">😵</div>
          <div>
            <p className="text-white font-bold text-lg mb-1">Something went wrong</p>
            <p className="text-white/50 text-sm mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => { localStorage.removeItem('europarty_rooms'); window.location.href = '/'; }}
              className="px-5 py-2.5 rounded-xl bg-euro-purple/50 text-white text-sm font-semibold"
            >
              Clear cache &amp; reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
