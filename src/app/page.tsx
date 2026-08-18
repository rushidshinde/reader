'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BookCard } from '@/components/BookCard';
import { BookRecord } from '@/lib/db';
import { BookOpen, Search, ArrowUpDown, Loader2, Sparkles, FolderPlus } from 'lucide-react';

type SortOption = 'recently_opened' | 'title' | 'author' | 'progress' | 'recently_added';

export default function HomeLibraryPage() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recently_opened');

  useEffect(() => {
    async function loadLibrary() {
      try {
        setLoading(true);
        const res = await fetch('/api/books');
        if (res.ok) {
          const data: any = await res.json();
          setBooks(data.books || []);
        }
      } catch (err) {
        console.error('Failed to load library:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLibrary();
  }, []);

  // Most recently opened book for "Continue Reading"
  const featuredBook = useMemo(() => {
    const opened = books.filter(b => b.last_opened_at && (b.current_page || 1) > 1);
    if (opened.length === 0) return null;
    return [...opened].sort((a, b) => {
      const timeA = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
      const timeB = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
      return timeB - timeA;
    })[0];
  }, [books]);

  // Filtered & Sorted Books
  const processedBooks = useMemo(() => {
    let list = books.filter(b => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author && b.author.toLowerCase().includes(q)) ||
        b.file_name.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'recently_opened') {
        const timeA = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
        const timeB = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      if (sortBy === 'progress') {
        return (b.progress_percentage || 0) - (a.progress_percentage || 0);
      }
      if (sortBy === 'recently_added') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  }, [books, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#0f1115] text-stone-900 dark:text-stone-100 transition-colors duration-300">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-stone-50/80 dark:bg-[#0f1115]/80 backdrop-blur-xl border-b border-stone-200/80 dark:border-stone-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-xl md:text-2xl leading-tight">My Library</h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                Personal Kindle Reader • {books.length} {books.length === 1 ? 'Book' : 'Books'}
              </p>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search title, author..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-medium focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 shadow-sm transition-all"
              />
            </div>

            <div className="relative shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-medium text-stone-700 dark:text-stone-300 shadow-sm">
                <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent focus:outline-none cursor-pointer pr-1"
                >
                  <option value="recently_opened" className="dark:bg-stone-900">Recently Opened</option>
                  <option value="title" className="dark:bg-stone-900">Title</option>
                  <option value="author" className="dark:bg-stone-900">Author</option>
                  <option value="progress" className="dark:bg-stone-900">Reading Progress</option>
                  <option value="recently_added" className="dark:bg-stone-900">Recently Discovered</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Library Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="font-serif text-sm font-medium text-stone-500">Loading your books...</p>
          </div>
        ) : books.length === 0 ? (
          /* Zero State Instructions */
          <div className="max-w-lg mx-auto my-16 p-8 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <FolderPlus className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl">No Books Found</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              Your library automatically discovers PDF books from your static file directory.
            </p>
            <div className="p-4 bg-stone-100 dark:bg-stone-950 rounded-xl font-mono text-xs text-blue-600 dark:text-blue-400 border border-stone-200 dark:border-stone-800 inline-block text-left">
              public/books/
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Add `.pdf` files to `public/books/` and deploy/restart the app to populate your library.
            </p>
          </div>
        ) : (
          <>
            {/* Featured Continue Reading Banner */}
            {featuredBook && !searchQuery && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Resume Reading</span>
                </div>
                <BookCard book={featuredBook} featured />
              </section>
            )}

            {/* All Books Grid */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-serif font-bold text-xl text-stone-900 dark:text-stone-100">
                  {searchQuery ? `Search Results (${processedBooks.length})` : 'All Books'}
                </h2>
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {processedBooks.length} {processedBooks.length === 1 ? 'title' : 'titles'}
                </span>
              </div>

              {processedBooks.length === 0 ? (
                <div className="py-12 text-center text-stone-400 dark:text-stone-500">
                  No books match "{searchQuery}"
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                  {processedBooks.map(book => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
