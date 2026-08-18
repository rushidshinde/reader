import generatedBooks from './generated-books.json';
import { getEnvironment } from './config';

export interface BookRecord {
  id: string;
  file_name: string;
  file_path: string;
  title: string;
  author: string | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
  url: string;
  current_page?: number;
  progress_percentage?: number;
  scroll_position?: number;
  last_opened_at?: string | null;
}

export interface ReadingProgress {
  book_id: string;
  current_page: number;
  progress_percentage: number;
  scroll_position: number;
  updated_at: string;
}

export interface Bookmark {
  id: string;
  book_id: string;
  page: number;
  label: string | null;
  created_at: string;
}

export interface ReaderSettings {
  id: number;
  theme: string;
  brightness: number;
  zoom: number;
  reading_mode: string;
  page_width: string;
  show_controls: number;
  updated_at: string;
}

// Helpers for dynamic live directory scanning in Node environment
function cleanTitleFromFilename(fileName: string): { title: string; author?: string } {
  let name = fileName.replace(/\.pdf$/i, '');
  name = name.replace(/\(z-lib\.org\)/gi, '').trim();

  let author: string | undefined = undefined;

  // Handle [Author Name] pattern in square brackets
  const bracketMatch = name.match(/\[(.*?)\]/);
  if (bracketMatch) {
    author = bracketMatch[1].trim();
    name = name.replace(bracketMatch[0], '').trim();
  }

  // Fallback to (Author, Name) pattern if present e.g. (Tripathi, Amish)
  if (!author) {
    const authorMatch = name.match(/\(([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)?)\)/);
    if (authorMatch) {
      const rawAuthor = authorMatch[1];
      if (rawAuthor.includes(',')) {
        const parts = rawAuthor.split(',').map(s => s.trim());
        author = `${parts[1]} ${parts[0]}`;
      } else {
        author = rawAuthor;
      }
      name = name.replace(authorMatch[0], '').trim();
    }
  }

  const title = name.replace(/\s+/g, ' ').trim();
  return { title, author };
}

function generateSlug(fileName: string): string {
  let name = fileName.replace(/\.pdf$/i, '');
  name = name.replace(/\(z-lib\.org\)/gi, '');
  name = name.toLowerCase();
  let slug = name.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'book';
}

function discoverBooksLive(): { id: string; title: string; author?: string; fileName: string; filePath: string; url: string }[] {
  try {
    const fs = require('fs');
    const path = require('path');
    const rootDir = process.cwd();
    const possibleDirs = [
      path.join(rootDir, 'public', 'books'),
      path.join(rootDir, 'public', 'book')
    ];

    const discovered: any[] = [];
    const usedSlugs = new Set<string>();

    for (const dirPath of possibleDirs) {
      if (fs.existsSync(/*turbopackIgnore: true*/ dirPath)) {
        const dirName = path.basename(dirPath);
        const files = fs.readdirSync(/*turbopackIgnore: true*/ dirPath);
        for (const file of files) {
          if (typeof file === 'string' && file.toLowerCase().endsWith('.pdf')) {
            let slug = generateSlug(file);
            if (usedSlugs.has(slug)) {
              let counter = 2;
              while (usedSlugs.has(`${slug}-${counter}`)) {
                counter++;
              }
              slug = `${slug}-${counter}`;
            }
            usedSlugs.add(slug);

            const { title, author } = cleanTitleFromFilename(file);
            discovered.push({
              id: slug,
              title,
              author,
              fileName: file,
              filePath: `/public/${dirName}/${file}`,
              url: `/${dirName}/${encodeURIComponent(file)}`
            });
          }
        }
      }
    }

    if (discovered.length > 0) {
      return discovered;
    }
  } catch (e) {
    // Edge environment or fs unavailable
  }

  return generatedBooks as any[];
}

// -------------------------------------------------------------
// Key-Value (KV) Storage Layer (Cloudflare KV & Local File KV)
// -------------------------------------------------------------

async function getKV(): Promise<KVNamespace | null> {
  let kvInstance: KVNamespace | null = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    if (ctx?.env?.KV) {
      kvInstance = ctx.env.KV as KVNamespace;
    }
  } catch (e) {
    // Not running under OpenNext Cloudflare runtime
  }

  if (!kvInstance && (globalThis as any).KV) {
    kvInstance = (globalThis as any).KV;
  }

  if (!kvInstance && (process.env as any).KV) {
    kvInstance = (process.env as any).KV;
  }

  if (!kvInstance && (globalThis as any).__env__?.KV) {
    kvInstance = (globalThis as any).__env__.KV;
  }

  return kvInstance;
}

