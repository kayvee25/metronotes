import { renderHook, act } from '@testing-library/react';
import { useDrawing, DRAWING_COLORS } from '../useDrawing';
import type { DrawingData } from '../../types';

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

describe('useDrawing', () => {
  const defaultOptions = { canvasWidth: 800, canvasHeight: 600 };

  beforeEach(() => {
    uuidCounter = 0;
  });

  describe('initial state', () => {
    it('starts with empty strokes when no initialData', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      expect(result.current.strokes).toEqual([]);
    });

    it('starts with pen as active tool', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      expect(result.current.activeTool).toBe('pen');
    });

    it('starts with black as active color', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      expect(result.current.activeColor).toBe('#000000');
    });

    it('starts with empty currentPoints', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      expect(result.current.currentPoints).toEqual([]);
    });

    it('is not dirty when no changes', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      expect(result.current.isDirty).toBe(false);
    });

    it('loads initial strokes from initialData', () => {
      const initialData: DrawingData = {
        strokes: [
          { id: 'stroke-1', points: [[0, 0, 0.5], [10, 10, 0.5]], color: '#000000', tool: 'pen' },
        ],
        canvasWidth: 800,
        canvasHeight: 600,
      };

      const { result } = renderHook(() => useDrawing({ ...defaultOptions, initialData }));
      expect(result.current.strokes).toHaveLength(1);
      expect(result.current.strokes[0].id).toBe('stroke-1');
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('drawing a stroke', () => {
    it('tracks current points during a stroke', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([10, 20, 0.5]);
      });
      expect(result.current.currentPoints).toEqual([[10, 20, 0.5]]);

      act(() => {
        result.current.addPoint([30, 40, 0.7]);
      });
      expect(result.current.currentPoints).toEqual([[10, 20, 0.5], [30, 40, 0.7]]);
    });

    it('creates a stroke on endStroke with 2+ points', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([10, 20, 0.5]);
        result.current.addPoint([30, 40, 0.7]);
      });

      act(() => {
        result.current.endStroke();
      });

      expect(result.current.strokes).toHaveLength(1);
      expect(result.current.strokes[0].points).toEqual([[10, 20, 0.5], [30, 40, 0.7]]);
      expect(result.current.strokes[0].color).toBe('#000000');
      expect(result.current.strokes[0].tool).toBe('pen');
      expect(result.current.currentPoints).toEqual([]);
    });

    it('discards stroke with fewer than 2 points', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([10, 20, 0.5]);
      });

      act(() => {
        result.current.endStroke();
      });

      expect(result.current.strokes).toHaveLength(0);
      expect(result.current.currentPoints).toEqual([]);
    });

    it('uses active color for new strokes', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.setActiveColor('#ef4444');
      });

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });

      act(() => {
        result.current.endStroke();
      });

      expect(result.current.strokes[0].color).toBe('#ef4444');
    });
  });

  describe('isDirty', () => {
    it('is dirty after adding a stroke', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });

      act(() => {
        result.current.endStroke();
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('is dirty after removing a stroke from initial data', () => {
      const initialData: DrawingData = {
        strokes: [
          { id: 'stroke-1', points: [[0, 0, 0.5], [10, 10, 0.5]], color: '#000000', tool: 'pen' },
        ],
        canvasWidth: 800,
        canvasHeight: 600,
      };

      const { result } = renderHook(() => useDrawing({ ...defaultOptions, initialData }));

      act(() => {
        result.current.undo();
      });

      expect(result.current.isDirty).toBe(true);
    });
  });

  describe('undo', () => {
    it('removes the last stroke', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      // Draw two strokes
      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      act(() => {
        result.current.startStroke([20, 20, 0.5]);
        result.current.addPoint([30, 30, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      expect(result.current.strokes).toHaveLength(2);

      act(() => {
        result.current.undo();
      });

      expect(result.current.strokes).toHaveLength(1);
    });

    it('does nothing when no strokes', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.undo();
      });

      expect(result.current.strokes).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('removes all strokes', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      act(() => {
        result.current.startStroke([20, 20, 0.5]);
        result.current.addPoint([30, 30, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.strokes).toHaveLength(0);
    });
  });

  describe('erase', () => {
    it('removes a stroke by id', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      const strokeId = result.current.strokes[0].id;

      act(() => {
        result.current.erase(strokeId);
      });

      expect(result.current.strokes).toHaveLength(0);
    });

    it('does not remove other strokes', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      act(() => {
        result.current.startStroke([20, 20, 0.5]);
        result.current.addPoint([30, 30, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      const firstStrokeId = result.current.strokes[0].id;

      act(() => {
        result.current.erase(firstStrokeId);
      });

      expect(result.current.strokes).toHaveLength(1);
    });

    it('does nothing with non-existent id', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      act(() => {
        result.current.erase('non-existent');
      });

      expect(result.current.strokes).toHaveLength(1);
    });
  });

  describe('setActiveTool', () => {
    it('switches to eraser', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.setActiveTool('eraser');
      });

      expect(result.current.activeTool).toBe('eraser');
    });
  });

  describe('setActiveColor', () => {
    it('changes the active color', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.setActiveColor('#3b82f6');
      });

      expect(result.current.activeColor).toBe('#3b82f6');
    });
  });

  describe('getDrawingData', () => {
    it('returns current drawing data with canvas dimensions', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));

      act(() => {
        result.current.startStroke([0, 0, 0.5]);
        result.current.addPoint([10, 10, 0.5]);
      });
      act(() => { result.current.endStroke(); });

      const data = result.current.getDrawingData();
      expect(data.canvasWidth).toBe(800);
      expect(data.canvasHeight).toBe(600);
      expect(data.strokes).toHaveLength(1);
    });

    it('returns empty strokes when nothing drawn', () => {
      const { result } = renderHook(() => useDrawing(defaultOptions));
      const data = result.current.getDrawingData();
      expect(data.strokes).toEqual([]);
      expect(data.canvasWidth).toBe(800);
      expect(data.canvasHeight).toBe(600);
    });
  });

  describe('DRAWING_COLORS', () => {
    it('exports the color palette', () => {
      expect(DRAWING_COLORS).toContain('#000000');
      expect(DRAWING_COLORS).toContain('#ef4444');
      expect(DRAWING_COLORS.length).toBe(6);
    });
  });
});
