'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ReaderSettings } from '@/lib/db';

interface PdfViewerProps {
  url: string;
  bookId: string;
  initialPage: number;
  settings: ReaderSettings;
  onPageChange: (currentPage: number, totalPages: number) => void;
  onBookmarkToggle?: () => void;
  onToggleFullscreen?: () => void;
  targetPage?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  bookId,
  initialPage,
  settings,
  onPageChange,
  onBookmarkToggle,
  onToggleFullscreen,
  targetPage
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const pagesRenderedRef = useRef<{ [key: number]: boolean }>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize PDF.js and Load Document
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);

        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const loadingTask = pdfjs.getDocument({ url });
        const doc = await loadingTask.promise;

        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);

        const startPage = Math.min(doc.numPages, Math.max(1, initialPage || 1));
        setCurrentPage(startPage);
        onPageChange(startPage, doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError(err.message || 'Could not load PDF document');
          setLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Handle external jump target page
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  // Save Progress Function (Debounced & Immediate)
  const saveProgress = useCallback((pageToSave: number, total: number) => {
    if (!bookId || !total) return;
    const progress = Math.min(100, Math.round((pageToSave / total) * 100 * 10) / 10);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      fetch('/api/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          currentPage: pageToSave,
          progressPercentage: progress,
          pageCount: total
        }),
        keepalive: true
      }).catch(err => console.warn('Failed to auto-save progress:', err));
    }, 1000);
  }, [bookId]);

  // Immediately save on page change
  useEffect(() => {
    if (numPages > 0) {
      onPageChange(currentPage, numPages);
      saveProgress(currentPage, numPages);
    }
  }, [currentPage, numPages, saveProgress]);

  // Save on tab hide / unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && numPages > 0) {
        const progress = Math.min(100, Math.round((currentPage / numPages) * 100 * 10) / 10);
        navigator.sendBeacon('/api/progress', JSON.stringify({
          bookId,
          currentPage,
          progressPercentage: progress,
          pageCount: numPages
        }));
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleVisibilityChange);
    };
  }, [bookId, currentPage, numPages]);

  // Render Page to Canvas
  const renderSinglePage = useCallback(async (pageNum: number, canvasEl: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const scale = settings.zoom || 1.0;
      const viewport = page.getViewport({ scale: scale * 1.5 });

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      canvasEl.height = viewport.height;
      canvasEl.width = viewport.width;

      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (e) {
      console.warn(`Error rendering page ${pageNum}:`, e);
    }
  }, [pdfDoc, settings.zoom]);

  // Render Canvas when Paged Mode or Current Page Changes
  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (pdfDoc && settings.reading_mode === 'paged' && singleCanvasRef.current) {
      renderSinglePage(currentPage, singleCanvasRef.current);
    }
  }, [pdfDoc, currentPage, settings.reading_mode, settings.zoom, renderSinglePage]);

  // Continuous Mode Render All Pages
  useEffect(() => {
    if (pdfDoc && settings.reading_mode === 'continuous' && containerRef.current) {
      const pageContainers = containerRef.current.querySelectorAll('[data-page-num]');
      pageContainers.forEach(container => {
        const pNum = parseInt(container.getAttribute('data-page-num') || '0', 10);
        const canvas = container.querySelector('canvas');
        if (pNum && canvas) {
          renderSinglePage(pNum, canvas);
        }
      });
    }
  }, [pdfDoc, settings.reading_mode, settings.zoom, renderSinglePage]);

  // IntersectionObserver for Continuous Scroll Page Tracking
  useEffect(() => {
    if (settings.reading_mode !== 'continuous' || !containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pNum = parseInt(entry.target.getAttribute('data-page-num') || '0', 10);
            if (pNum && pNum !== currentPage) {
              setCurrentPage(pNum);
            }
          }
        });
      },
      { threshold: 0.4 }
    );

    const pageEls = containerRef.current.querySelectorAll('[data-page-num]');
    pageEls.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [settings.reading_mode, numPages]);

  // Scroll to current page when page or mode changes
  useEffect(() => {
    if (settings.reading_mode === 'continuous' && containerRef.current) {
      const pageEl = containerRef.current.querySelector(`[data-page-num="${currentPage}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [targetPage]);

  // Theme & Width helper styles
  const widthClasses = {
    compact: 'max-w-2xl',
    comfortable: 'max-w-4xl',
    wide: 'max-w-6xl',
    full: 'max-w-full px-4'
  }[settings.page_width] || 'max-w-4xl';

  const themeBgClasses = {
    light: 'bg-stone-50 text-stone-900',
    sepia: 'bg-[#f8f1e5] text-[#433422]',
    dark: 'bg-[#0f1115] text-stone-100'
  }[settings.theme] || 'bg-stone-50 text-stone-900';

  const canvasFilterClass = {
    light: '',
    sepia: 'sepia-pdf-canvas',
    dark: 'dark-pdf-canvas'
  }[settings.theme] || '';

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${themeBgClasses}`}>
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="font-serif text-base font-medium opacity-70">Opening your book...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${themeBgClasses}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold">Could not load PDF</h3>
        <p className="text-sm opacity-70 text-center max-w-md mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pt-16 pb-24 transition-colors duration-300 relative ${themeBgClasses}`}>
      {/* Brightness Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-30 transition-opacity"
        style={{
          backgroundColor: 'black',
          opacity: 1 - Math.max(0.2, Math.min(1.0, settings.brightness))
        }}
      />

      <div className={`mx-auto ${widthClasses} transition-all duration-300`} ref={containerRef}>
        {settings.reading_mode === 'paged' ? (
          /* Single Page Mode */
          <div className="flex flex-col items-center justify-center my-6">
            <div className="shadow-2xl rounded-sm overflow-hidden bg-white">
              <canvas ref={singleCanvasRef} className={`max-w-full h-auto ${canvasFilterClass}`} />
            </div>
            <div className="mt-4 text-xs font-mono opacity-60">
              Page {currentPage} of {numPages}
            </div>
          </div>
        ) : (
          /* Continuous Scroll Mode */
          <div className="space-y-8 my-6 flex flex-col items-center">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pNum => (
              <div
                key={pNum}
                data-page-num={pNum}
                className="shadow-2xl rounded-sm overflow-hidden bg-white w-full flex flex-col items-center"
              >
                <canvas className={`max-w-full h-auto ${canvasFilterClass}`} />
                <div className="py-2 text-[11px] font-mono opacity-40">
                  Page {pNum} of {numPages}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
