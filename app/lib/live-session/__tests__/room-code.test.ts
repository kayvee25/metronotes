import { generateRoomCode, formatRoomCode, normalizeRoomCode } from '../room-code';

describe('formatRoomCode', () => {
  it('formats 6-char string as "XXX XXX"', () => {
    expect(formatRoomCode('ABCDEF')).toBe('ABC DEF');
  });

  it('handles already-formatted input', () => {
    expect(formatRoomCode('ABC DEF')).toBe('ABC DEF');
  });

  it('returns original if invalid length after normalization', () => {
    expect(formatRoomCode('ABC')).toBe('ABC');
  });
});

describe('normalizeRoomCode', () => {
  it('strips spaces and uppercases', () => {
    expect(normalizeRoomCode('abc def')).toBe('ABCDEF');
  });

  it('returns empty string for wrong length', () => {
    expect(normalizeRoomCode('ABC')).toBe('');
    expect(normalizeRoomCode('ABCDEFGH')).toBe('');
  });

  it('returns empty string for invalid characters', () => {
    // 0, O, 1, I, L are excluded from the alphabet
    expect(normalizeRoomCode('ABCD0O')).toBe('');
  });

  it('accepts valid characters', () => {
    expect(normalizeRoomCode('ABC234')).toBe('ABC234');
  });
});

describe('generateRoomCode', () => {
  it('returns 6-character string', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('contains only valid characters (no ambiguous chars)', () => {
    const validChars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 10; i++) {
      const code = generateRoomCode();
      for (const char of code) {
        expect(validChars).toContain(char);
      }
    }
  });

  it('produces different codes across multiple calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      codes.add(generateRoomCode());
    }
    // With 30^6 ≈ 729M possibilities, 10 codes should all be unique
    expect(codes.size).toBeGreaterThan(1);
  });
});
