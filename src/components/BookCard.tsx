'use client';

import React from 'react';
import Link from 'next/link';
import { BookCover } from './BookCover';
import { Clock, ArrowRight } from 'lucide-react';
import { BookRecord } from '@/lib/db';

interface BookCardProps {
  book: BookRecord;
  featured?: boolean;
}

function formatLastOpened(dateStr?: string | null): string {
  if (!dateStr) return 'Not opened yet';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const BookCard: React.FC<BookCardProps> = ({ book, featured = false }) => {
  const currentPage = book.current_page || 1;
  const pageCount = book.page_count;
  const progressPercent = Math.min(100, Math.max(0, Math.round(book.progress_percentage || 0)));

  if (featured) {
    return (
      <div className="relative group overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-blue-500/40 p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="w-36 md:w-44 shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-300">
          <BookCover url={book.url} title={book.title} author={book.author} />
        </div>

        <div className="flex-1 flex flex-col justify-between w-full space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-1">
              <span>Continue Reading</span>
              {book.last_opened_at && (
                <span className="flex items-center text-stone-400 dark:text-stone-500 font-normal">
                  <Clock className="w-3 h-3 mr-1 inline" />
                  {formatLastOpened(book.last_opened_at)}
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {book.title}
            </h2>
            {book.author && (
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mt-1">
                {book.author}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-medium text-stone-600 dark:text-stone-300">
              <span>
                Page {currentPage} {pageCount ? `/ ${pageCount}` : ''}
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{progressPercent}%</span>
            </div>

            <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="pt-2">
            <Link
              href={`/read/${book.id}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-md hover:shadow-blue-500/20 active:scale-95"
            >
              <span>Resume Reading</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/read/${book.id}`}
      className="group flex flex-col bg-white dark:bg-stone-900/80 rounded-xl border border-stone-200 dark:border-stone-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-stone-300 dark:hover:border-stone-700 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="p-3 bg-stone-50 dark:bg-stone-950/40 flex justify-center">
        <div className="w-full shadow-md group-hover:shadow-lg transition-shadow duration-300">
          <BookCover url={book.url} title={book.title} author={book.author} />
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {book.title}
          </h3>
          {book.author && (
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-1 line-clamp-1">
              {book.author}
            </p>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-stone-100 dark:border-stone-800/50">
          <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-stone-500 dark:text-stone-400 font-medium">
            <span>
              Page {currentPage} {pageCount ? `/ ${pageCount}` : ''}
            </span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
