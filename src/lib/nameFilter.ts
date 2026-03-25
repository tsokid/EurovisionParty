/**
 * Lightweight profanity filter for player names.
 * Blocks common offensive words in English, Greek, and general slurs.
 * Not exhaustive — meant to catch obvious abuse, not be a full moderation system.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  // English profanity (common)
  /\b(f+u+c+k+|sh+i+t+|a+s+s+h+o+l+e|b+i+t+c+h|d+i+c+k|c+u+n+t|n+i+g+g+|f+a+g+|r+e+t+a+r+d|w+h+o+r+e|s+l+u+t)\b/i,
  // Leet speak variants
  /\b(f[u\*@]ck|sh[i1!]t|b[i1!]tch|d[i1!]ck|a[s\$]{2})\b/i,
  // Slurs and hate speech
  /\b(nazi|hitler|kkk|jihad)\b/i,
  // Sexual content
  /\b(porn|xxx|penis|vagina|dildo)\b/i,
  // Greek profanity (common)
  /\b(μαλάκ|γαμ[ωώ]|πούτ|αρχίδ|καριόλ|πουτάν|σκατ[αά]|μουν[ιί]|ψώλ|γκαντέμ|βλάκ)\b/i,
];

/**
 * Check if a name contains blocked content.
 * Returns true if the name is clean, false if blocked.
 */
export function isNameClean(name: string): boolean {
  const normalized = name
    .replace(/[_\-\.]/g, '') // Remove separators that might break up words
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a');

  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Validate a player name: length, characters, and content.
 * Returns null if valid, or an error message string.
 */
export function validateName(name: string): string | null {
  const trimmed = name.trim();

  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > 20) return 'Name must be 20 characters or less';
  if (!isNameClean(trimmed)) return 'Please choose a different name';

  return null; // valid
}
