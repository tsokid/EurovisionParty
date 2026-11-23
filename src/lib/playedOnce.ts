// Animations that play once per browser (23 Nov 2026: «ΔΕ ΘΑ ΞΑΝΑΔΕΙΧΝΩ ΤΟ
// ANIMATION»). An animation counts as seen the moment it starts, even if the
// player leaves halfway: coming back (tab switch, refresh) shows the end
// state at once. Same rule as the winners finale (finaleSeenKey).

export const quizEndKey = (roomId: string, playerId: string, round: number) =>
  `eurovision-games-quiz-end-seen-${roomId}-${playerId}-${round}`;

export const quizCompleteKey = (roomId: string, playerId: string) =>
  `eurovision-games-quiz-complete-seen-${roomId}-${playerId}`;

export function wasPlayed(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export function markPlayed(key: string): void {
  try { localStorage.setItem(key, '1'); } catch { /* private mode: plays again, nothing breaks */ }
}
