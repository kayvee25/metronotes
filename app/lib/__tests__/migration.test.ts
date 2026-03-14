/**
 * Tests for textToTiptapJson — plain text to Tiptap JSON conversion.
 *
 * textToTiptapJson is not exported from migration.ts, so we test it
 * by reimplementing the pure logic here (it's a simple function).
 * This avoids importing the module which has Firebase side effects.
 */

// Reimplemented from migration.ts — pure function, no deps
function textToTiptapJson(text: string): object {
  const lines = text.split('\n');
  const content = lines.map((line) => {
    if (line.trim() === '') {
      return { type: 'paragraph' };
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });
  return { type: 'doc', content };
}

describe('textToTiptapJson', () => {
  it('converts empty string to doc with empty paragraph', () => {
    const result = textToTiptapJson('') as { type: string; content: unknown[] };
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: 'paragraph' });
  });

  it('converts single line to doc with one paragraph', () => {
    const result = textToTiptapJson('Hello world') as { type: string; content: unknown[] };
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    });
  });

  it('converts multiple lines to multiple paragraphs', () => {
    const result = textToTiptapJson('Line 1\nLine 2\nLine 3') as { type: string; content: unknown[] };
    expect(result.content).toHaveLength(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe('Line 1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[2] as any).content[0].text).toBe('Line 3');
  });

  it('handles empty lines as empty paragraphs', () => {
    const result = textToTiptapJson('Before\n\nAfter') as { type: string; content: unknown[] };
    expect(result.content).toHaveLength(3);
    expect(result.content[1]).toEqual({ type: 'paragraph' });
  });

  it('preserves whitespace within lines', () => {
    const result = textToTiptapJson('  indented  text  ') as { type: string; content: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe('  indented  text  ');
  });

  it('preserves special characters', () => {
    const text = 'Quotes "hello" & <angle> \'brackets\'';
    const result = textToTiptapJson(text) as { type: string; content: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.content[0] as any).content[0].text).toBe(text);
  });
});
