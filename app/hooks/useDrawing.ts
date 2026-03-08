'use client';

import { useState, useCallback, useRef } from 'react';
import { Stroke, DrawingData } from '../types';

export type DrawingTool = 'pen' | 'eraser';

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7'] as const;
export type DrawingColor = typeof COLORS[number];
export { COLORS as DRAWING_COLORS };

interface UseDrawingOptions {
  initialData?: DrawingData | null;
  canvasWidth: number;
  canvasHeight: number;
}

export function useDrawing({ initialData, canvasWidth, canvasHeight }: UseDrawingOptions) {
  const [strokes, setStrokes] = useState<Stroke[]>(initialData?.strokes ?? []);
  const [activeTool, setActiveTool] = useState<DrawingTool>('pen');
  const [activeColor, setActiveColor] = useState<DrawingColor>(COLORS[0]);
  const currentPointsRef = useRef<Array<[number, number, number]>>([]);
  const [currentPoints, setCurrentPoints] = useState<Array<[number, number, number]>>([]);
  const [initialStrokeIds] = useState(() => (initialData?.strokes ?? []).map(s => s.id));

  const isDirty = strokes.length !== initialStrokeIds.length ||
    strokes.some((s, i) => s.id !== initialStrokeIds[i]);

  const startStroke = useCallback((point: [number, number, number]) => {
    currentPointsRef.current = [point];
    setCurrentPoints([point]);
  }, []);

  const addPoint = useCallback((point: [number, number, number]) => {
    currentPointsRef.current.push(point);
    setCurrentPoints([...currentPointsRef.current]);
  }, []);

  const endStroke = useCallback(() => {
    if (currentPointsRef.current.length < 2) {
      currentPointsRef.current = [];
      setCurrentPoints([]);
      return;
    }

    const stroke: Stroke = {
      id: crypto.randomUUID(),
      points: currentPointsRef.current,
      color: activeColor,
      tool: 'pen',
    };

    setStrokes(prev => [...prev, stroke]);
    currentPointsRef.current = [];
    setCurrentPoints([]);
  }, [activeColor]);

  const undo = useCallback(() => {
    setStrokes(prev => prev.slice(0, -1));
  }, []);

  const clearAll = useCallback(() => {
    setStrokes([]);
  }, []);

  const erase = useCallback((strokeId: string) => {
    setStrokes(prev => prev.filter(s => s.id !== strokeId));
  }, []);

  const getDrawingData = useCallback((): DrawingData => ({
    strokes,
    canvasWidth,
    canvasHeight,
  }), [strokes, canvasWidth, canvasHeight]);

  return {
    strokes,
    currentPoints,
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    isDirty,
    startStroke,
    addPoint,
    endStroke,
    undo,
    clearAll,
    erase,
    getDrawingData,
  };
}
