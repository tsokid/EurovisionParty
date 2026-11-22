import { create } from 'zustand';

type AudioState = {
  muted: boolean;
  /** Reel / sequence sound cues (synthesised). Opt-in: off until the player turns them on. */
  cues: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setCues: (on: boolean) => void;
};

const STORAGE_KEY = 'eurovision-games-muted';
const CUES_KEY = 'eurovision-games-cues';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, v); } catch { /* ignore */ }
}

export const useAudioStore = create<AudioState>()((set) => ({
  muted: read(STORAGE_KEY) === '1',
  cues: read(CUES_KEY) === '1',
  toggleMute: () =>
    set((state) => {
      const next = !state.muted;
      write(STORAGE_KEY, next ? '1' : '0');
      return { muted: next };
    }),
  setMuted: (muted) => {
    write(STORAGE_KEY, muted ? '1' : '0');
    set({ muted });
  },
  setCues: (on) => {
    write(CUES_KEY, on ? '1' : '0');
    set({ cues: on });
  },
}));
