'use client';

import type * as PDFJSType from 'pdfjs-dist';

let pdfjsPromise: Promise<typeof PDFJSType> | null = null;

export function loadPdfJs(): Promise<typeof PDFJSType> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}
