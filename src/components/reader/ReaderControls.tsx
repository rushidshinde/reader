'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark as BookmarkIcon,
  Settings,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Monitor
} from 'lucide-react';
import { ReaderSettings } from '@/lib/db';

interface ReaderControlsProps {
  title: string;
  currentPage: number;
  totalPages: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  onPageChange: (page: number) => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  visible: boolean;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  title,
  currentPage,
  totalPages,
  isBookmarked,
  onToggleBookmark,
  onOpenBookmarks,
  onOpenSettings,
  onPageChange,
  settings,
  onUpdateSettings,
  isFullscreen,
  onToggleFullscreen,
  visible
}) => {
  const [inputPage, setInputPage] = useState<string>(currentPage.toString());
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverPage, setHoverPage] = useState<{ page: number; percentage: number; x: number } | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputPage(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(inputPage, 10);
    if (!isNaN(p) && p >= 1 && p <= (totalPages || 1)) {
      onPageChange(p);
    } else {
      setInputPage(currentPage.toString());
    }
  };

  // Top Progress Bar Scrubbing Calculations
  const calculateScrubPage = (clientX: number): { targetPage: number; percentage: number; relativeX: number } | null => {
    if (!progressBarRef.current || !totalPages) return null;
    const rect = progressBarRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = relativeX / rect.width;
    const targetPage = Math.max(1, Math.min(totalPages, Math.round(ratio * totalPages)));
    const percentage = Math.round((targetPage / totalPages) * 100);
    return { targetPage, percentage, relativeX };
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const scrub = calculateScrubPage(e.clientX);
    if (scrub) {
      onPageChange(scrub.targetPage);
    }
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const scrub = calculateScrubPage(e.clientX);
    if (scrub) {
      setHoverPage({ page: scrub.targetPage, percentage: scrub.percentage, x: scrub.relativeX });
      if (isScrubbing) {
        onPageChange(scrub.targetPage);
      }
    }
  };

  const handleProgressBarMouseLeave = () => {
    setHoverPage(null);
    setIsScrubbing(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const scrub = calculateScrubPage(e.clientX);
    if (scrub) {
      onPageChange(scrub.targetPage);
    }
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  const progressPercentage = totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0;

  return (
    <>
      {/* Top Scrubbable Interactive Reading Progress Bar */}
      <div
        ref={progressBarRef}
        onClick={handleProgressBarClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleProgressBarMouseMove}
        onMouseLeave={handleProgressBarMouseLeave}
        className="fixed top-0 left-0 right-0 z-50 h-2 bg-stone-300/40 dark:bg-stone-800/60 cursor-pointer group transition-all duration-150 select-none hover:h-3"
        title="Click or drag to scrub pages"
      >
        {/* Filled Progress Bar */}
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-150 ease-out relative"
          style={{ width: `${progressPercentage}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Hover / Drag Page Tooltip */}
        {hoverPage && (
          <div
            className="absolute top-4 -translate-x-1/2 px-2.5 py-1 bg-stone-900/95 text-white dark:bg-stone-800/95 rounded-md text-[11px] font-mono font-semibold shadow-xl border border-stone-700/80 pointer-events-none z-50 whitespace-nowrap"
            style={{ left: `${hoverPage.x}px` }}
          >
            Page {hoverPage.page} of {totalPages} ({hoverPage.percentage}%)
          </div>
        )}
      </div>

      {/* Top Header Bar */}
      <header
        className={`fixed top-2 left-0 right-0 z-40 px-4 py-3 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800/60 transition-transform duration-300 ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>

          <h1 className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 truncate max-w-xs sm:max-w-md md:max-w-xl text-center px-4">
            {title}
          </h1>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onToggleBookmark}
              className={`p-2 rounded-lg transition-colors ${
                isBookmarked
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title={isBookmarked ? 'Bookmarked' : 'Add Bookmark'}
            >
              <BookmarkIcon
                className={`w-5 h-5 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`}
              />
            </button>

            <button
              onClick={onOpenBookmarks}
              className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-xs font-semibold flex items-center gap-1"
              title="View Bookmarks"
            >
              <span className="hidden md:inline">Bookmarks</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Reader Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Bottom Toolbar */}
      <footer
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 bg-stone-900/90 dark:bg-stone-950/90 text-stone-100 backdrop-blur-xl border border-stone-800 shadow-2xl rounded-full transition-transform duration-300 flex items-center gap-2 sm:gap-4 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
        }`}
      >
        {/* Zoom */}
        <div className="hidden sm:flex items-center gap-1 border-r border-stone-800 pr-3">
          <button
            onClick={() => onUpdateSettings({ zoom: Math.max(0.5, Math.round((settings.zoom - 0.1) * 10) / 10) })}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-10 text-center font-semibold">
            {Math.round(settings.zoom * 100)}%
          </span>
          <button
            onClick={() => onUpdateSettings({ zoom: Math.min(2.5, Math.round((settings.zoom + 0.1) * 10) / 10) })}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Previous Page (← / A)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="text"
              value={inputPage}
              onChange={e => setInputPage(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handlePageSubmit(e);
                }
              }}
              className="w-12 py-1 text-center bg-stone-800 text-white rounded-md border border-stone-700 font-mono font-bold focus:outline-none focus:border-blue-500 text-xs"
            />
            <span className="text-stone-400">/ {totalPages || 1}</span>
          </form>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Next Page (→ / D / Space)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* View mode */}
        <div className="hidden md:flex items-center border-l border-stone-800 pl-3 gap-1">
          <button
            onClick={() =>
              onUpdateSettings({
                reading_mode: settings.reading_mode === 'continuous' ? 'paged' : 'continuous'
              })
            }
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 transition-colors"
            title={settings.reading_mode === 'continuous' ? 'Switch to Page-by-Page' : 'Switch to Continuous'}
          >
            {settings.reading_mode === 'continuous' ? (
              <Layers className="w-4 h-4 text-blue-400" />
            ) : (
              <Monitor className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-300 transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </>
  );
};
