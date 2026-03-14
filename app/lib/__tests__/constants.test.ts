import { BPM, TIME_SIGNATURES, MUSICAL_KEYS, GUEST, AUDIO, STORAGE_KEYS } from '../constants';

describe('constants', () => {
  it('BPM.MIN < BPM.MAX', () => {
    expect(BPM.MIN).toBeLessThan(BPM.MAX);
  });

  it('BPM.DEFAULT is between MIN and MAX', () => {
    expect(BPM.DEFAULT).toBeGreaterThanOrEqual(BPM.MIN);
    expect(BPM.DEFAULT).toBeLessThanOrEqual(BPM.MAX);
  });

  it('TIME_SIGNATURES includes 4/4', () => {
    expect(TIME_SIGNATURES).toContain('4/4');
  });

  it('MUSICAL_KEYS includes C and has no duplicates', () => {
    expect(MUSICAL_KEYS).toContain('C');
    const unique = new Set(MUSICAL_KEYS);
    expect(unique.size).toBe(MUSICAL_KEYS.length);
  });

  it('GUEST.MAX_SONGS is a positive integer', () => {
    expect(GUEST.MAX_SONGS).toBeGreaterThan(0);
    expect(Number.isInteger(GUEST.MAX_SONGS)).toBe(true);
  });

  it('AUDIO.MAX_AUDIO_SIZE is positive', () => {
    expect(AUDIO.MAX_AUDIO_SIZE).toBeGreaterThan(0);
  });

  it('STORAGE_KEYS.attachments returns string containing songId', () => {
    const key = STORAGE_KEYS.attachments('test-song-123');
    expect(key).toContain('test-song-123');
    expect(typeof key).toBe('string');
  });
});
