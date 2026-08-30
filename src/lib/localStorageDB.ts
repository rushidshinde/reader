import { BookRecord, ReadingProgress, Bookmark, ReaderSettings } from './db';

const KEYS = {
  BOOKS: 'reader_books_cache',
  PROGRESS_PREFIX: 'reader_progress:',
  BOOKMARKS_PREFIX: 'reader_bookmarks:',
  SETTINGS: 'reader_settings',
  SYNC_QUEUE: 'reader_sync_queue',
  LAST_SYNC: 'reader_last_sync_time',
};

export interface SyncQueueItem {
  id: string;
  type: 'progress' | 'bookmark_add' | 'bookmark_delete' | 'settings';
  bookId?: string;
  data: any;
  timestamp: number;
}

const isClient = typeof window !== 'undefined';

function safeGetItem<T>(key: string, defaultValue: T): T {
  if (!isClient) return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.warn(`[LocalStorageDB] Failed to get key "${key}":`, err);
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (!isClient) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[LocalStorageDB] Failed to set key "${key}":`, err);
  }
}

// --- Books Cache ---
export function getLocalBooks(): BookRecord[] {
  return safeGetItem<BookRecord[]>(KEYS.BOOKS, []);
}

export function saveLocalBooks(books: BookRecord[]): void {
  safeSetItem(KEYS.BOOKS, books);
}

// --- Reading Progress ---
export function getLocalProgress(bookId: string): ReadingProgress | null {
  return safeGetItem<ReadingProgress | null>(`${KEYS.PROGRESS_PREFIX}${bookId}`, null);
}

export function saveLocalProgress(bookId: string, page: number, percentage: number, totalPages: number): ReadingProgress {
  const now = new Date().toISOString();
  const progress: ReadingProgress = {
    book_id: bookId,
    current_page: page,
    progress_percentage: percentage,
    scroll_position: 0,
    updated_at: now,
  };
  safeSetItem(`${KEYS.PROGRESS_PREFIX}${bookId}`, progress);

  // Update book in cached manifest if present
  const books = getLocalBooks();
  if (books.length > 0) {
    const updated = books.map(b => {
      if (b.id === bookId) {
        return {
          ...b,
          current_page: page,
          progress_percentage: percentage,
          page_count: totalPages || b.page_count,
          last_opened_at: now,
          updated_at: now,
        };
      }
      return b;
    });
    saveLocalBooks(updated);
  }

  // Queue item for server sync
  enqueueSyncItem({
    id: `progress_${bookId}_${Date.now()}`,
    type: 'progress',
    bookId,
    data: { bookId, currentPage: page, progressPercentage: percentage, pageCount: totalPages },
    timestamp: Date.now(),
  });

  return progress;
}

// --- Bookmarks ---
export function getLocalBookmarks(bookId: string): Bookmark[] {
  return safeGetItem<Bookmark[]>(`${KEYS.BOOKMARKS_PREFIX}${bookId}`, []);
}

export function saveLocalBookmarks(bookId: string, bookmarks: Bookmark[]): void {
  safeSetItem(`${KEYS.BOOKMARKS_PREFIX}${bookId}`, bookmarks);
}

export function addLocalBookmark(bookId: string, page: number, label?: string): Bookmark {
  const current = getLocalBookmarks(bookId);
  const now = new Date().toISOString();
  const newBm: Bookmark = {
    id: `bm_${bookId}_${page}_${Date.now()}`,
    book_id: bookId,
    page,
    label: label || `Page ${page}`,
    created_at: now,
  };

  if (!current.some(b => b.page === page)) {
    const updated = [...current, newBm].sort((a, b) => a.page - b.page);
    saveLocalBookmarks(bookId, updated);

    enqueueSyncItem({
      id: newBm.id,
      type: 'bookmark_add',
      bookId,
      data: { bookId, page, label: newBm.label },
      timestamp: Date.now(),
    });
  }

  return newBm;
}

export function deleteLocalBookmark(bookId: string, bookmarkId: string): void {
  const current = getLocalBookmarks(bookId);
  const updated = current.filter(b => b.id !== bookmarkId);
  saveLocalBookmarks(bookId, updated);

  enqueueSyncItem({
    id: `del_bm_${bookmarkId}_${Date.now()}`,
    type: 'bookmark_delete',
    bookId,
    data: { bookmarkId },
    timestamp: Date.now(),
  });
}

// --- Reader Settings ---
const DEFAULT_SETTINGS: ReaderSettings = {
  id: 1,
  theme: 'light',
  brightness: 1.0,
  zoom: 1.0,
  reading_mode: 'continuous',
  page_width: 'comfortable',
  show_controls: 1,
  updated_at: new Date().toISOString(),
};

export function getLocalSettings(): ReaderSettings {
  return safeGetItem<ReaderSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveLocalSettings(newSettings: Partial<ReaderSettings>): ReaderSettings {
  const current = getLocalSettings();
  const updated: ReaderSettings = {
    ...current,
    ...newSettings,
    updated_at: new Date().toISOString(),
  };
  safeSetItem(KEYS.SETTINGS, updated);

  enqueueSyncItem({
    id: `settings_${Date.now()}`,
    type: 'settings',
    data: updated,
    timestamp: Date.now(),
  });

  return updated;
}

// --- Sync Queue ---
export function getSyncQueue(): SyncQueueItem[] {
  return safeGetItem<SyncQueueItem[]>(KEYS.SYNC_QUEUE, []);
}

export function enqueueSyncItem(item: SyncQueueItem): void {
  const queue = getSyncQueue();
  let updatedQueue = queue;
  if (item.type === 'progress' && item.bookId) {
    updatedQueue = queue.filter(q => !(q.type === 'progress' && q.bookId === item.bookId));
  } else if (item.type === 'settings') {
    updatedQueue = queue.filter(q => q.type !== 'settings');
  }

  updatedQueue.push(item);
  safeSetItem(KEYS.SYNC_QUEUE, updatedQueue);
}

export function removeSyncItems(itemIds: string[]): void {
  const queue = getSyncQueue();
  const idSet = new Set(itemIds);
  const updated = queue.filter(q => !idSet.has(q.id));
  safeSetItem(KEYS.SYNC_QUEUE, updated);
}

export function getLastSyncTime(): number {
  return safeGetItem<number>(KEYS.LAST_SYNC, 0);
}

export function setLastSyncTime(timestamp: number): void {
  safeSetItem(KEYS.LAST_SYNC, timestamp);
}
