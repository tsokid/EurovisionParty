/**
 * Lightweight profanity filter for player names.
 * Blocks common offensive words in English, Greek, and general slurs.
 * Not exhaustive — meant to catch obvious abuse, not be a full moderation system.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  // English profanity (common)
  /\b(f+u+c+k+|sh+i+t+|a+s+s+h+o+l+e|b+i+t+c+h|d+i+c+k|c+u+n+t|n+i+g+g+|f+a+g+|r+e+t+a+r+d|w+h+o+r+e|s+l+u+t)\b/i,
  // Leet speak variants
  /\b(f[u*@]ck|sh[i1!]t|b[i1!]tch|d[i1!]ck|a[s$]{2})\b/i,
  // Slurs and hate speech
  /\b(nazi|hitler|kkk|jihad)\b/i,
  // Sexual content
  /\b(porn|xxx|penis|vagina|dildo)\b/i,
  // Greek profanity (common). Word stems matched at the start of a word with
  // a Unicode boundary: `\b` only knows ASCII letters, so the old `\b…\b`
  // form never matched Greek at all.
  /(?<!\p{L})(μαλάκ|γαμ[ωώ]|πούτ|αρχίδ|καριόλ|πουτάν|σκατ[αά]|μουν[ιί]|ψώλ|γκαντέμ|βλάκ)/iu,
];

/**
 * Check if a name contains blocked content.
 * Returns true if the name is clean, false if blocked.
 */
export function isNameClean(name: string): boolean {
  const normalized = name
    .replace(/[_\-.]/g, '') // Remove separators that might break up words
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');

  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export type NameErrorCode = 'tooShort' | 'tooLong' | 'blocked';

/** Length limits: stage name (players.name, rejoin key) and secret real name (player_secrets). */
export const STAGE_NAME_LIMITS = { min: 2, max: 20 } as const;
export const REAL_NAME_LIMITS = { min: 1, max: 50 } as const;

/** Length and content check; null when valid. */
export function checkName(name: string, limits: { min: number; max: number }): NameErrorCode | null {
  const trimmed = name.trim();
  if (trimmed.length < limits.min) return 'tooShort';
  if (trimmed.length > limits.max) return 'tooLong';
  if (!isNameClean(trimmed)) return 'blocked';
  return null;
}

/** Stage name check (2–20 chars, filtered). */
export function checkStageName(name: string): NameErrorCode | null {
  return checkName(name, STAGE_NAME_LIMITS);
}

/** Real name check (required, 1–50 chars, filtered). Kept secret until the end of the game. */
export function validateRealName(name: string): NameErrorCode | null {
  return checkName(name, REAL_NAME_LIMITS);
}

/**
 * Validate a player name: length, characters, and content.
 * Returns null if valid, or an error message string.
 */
export function validateName(name: string): string | null {
  switch (checkStageName(name)) {
    case 'tooShort': return 'Name must be at least 2 characters';
    case 'tooLong': return 'Name must be 20 characters or less';
    case 'blocked': return 'Please choose a different name';
    default: return null; // valid
  }
}