interface LocalKVStoreSchema {
  [key: string]: any;
}

let localKVCache: LocalKVStoreSchema | null = null;

function getLocalKVStore(): LocalKVStoreSchema {
  if (localKVCache) return localKVCache;
  try {
    const fs = require('fs');
    const path = require('path');
    const storePath = path.join(process.cwd(), '.local-kv.json');
    if (fs.existsSync(/*turbopackIgnore: true*/ storePath)) {
      const data = fs.readFileSync(/*turbopackIgnore: true*/ storePath, 'utf-8');
      localKVCache = JSON.parse(data);
    } else {
      localKVCache = {};
      fs.writeFileSync(/*turbopackIgnore: true*/ storePath, '{}', 'utf-8');
    }
  } catch (err) {
    localKVCache = {};
  }
  return localKVCache!;
}

function saveLocalKVStore(): void {
  if (!localKVCache) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const storePath = path.join(process.cwd(), '.local-kv.json');
    fs.writeFileSync(/*turbopackIgnore: true*/ storePath, JSON.stringify(localKVCache, null, 2), 'utf-8');
  } catch (err) {
    // Ignore in read-only / edge environments
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (kv) {
    try {
      const val = await kv.get(key, 'json');
      return val as T | null;
    } catch (e) {
      console.error(`KV get error for key "${key}":`, e);
    }
  }
  const store = getLocalKVStore();
  return (store[key] !== undefined ? store[key] : null) as T | null;
}

async function kvPut<T>(key: string, value: T): Promise<void> {
  const kv = await getKV();
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(value));
      return;
    } catch (e) {
      console.error(`KV put error for key "${key}":`, e);
    }
  }
  const store = getLocalKVStore();
  store[key] = value;
  saveLocalKVStore();
}

async function kvDelete(key: string): Promise<void> {
  const kv = await getKV();
  if (kv) {
    try {
      await kv.delete(key);
      return;
    } catch (e) {
      console.error(`KV delete error for key "${key}":`, e);
    }
  }
  const store = getLocalKVStore();
  delete store[key];
  saveLocalKVStore();
}

export async function getDbStatus(): Promise<{ environment: string; dbEngine: string; isKV: boolean }> {
  const env = getEnvironment();
  const kv = await getKV();
  if (kv) {
    return { environment: env, dbEngine: 'Webflow Cloud KV (Cloudflare Key-Value Store)', isKV: true };
  }
  return { environment: env, dbEngine: 'Local Key-Value Store (.local-kv.json)', isKV: false };
}

// Sync books manifest into KV Store & purge deleted books
export async function syncBooksManifest(): Promise<void> {
  const env = getEnvironment();
  let booksToSync: any[] = [];

  if (env === 'production') {
    booksToSync = generatedBooks as any[];
  } else {
    booksToSync = discoverBooksLive();
  }

  const now = new Date().toISOString();
  const existingManifest = (await kvGet<BookRecord[]>('books_manifest')) || [];
  const existingMap = new Map(existingManifest.map(b => [b.id, b]));

  const updatedManifest: BookRecord[] = booksToSync.map(book => {
    const prev = existingMap.get(book.id);
    return {
      id: book.id,
      file_name: book.fileName,
      file_path: book.filePath,
      title: book.title,
      author: book.author || null,
      page_count: prev ? prev.page_count : null,
      created_at: prev ? prev.created_at : now,
      updated_at: now,
      url: book.url
    };
  });

  // Purge obsolete books: delete reading progress and bookmarks for removed books
  const activeIds = new Set(booksToSync.map(b => b.id));
  for (const prevBook of existingManifest) {
    if (!activeIds.has(prevBook.id)) {
      await kvDelete(`progress:${prevBook.id}`);
      await kvDelete(`bookmarks:${prevBook.id}`);
    }
  }

  await kvPut('books_manifest', updatedManifest);
}

