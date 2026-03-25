/**
 * Characters used for room codes.
 * Excludes ambiguous glyphs: 0/O, 1/I/L
 */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generate a 6-character uppercase room code (letters + numbers).
 *
 * @returns A string like "K3PW7X", "EUR6HA", etc.
 */
export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}
