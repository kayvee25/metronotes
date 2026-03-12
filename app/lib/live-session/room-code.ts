// Room code generation, formatting, and validation.
// 6 uppercase alphanumeric characters, avoiding ambiguous chars (0/O, 1/I/L).

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L

export function generateRoomCode(): string {
  const chars: string[] = [];
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (const byte of array) {
    chars.push(ALPHABET[byte % ALPHABET.length]);
  }
  return chars.join('');
}

/** Format for display: "ROCK42" → "ROC K42" */
export function formatRoomCode(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 6) return code;
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

/** Strip spaces, uppercase, validate length. Returns empty string if invalid. */
export function normalizeRoomCode(input: string): string {
  const cleaned = input.replace(/\s/g, '').toUpperCase();
  if (cleaned.length !== 6) return '';
  // Validate all chars are in our alphabet
  for (const char of cleaned) {
    if (!ALPHABET.includes(char)) return '';
  }
  return cleaned;
}
