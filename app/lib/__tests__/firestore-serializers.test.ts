/**
 * Tests for Firestore stroke serialization functions.
 *
 * These functions convert stroke point arrays [x,y,p] ↔ {x,y,p} objects
 * because Firestore rejects nested arrays.
 */

// Mock Firebase modules so we can import from firestore.ts without initializing Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('../utils', () => ({
  generateId: () => 'test-id',
  getTimestamp: () => '2026-01-01T00:00:00.000Z',
}));

vi.mock('../constants', () => ({
  STORAGE_KEYS: { SONGS: 'songs', SETLISTS: 'setlists', attachments: (id: string) => `attachments_${id}` },
}));

vi.mock('../guest-blob-storage', () => ({
  getAllGuestBlobs: vi.fn(),
  clearAllGuestBlobs: vi.fn(),
}));

vi.mock('../storage-firebase', () => ({
  uploadAttachmentFile: vi.fn(),
  getStoragePath: vi.fn(),
}));

import {
  transformStrokesForWrite,
  transformStrokesForRead,
  prepareForFirestoreWrite,
  restoreFromFirestoreRead,
  stripUndefined,
} from '../firestore';

describe('transformStrokesForWrite', () => {
  it('converts [x, y, p] arrays to {x, y, p} objects', () => {
    const strokes = [
      { id: '1', points: [[10, 20, 0.5], [30, 40, 0.8]], color: '#000', tool: 'pen' },
    ];
    const result = transformStrokesForWrite(strokes);
    expect(result[0]).toMatchObject({
      id: '1',
      color: '#000',
      tool: 'pen',
      points: [
        { x: 10, y: 20, p: 0.5 },
        { x: 30, y: 40, p: 0.8 },
      ],
    });
  });

  it('defaults pressure to 0.5 when missing', () => {
    const strokes = [{ id: '1', points: [[10, 20]], color: '#000', tool: 'pen' }];
    const result = transformStrokesForWrite(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).points[0].p).toBe(0.5);
  });

  it('handles empty strokes array', () => {
    expect(transformStrokesForWrite([])).toEqual([]);
  });

  it('handles stroke with no points', () => {
    const strokes = [{ id: '1', color: '#000', tool: 'pen' }];
    const result = transformStrokesForWrite(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).points).toEqual([]);
  });
});

describe('transformStrokesForRead', () => {
  it('converts {x, y, p} objects to [x, y, p] arrays', () => {
    const strokes = [
      { id: '1', points: [{ x: 10, y: 20, p: 0.5 }], color: '#000', tool: 'pen' },
    ];
    const result = transformStrokesForRead(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).points[0]).toEqual([10, 20, 0.5]);
  });

  it('passes through pre-migration [x, y, p] arrays unchanged', () => {
    const strokes = [
      { id: '1', points: [[10, 20, 0.5]], color: '#000', tool: 'pen' },
    ];
    const result = transformStrokesForRead(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).points[0]).toEqual([10, 20, 0.5]);
  });

  it('handles mixed format (some objects, some arrays)', () => {
    const strokes = [
      {
        id: '1',
        points: [
          { x: 10, y: 20, p: 0.5 },
          [30, 40, 0.8],
        ],
        color: '#000',
        tool: 'pen',
      },
    ];
    const result = transformStrokesForRead(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (result[0] as any).points;
    expect(points[0]).toEqual([10, 20, 0.5]);
    expect(points[1]).toEqual([30, 40, 0.8]);
  });

  it('defaults pressure to 0.5 when missing from object', () => {
    const strokes = [
      { id: '1', points: [{ x: 10, y: 20 }], color: '#000', tool: 'pen' },
    ];
    const result = transformStrokesForRead(strokes);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result[0] as any).points[0]).toEqual([10, 20, 0.5]);
  });
});

describe('round-trip serialization', () => {
  it('write then read produces original data', () => {
    const original = [
      {
        id: 'stroke-1',
        points: [[10, 20, 0.5], [30, 40, 0.8], [50, 60, 1.0]],
        color: '#ff0000',
        tool: 'pen',
      },
    ];
    const written = transformStrokesForWrite(original);
    const readBack = transformStrokesForRead(written);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((readBack[0] as any).points).toEqual(original[0].points);
  });
});

describe('prepareForFirestoreWrite', () => {
  it('transforms drawingData.strokes', () => {
    const data = {
      drawingData: {
        strokes: [{ id: '1', points: [[1, 2, 0.5]], color: '#000', tool: 'pen' }],
        canvasWidth: 100,
        canvasHeight: 100,
      },
    };
    const result = prepareForFirestoreWrite(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.drawingData as any).strokes[0].points[0]).toEqual({ x: 1, y: 2, p: 0.5 });
  });

  it('transforms annotations.strokes', () => {
    const data = {
      annotations: {
        strokes: [{ id: '1', points: [[1, 2, 0.5]], color: '#000', tool: 'pen' }],
        baseWidth: 100,
        baseHeight: 100,
      },
    };
    const result = prepareForFirestoreWrite(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.annotations as any).strokes[0].points[0]).toEqual({ x: 1, y: 2, p: 0.5 });
  });

  it('transforms pageAnnotations per page', () => {
    const data = {
      pageAnnotations: {
        '0': { strokes: [{ id: '1', points: [[1, 2, 0.5]], color: '#000', tool: 'pen' }], baseWidth: 100, baseHeight: 100 },
        '1': { strokes: [{ id: '2', points: [[3, 4, 0.7]], color: '#f00', tool: 'pen' }], baseWidth: 100, baseHeight: 100 },
      },
    };
    const result = prepareForFirestoreWrite(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pa = result.pageAnnotations as any;
    expect(pa['0'].strokes[0].points[0]).toEqual({ x: 1, y: 2, p: 0.5 });
    expect(pa['1'].strokes[0].points[0]).toEqual({ x: 3, y: 4, p: 0.7 });
  });

  it('passes through data without stroke fields unchanged', () => {
    const data = { name: 'test', bpm: 120 };
    expect(prepareForFirestoreWrite(data)).toEqual(data);
  });
});

describe('restoreFromFirestoreRead', () => {
  it('restores drawingData.strokes', () => {
    const data = {
      drawingData: {
        strokes: [{ id: '1', points: [{ x: 1, y: 2, p: 0.5 }], color: '#000', tool: 'pen' }],
        canvasWidth: 100,
        canvasHeight: 100,
      },
    };
    const result = restoreFromFirestoreRead(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.drawingData as any).strokes[0].points[0]).toEqual([1, 2, 0.5]);
  });
});

describe('stripUndefined', () => {
  it('removes undefined at top level', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: 'test' })).toEqual({ a: 1, c: 'test' });
  });

  it('removes undefined in nested objects', () => {
    expect(stripUndefined({ a: { b: undefined, c: 1 } })).toEqual({ a: { c: 1 } });
  });

  it('preserves null, 0, false, and empty string', () => {
    const input = { a: null, b: 0, c: false, d: '' };
    expect(stripUndefined(input)).toEqual(input);
  });

  it('handles arrays — strips undefined from objects inside arrays', () => {
    const input = { arr: [{ a: 1, b: undefined }, { c: 2 }] };
    expect(stripUndefined(input)).toEqual({ arr: [{ a: 1 }, { c: 2 }] });
  });

  it('preserves primitive array values including undefined', () => {
    const input = { arr: [1, undefined, 3] };
    const result = stripUndefined(input);
    expect(result.arr).toEqual([1, undefined, 3]);
  });
});
