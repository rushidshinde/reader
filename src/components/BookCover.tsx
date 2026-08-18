'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  url: string;
  title: string;
  author?: string | null;
  className?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({ url, title, author, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function renderThumbnail() {
      try {
        setLoading(true);
        setError(false);
        const pdfjs = await import('pdfjs-dist');
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(1);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn(`Cover render fallback for ${title}:`, err);
          setError(true);
          setLoading(false);
        }
      }
    }

    renderThumbnail();

    return () => {
      isCancelled = true;
    };
  }, [url, title]);

  return (
    <div className={`relative overflow-hidden rounded-md shadow-md aspect-3/4 bg-linear-to-br from-amber-800 via-stone-800 to-slate-900 border border-slate-700/50 flex flex-col justify-between p-4 ${className}`}>
      {/* Canvas thumbnail */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          loading || error ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Fallback elegant cover if thumbnail rendering or loading */}
      {(loading || error) && (
        <div className="absolute inset-0 p-4 flex flex-col justify-between bg-linear-to-tr from-stone-900 via-amber-950/80 to-slate-900 text-stone-100">
          <div className="flex items-center justify-between opacity-60">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-200">PDF Reader</span>
          </div>

          <div className="my-auto text-center px-2">
            <h3 className="font-serif font-bold text-base md:text-lg leading-tight line-clamp-3 text-amber-100 drop-shadow-sm">
              {title}
            </h3>
            {author && (
              <p className="text-xs text-amber-300/80 mt-2 font-medium italic line-clamp-1">
                {author}
              </p>
            )}
          </div>

          <div className="text-[9px] text-center text-amber-400/60 font-mono tracking-tighter">
            PERSONAL LIBRARY
          </div>
        </div>
      )}
    </div>
  );
};
