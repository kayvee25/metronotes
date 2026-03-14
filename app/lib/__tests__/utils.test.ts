import { generateId, getTimestamp } from '../utils';

describe('generateId', () => {
  it('returns a string in UUID v4 format', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});

describe('getTimestamp', () => {
  it('returns a valid ISO 8601 string', () => {
    const ts = getTimestamp();
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(ts).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('returns a date parseable by Date constructor', () => {
    const ts = getTimestamp();
    const parsed = new Date(ts);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('returns a timestamp close to now', () => {
    const before = Date.now();
    const ts = getTimestamp();
    const after = Date.now();
    const parsed = new Date(ts).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