// Get All Books with Progress
export async function getAllBooks(): Promise<BookRecord[]> {
  await syncBooksManifest();
  const manifest = (await kvGet<BookRecord[]>('books_manifest')) || [];
  const booksToSync = getEnvironment() === 'production' ? (generatedBooks as any[]) : discoverBooksLive();
  const manifestMap = new Map(booksToSync.map(b => [b.id, b.url]));

  const enrichedBooks = await Promise.all(
    manifest.map(async book => {
      const progress = await kvGet<ReadingProgress>(`progress:${book.id}`);
      return {
        ...book,
        url: manifestMap.get(book.id) || book.url || `/books/${encodeURIComponent(book.file_name)}`,
        current_page: progress?.current_page || 1,
        progress_percentage: progress?.progress_percentage || 0,
        scroll_position: progress?.scroll_position || 0,
        last_opened_at: progress?.updated_at || null
      };
    })
  );

  return enrichedBooks.sort((a, b) => {
    const timeA = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
    const timeB = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.title.localeCompare(b.title);
  });
}

// Get Single Book By ID
export async function getBookById(id: string): Promise<BookRecord | null> {
  await syncBooksManifest();
  const manifest = (await kvGet<BookRecord[]>('books_manifest')) || [];
  const book = manifest.find(b => b.id === id);
  if (!book) return null;

  const progress = await kvGet<ReadingProgress>(`progress:${id}`);
  return {
    ...book,
    current_page: progress?.current_page || 1,
    progress_percentage: progress?.progress_percentage || 0,
    scroll_position: progress?.scroll_position || 0,
    last_opened_at: progress?.updated_at || null
  };
}

// Save Reading Progress
export async function saveReadingProgress(
  bookId: string,
  currentPage: number,
  progressPercentage: number,
  scrollPosition: number = 0,
  pageCount?: number
): Promise<void> {
  const now = new Date().toISOString();
  const progress: ReadingProgress = {
    book_id: bookId,
    current_page: currentPage,
    progress_percentage: progressPercentage,
    scroll_position: scrollPosition,
    updated_at: now
  };

  await kvPut(`progress:${bookId}`, progress);

  if (pageCount && pageCount > 0) {
    const manifest = (await kvGet<BookRecord[]>('books_manifest')) || [];
    const updatedManifest = manifest.map(b => {
      if (b.id === bookId) {
        return { ...b, page_count: pageCount, updated_at: now };
      }
      return b;
    });
    await kvPut('books_manifest', updatedManifest);
  }
}

// Bookmarks
export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const bookmarks = (await kvGet<Bookmark[]>(`bookmarks:${bookId}`)) || [];
  return bookmarks.sort((a, b) => a.page - b.page);
}

export async function addBookmark(bookId: string, page: number, label?: string): Promise<Bookmark> {
  const bookmarks = (await kvGet<Bookmark[]>(`bookmarks:${bookId}`)) || [];
  const id = `bm_${bookId}_${page}_${Date.now()}`;
  const now = new Date().toISOString();
  const bookmarkLabel = label || `Page ${page}`;
  const newBm: Bookmark = { id, book_id: bookId, page, label: bookmarkLabel, created_at: now };

  if (!bookmarks.some(b => b.page === page)) {
    bookmarks.push(newBm);
    await kvPut(`bookmarks:${bookId}`, bookmarks);
  }

  return newBm;
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const parts = bookmarkId.split('_');
  if (parts.length >= 2) {
    const bookId = parts[1];
    const bookmarks = (await kvGet<Bookmark[]>(`bookmarks:${bookId}`)) || [];
    const updated = bookmarks.filter(b => b.id !== bookmarkId);
    await kvPut(`bookmarks:${bookId}`, updated);
  }
}

// Reader Settings
const DEFAULT_SETTINGS: ReaderSettings = {
  id: 1,
  theme: 'light',
  brightness: 1.0,
  zoom: 1.0,
  reading_mode: 'continuous',
  page_width: 'comfortable',
  show_controls: 1,
  updated_at: new Date().toISOString()
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  const settings = await kvGet<ReaderSettings>('reader_settings');
  return settings || DEFAULT_SETTINGS;
}

export async function saveReaderSettings(settings: Partial<ReaderSettings>): Promise<ReaderSettings> {
  const current = await getReaderSettings();
  const updated: ReaderSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };
  await kvPut('reader_settings', updated);
  return updated;
}
