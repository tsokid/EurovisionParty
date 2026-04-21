import { create } from 'zustand';

type AudioState = {
  muted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
};

const STORAGE_KEY = 'eurovision-games-muted';

function getInitialMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

function persist(muted: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

export const useAudioStore = create<AudioState>()((set) => ({
  muted: getInitialMuted(),
  toggleMute: () =>
    set((state) => {
      const next = !state.muted;
      persist(next);
      return { muted: next };
    }),
  setMuted: (muted) => {
    persist(muted);
    set({ muted });
  },
}));
