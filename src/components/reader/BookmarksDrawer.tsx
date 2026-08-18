'use client';

import React from 'react';
import { X, Bookmark as BookmarkIcon, Trash2, ArrowRight } from 'lucide-react';
import { Bookmark } from '@/lib/db';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onSelectBookmark: (page: number) => void;
  onDeleteBookmark: (id: string) => void;
  currentPage: number;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
  currentPage
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-stone-800 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif font-bold text-lg">
            <BookmarkIcon className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Bookmarks</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {bookmarks.length === 0 ? (
            <div className="text-center py-12 text-stone-400 dark:text-stone-500">
              <BookmarkIcon className="w-12 h-12 stroke-1 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No bookmarks yet</p>
              <p className="text-xs mt-1">Click the bookmark icon while reading to save pages.</p>
            </div>
          ) : (
            bookmarks.map(bm => {
              const isCurrent = bm.page === currentPage;
              return (
                <div
                  key={bm.id}
                  className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-200'
                      : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700/60 hover:border-amber-400'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectBookmark(bm.page);
                      onClose();
                    }}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isCurrent ? 'bg-amber-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}>
                      {bm.page}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{bm.label || `Page ${bm.page}`}</p>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500">
                        {new Date(bm.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => onDeleteBookmark(bm.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete Bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onSelectBookmark(bm.page);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-amber-500 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
