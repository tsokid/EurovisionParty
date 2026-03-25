import { create } from 'zustand';
import type { Room, Player, Notification, TabId, QuizAnswer, QuizQuestion } from '../lib/types';

/** Persisted quiz progress — survives tab switches (in-memory) */
export interface QuizProgress {
  roomId: string;
  playerId: string;
  phase: 'waiting' | 'intro' | 'playing' | 'results' | 'complete';
  roundNumber: number;
  questionIndex: number;
  /** Question IDs for current round — reconstructed into QuizQuestion[] on restore */
  questionIds: number[];
  usedQuestionIds: number[];
  roundAnswers: QuizAnswer[];
}

interface GameState {
  // --- State ---
  room: Room | null;
  player: Player | null;
  players: Player[];
  notifications: Notification[];
  activeTab: TabId;
  isLoading: boolean;
  error: string | null;
  /** Plain-text password kept in memory for sharing invites */
  roomPassword: string | null;
  /** Quiz progress — persists across tab switches */
  quizProgress: QuizProgress | null;

  // --- Actions ---
  setRoom: (room: Room | null) => void;
  setPlayer: (player: Player | null) => void;
  setRoomPassword: (password: string | null) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (partial: Partial<Player>) => void;
  addNotification: (notif: Notification) => void;
  markNotificationRead: (id: string) => void;
  setActiveTab: (tab: TabId) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setQuizProgress: (progress: QuizProgress | null) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  player: null,
  players: [],
  notifications: [],
  activeTab: 'quiz' as TabId,
  isLoading: false,
  error: null,
  roomPassword: null,
  quizProgress: null as QuizProgress | null,
};

export const useGameStore = create<GameState>()((set) => ({
  ...initialState,

  setRoom: (room) => set({ room }),

  setPlayer: (player) => set({ player }),

  setRoomPassword: (roomPassword) => set({ roomPassword }),

  setPlayers: (players) =>
    set({
      players: [...players].sort((a, b) => b.total_points - a.total_points),
    }),

  updatePlayer: (partial) =>
    set((state) => ({
      player: state.player ? { ...state.player, ...partial } : null,
    })),

  addNotification: (notif) =>
    set((state) => {
      // Deduplication: skip if already exists
      if (state.notifications.some((n) => n.id === notif.id)) return state;
      // Cap at 100 notifications
      const updated = [notif, ...state.notifications].slice(0, 100);
      return { notifications: updated };
    }),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
    })),

  setActiveTab: (activeTab) => set({ activeTab }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setQuizProgress: (quizProgress) => set({ quizProgress }),

  reset: () => set(initialState),
}));
