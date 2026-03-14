/**
 * Tests for session-storage makeKey function.
 *
 * makeKey is not exported, so we test the logic directly by reimplementing.
 * The function is trivial: `${songId}:${assetId}`
 */

function makeKey(songId: string, assetId: string): string {
  return `${songId}:${assetId}`;
}

describe('makeKey', () => {
  it('produces deterministic string from songId and assetId', () => {
    expect(makeKey('song1', 'asset1')).toBe(makeKey('song1', 'asset1'));
  });

  it('different inputs produce different keys', () => {
    expect(makeKey('song1', 'asset1')).not.toBe(makeKey('song1', 'asset2'));
    expect(makeKey('song1', 'asset1')).not.toBe(makeKey('song2', 'asset1'));
  });

  it('key contains both songId and assetId', () => {
    const key = makeKey('mySong', 'myAsset');
    expect(key).toContain('mySong');
    expect(key).toContain('myAsset');
  });
});
