'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ReaderSettings } from '@/lib/db';
import { getApiUrl, getAssetUrl } from '@/lib/config';
import { getPdfArrayBuffer } from '@/lib/pdfCache';

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

interface SinglePageCanvasProps {
  pdfDoc: any;
  pageNum: number;
  zoom: number;
  canvasFilterClass: string;
  numPages: number;
}

const SinglePageCanvas: React.FC<SinglePageCanvasProps> = ({
  pdfDoc,
  pageNum,
  zoom,
  canvasFilterClass,
  numPages,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [rendering, setRendering] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    async function render() {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel any ongoing render task for this canvas
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
        renderTaskRef.current = null;
      }

      try {
        setRendering(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled || !canvasRef.current) return;

        // Cap scale to prevent massive canvas GPU memory allocation on high-DPI mobile
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const scale = (zoom || 1.0) * dpr;
        const viewport = page.getViewport({ scale: scale * 1.2 });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setRendering(false);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.warn(`Page ${pageNum} render error:`, err);
          setRendering(false);
        }
      }
    }

    render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      // Release GPU canvas memory on unmount
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, [pdfDoc, pageNum, zoom]);

  return (
    <div className="relative w-full flex flex-col items-center min-h-75 justify-center">
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100/50 dark:bg-stone-900/50 backdrop-blur-[1px] z-10 rounded">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 opacity-60" />
        </div>
      )}
      <canvas ref={canvasRef} className={`max-w-full h-auto shadow-md ${canvasFilterClass}`} />
      <div className="py-2 text-[11px] font-mono opacity-40">
        Page {pageNum} of {numPages}
      </div>
    </div>
  );
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  bookId,
  initialPage,
  settings,
  onPageChange,
  onBookmarkToggle,
  onToggleFullscreen,
  targetPage,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [aspectRatio, setAspectRatio] = useState<number>(0.75); // default width/height aspect ratio
  const [visiblePageSet, setVisiblePageSet] = useState<Set<number>>(new Set([initialPage || 1]));

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Opening book...');
  const [error, setError] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialScrolledRef = useRef<boolean>(false);
  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const singleRenderTaskRef = useRef<any>(null);

  // Initialize PDF.js and Load Document (with CacheStorage strategy)
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);
        setLoadingProgress('Checking cache & loading PDF...');
        hasInitialScrolledRef.current = false;

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = getAssetUrl('/pdf.worker.min.mjs');

        const pdfUrl = getAssetUrl(url);
        
        // Fetch via CacheStorage or network buffer
        const arrayBuffer = await getPdfArrayBuffer(pdfUrl);

        if (isCancelled) return;

        setLoadingProgress('Parsing document structure...');
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;

        if (isCancelled) return;

        // Fetch page 1 for aspect ratio estimation
        try {
          const firstPage = await doc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });
          if (vp.width && vp.height) {
            setAspectRatio(vp.width / vp.height);
          }
        } catch {
          // fallback to 0.75
        }

        setPdfDoc(doc);
        setNumPages(doc.numPages);

        const startPage = Math.min(doc.numPages, Math.max(1, initialPage || 1));
        setCurrentPage(startPage);
        setVisiblePageSet(new Set([startPage, Math.max(1, startPage - 1), Math.min(doc.numPages, startPage + 1)]));
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

  // Execute initial scroll to initialPage once document is ready
  useEffect(() => {
    if (!loading && pdfDoc && numPages > 0 && !hasInitialScrolledRef.current) {
      const startPage = Math.min(numPages, Math.max(1, initialPage || 1));
      if (settings.reading_mode === 'continuous' && containerRef.current) {
        setTimeout(() => {
          const pageEl = containerRef.current?.querySelector(`[data-page-num="${startPage}"]`);
          if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
          hasInitialScrolledRef.current = true;
        }, 150);
      } else {
        hasInitialScrolledRef.current = true;
      }
    }
  }, [loading, pdfDoc, numPages, initialPage, settings.reading_mode]);

  // Handle external jump target page (Enter input, arrows, progress bar scrub)
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages) {
      setCurrentPage(targetPage);
      if (settings.reading_mode === 'continuous' && containerRef.current) {
        const pageEl = containerRef.current.querySelector(`[data-page-num="${targetPage}"]`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [targetPage, numPages, settings.reading_mode]);

  // Save Progress Function (Debounced)
  const saveProgress = useCallback(
    (pageToSave: number, total: number) => {
      if (!bookId || !total) return;
      const progress = Math.min(100, Math.round((pageToSave / total) * 100 * 10) / 10);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        fetch(getApiUrl('/api/progress'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            currentPage: pageToSave,
            progressPercentage: progress,
            pageCount: total,
          }),
          keepalive: true,
        }).catch(err => console.warn('Failed to auto-save progress:', err));
      }, 1000);
    },
    [bookId]
  );

  // Auto-save progress ONLY after initial scroll completed
  useEffect(() => {
    if (numPages > 0 && hasInitialScrolledRef.current) {
      onPageChange(currentPage, numPages);
      saveProgress(currentPage, numPages);
    }
  }, [currentPage, numPages, saveProgress]);

  // Save on tab hide / unmount
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && numPages > 0 && hasInitialScrolledRef.current) {
        const progress = Math.min(100, Math.round((currentPage / numPages) * 100 * 10) / 10);
        navigator.sendBeacon(
          getApiUrl('/api/progress'),
          JSON.stringify({
            bookId,
            currentPage,
            progressPercentage: progress,
            pageCount: numPages,
          })
        );
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleVisibilityChange);
    };
  }, [bookId, currentPage, numPages]);

  // Render Page in Single (Paged) Mode
  useEffect(() => {
    let isCancelled = false;

    async function renderPagedMode() {
      if (!pdfDoc || settings.reading_mode !== 'paged' || !singleCanvasRef.current) return;

      if (singleRenderTaskRef.current) {
        try {
          singleRenderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        singleRenderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled || !singleCanvasRef.current) return;

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const scale = (settings.zoom || 1.0) * dpr;
        const viewport = page.getViewport({ scale: scale * 1.2 });

        const canvas = singleCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        singleRenderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.warn(`Paged mode render error:`, err);
        }
      }
    }

    renderPagedMode();

    return () => {
      isCancelled = true;
      if (singleRenderTaskRef.current) {
        try {
          singleRenderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        singleRenderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, settings.reading_mode, settings.zoom]);

  // IntersectionObserver for Continuous Scroll Page Tracking & Virtualization
  useEffect(() => {
    if (settings.reading_mode !== 'continuous' || !containerRef.current || numPages === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        setVisiblePageSet(prevSet => {
          const nextSet = new Set(prevSet);
          entries.forEach(entry => {
            const pNum = parseInt(entry.target.getAttribute('data-page-num') || '0', 10);
            if (!pNum) return;

            if (entry.isIntersecting) {
              nextSet.add(pNum);
              // Pre-buffer adjacent pages for smooth scrolling
              if (pNum > 1) nextSet.add(pNum - 1);
              if (pNum < numPages) nextSet.add(pNum + 1);

              if (hasInitialScrolledRef.current && pNum !== currentPage) {
                setCurrentPage(pNum);
              }
            } else {
              // Un-mount canvas if page is far from active viewport
              if (Math.abs(pNum - currentPage) > 2) {
                nextSet.delete(pNum);
              }
            }
          });
          return nextSet;
        });
      },
      {
        rootMargin: '350px 0px', // start mounting canvas 350px before entering viewport
        threshold: 0.1,
      }
    );

    const pageEls = containerRef.current.querySelectorAll('[data-page-num]');
    pageEls.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [settings.reading_mode, numPages, currentPage]);

  // Theme & Width helper styles
  const widthClasses =
    {
      compact: 'max-w-2xl',
      comfortable: 'max-w-4xl',
      wide: 'max-w-6xl',
      full: 'max-w-full px-4',
    }[settings.page_width] || 'max-w-4xl';

  const themeBgClasses =
    {
      light: 'bg-stone-50 text-stone-900',
      sepia: 'bg-[#f8f1e5] text-[#433422]',
      dark: 'bg-[#0f1115] text-stone-100',
    }[settings.theme] || 'bg-stone-50 text-stone-900';

  const canvasFilterClass =
    {
      light: '',
      sepia: 'sepia-pdf-canvas',
      dark: 'dark-pdf-canvas',
    }[settings.theme] || '';

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${themeBgClasses}`}>
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="font-serif text-base font-medium opacity-80">{loadingProgress}</p>
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
          opacity: 1 - Math.max(0.2, Math.min(1.0, settings.brightness)),
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
          /* Continuous Scroll Mode (Virtualized Windowing) */
          <div className="space-y-8 my-6 flex flex-col items-center">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pNum => {
              const shouldRenderCanvas = visiblePageSet.has(pNum) || Math.abs(pNum - currentPage) <= 1;

              return (
                <div
                  key={pNum}
                  data-page-num={pNum}
                  className="shadow-xl rounded-sm overflow-hidden bg-white dark:bg-stone-900 w-full flex flex-col items-center min-h-100"
                  style={!shouldRenderCanvas ? { minHeight: `${Math.round(600 / aspectRatio)}px` } : undefined}
                >
                  {shouldRenderCanvas ? (
                    <SinglePageCanvas
                      pdfDoc={pdfDoc}
                      pageNum={pNum}
                      zoom={settings.zoom}
                      canvasFilterClass={canvasFilterClass}
                      numPages={numPages}
                    />
                  ) : (
                    <div className="w-full flex-1 flex flex-col items-center justify-center py-16 opacity-30">
                      <div className="text-xs font-mono">Page {pNum}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
