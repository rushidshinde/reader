'use client';

import React, { useEffect, useState, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { PdfViewer } from '@/components/reader/PdfViewer';
import { ReaderControls } from '@/components/reader/ReaderControls';
import { BookmarksDrawer } from '@/components/reader/BookmarksDrawer';
import { SettingsDrawer } from '@/components/reader/SettingsDrawer';
import { BookRecord, Bookmark, ReaderSettings } from '@/lib/db';
import { Loader2, AlertCircle } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import {
  getLocalBooks,
  getLocalProgress,
  getLocalBookmarks,
  getLocalSettings,
  saveLocalSettings,
  addLocalBookmark,
  deleteLocalBookmark,
  saveLocalBookmarks,
} from '@/lib/localStorageDB';
import { syncManager } from '@/lib/syncManager';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default function ReaderPage({ params }: PageProps) {
  const { bookId } = use(params);
  const router = useRouter();

  const [book, setBook] = useState<BookRecord | null>(null);
  const [initialPage, setInitialPage] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [targetJumpPage, setTargetJumpPage] = useState<number | undefined>(undefined);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [settings, setSettings] = useState<ReaderSettings>({
    id: 1,
    theme: 'light',
    brightness: 1.0,
    zoom: 1.0,
    reading_mode: 'continuous',
    page_width: 'comfortable',
    show_controls: 1,
    updated_at: new Date().toISOString(),
  });

  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize periodic background sync
  useEffect(() => {
    syncManager.startPeriodicSync();
    return () => syncManager.stopPeriodicSync();
  }, []);

  // Auto-hide controls logic
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isBookmarksOpen && !isSettingsOpen) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [isBookmarksOpen, isSettingsOpen]);

  useEffect(() => {
    const handleMouseMove = () => resetHideTimer();
    const handleTouch = () => resetHideTimer();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch);
    resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Initial Data Loading: Local-First Strategy
  useEffect(() => {
    async function loadData() {
      setError(null);
      
      // 1. Instantly load from local database
      const localBooks = getLocalBooks();
      const cachedBook = localBooks.find(b => b.id === bookId);
      const localProgress = getLocalProgress(bookId);
      const localBm = getLocalBookmarks(bookId);
      const localSt = getLocalSettings();

      setSettings(localSt);
      if (localBm.length > 0) {
        setBookmarks(localBm);
      }

      if (cachedBook || localProgress) {
        const startPg = localProgress?.current_page || cachedBook?.current_page || 1;
        if (cachedBook) setBook(cachedBook);
        setInitialPage(startPg);
        setCurrentPage(startPg);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // 2. Fetch from server API in background or fallback
      try {
        const [bookRes, bookmarksRes, settingsRes] = await Promise.all([
          fetch(getApiUrl(`/api/books/${bookId}`)),
          fetch(getApiUrl(`/api/bookmarks?bookId=${bookId}`)),
          fetch(getApiUrl('/api/settings'))
        ]);

        if (bookRes.ok) {
          const bookData: any = await bookRes.json();
          setBook(bookData.book);

          // Merge server progress if fresher
          const startPg = localProgress?.current_page || bookData.book.current_page || 1;
          setInitialPage(startPg);
          setCurrentPage(startPg);
        } else if (!cachedBook) {
          throw new Error('Book not found');
        }

        if (bookmarksRes.ok) {
          const bookmarksData: any = await bookmarksRes.json();
          if (bookmarksData.bookmarks) {
            setBookmarks(bookmarksData.bookmarks);
            saveLocalBookmarks(bookId, bookmarksData.bookmarks);
          }
        }

        if (settingsRes.ok) {
          const settingsData: any = await settingsRes.json();
          if (settingsData.settings) {
            setSettings(settingsData.settings);
            saveLocalSettings(settingsData.settings);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.warn('[ReaderPage] Remote fetch fallback warning:', err);
        if (!cachedBook) {
          setError(err.message || 'Failed to load reader');
        }
        setLoading(false);
      }
    }

    loadData();
  }, [bookId]);

  // Settings update handler (Local-First)
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = saveLocalSettings(newSettings);
    setSettings(updated);
  };

  // Bookmark handlers (Local-First)
  const isCurrentPageBookmarked = bookmarks.some(bm => bm.page === currentPage);

  const handleToggleBookmark = () => {
    if (isCurrentPageBookmarked) {
      const existing = bookmarks.find(bm => bm.page === currentPage);
      if (existing) {
        handleDeleteBookmark(existing.id);
      }
    } else {
      const newBm = addLocalBookmark(bookId, currentPage);
      setBookmarks(prev => [...prev.filter(b => b.id !== newBm.id), newBm].sort((a, b) => a.page - b.page));
    }
  };

  const handleDeleteBookmark = (id: string) => {
    deleteLocalBookmark(bookId, id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  // Fullscreen Handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentPage > 1) setTargetJumpPage(currentPage - 1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (currentPage < totalPages) setTargetJumpPage(currentPage + 1);
          break;
        case ' ':
          e.preventDefault();
          if (e.shiftKey) {
            if (currentPage > 1) setTargetJumpPage(currentPage - 1);
          } else {
            if (currentPage < totalPages) setTargetJumpPage(currentPage + 1);
          }
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          handleToggleBookmark();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleUpdateSettings({ zoom: Math.min(2.5, Math.round((settings.zoom + 0.1) * 10) / 10) });
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleUpdateSettings({ zoom: Math.max(0.5, Math.round((settings.zoom - 0.1) * 10) / 10) });
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'Escape':
          setIsBookmarksOpen(false);
          setIsSettingsOpen(false);
          if (document.fullscreenElement) {
            document.exitFullscreen().then(() => setIsFullscreen(false));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, settings.zoom, bookmarks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="font-serif text-base font-medium">Opening Reader...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-bold font-serif mb-2">Book Not Found</h2>
        <p className="text-sm text-stone-400 max-w-md mb-6">{error || 'This book could not be loaded.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-md"
        >
          Return to Library
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-x-hidden ${settings.theme === 'dark' ? 'dark' : settings.theme === 'sepia' ? 'theme-sepia' : ''}`}>
      {/* Controls Header & Footer Toolbar */}
      <ReaderControls
        title={book.title}
        currentPage={currentPage}
        totalPages={totalPages}
        isBookmarked={isCurrentPageBookmarked}
        onToggleBookmark={handleToggleBookmark}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onPageChange={p => setTargetJumpPage(p)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        visible={controlsVisible}
      />

      {/* PDF Viewer Canvas Container */}
      <PdfViewer
        url={book.url}
        bookId={book.id}
        initialPage={initialPage}
        settings={settings}
        onPageChange={(curr, total) => {
          setCurrentPage(curr);
          setTotalPages(total);
        }}
        onBookmarkToggle={handleToggleBookmark}
        onToggleFullscreen={handleToggleFullscreen}
        targetPage={targetJumpPage}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onSelectBookmark={(p: number) => setTargetJumpPage(p)}
        onDeleteBookmark={handleDeleteBookmark}
        currentPage={currentPage}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
}
