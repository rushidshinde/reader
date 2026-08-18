import generatedBooks from './generated-books.json';

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

  if (!name.includes(' ') && (name.includes('-') || name.includes('_'))) {
    name = name.replace(/[-_]+/g, ' ');
  }

  const words = name.split(/\s+/).map(word => {
    if (word.startsWith('(') && word.endsWith(')')) {
      const inner = word.slice(1, -1);
      return `(${inner.charAt(0).toUpperCase() + inner.slice(1)})`;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  const title = words.join(' ').replace(/\s+/g, ' ').trim();
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

// Pure JS file store for local fallback without native C++ compilation dependencies
interface LocalStoreSchema {
  books: Record<string, any>;
  reading_progress: Record<string, ReadingProgress>;
  bookmarks: Bookmark[];
  reader_settings: ReaderSettings;
}

let localStoreCache: LocalStoreSchema | null = null;

function getLocalStore(): LocalStoreSchema {
  if (localStoreCache) return localStoreCache;

  const defaultStore: LocalStoreSchema = {
    books: {},
    reading_progress: {},
    bookmarks: [],
    reader_settings: {
      id: 1,
      theme: 'light',
      brightness: 1.0,
      zoom: 1.0,
      reading_mode: 'continuous',
      page_width: 'comfortable',
      show_controls: 1,
      updated_at: new Date().toISOString()
    }
  };

  try {
    const fs = require('fs');
    const path = require('path');
    const storePath = path.join(process.cwd(), '.local-db.json');

    if (fs.existsSync(/*turbopackIgnore: true*/ storePath)) {
      const data = fs.readFileSync(/*turbopackIgnore: true*/ storePath, 'utf-8');
      localStoreCache = JSON.parse(data);
    } else {
      localStoreCache = defaultStore;
      fs.writeFileSync(/*turbopackIgnore: true*/ storePath, JSON.stringify(defaultStore, null, 2), 'utf-8');
    }
  } catch (err) {
    localStoreCache = defaultStore;
  }

  return localStoreCache!;
}

function saveLocalStore(): void {
  if (!localStoreCache) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const storePath = path.join(process.cwd(), '.local-db.json');
    fs.writeFileSync(/*turbopackIgnore: true*/ storePath, JSON.stringify(localStoreCache, null, 2), 'utf-8');
  } catch (err) {
    // Ignore in read-only / edge environments
  }
}

// Automatically create D1 tables if they don't exist yet
let d1Initialized = false;

async function ensureD1Tables(d1: D1Database): Promise<void> {
  if (d1Initialized) return;
  try {
    await d1.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        author TEXT,
        page_count INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reading_progress (
        book_id TEXT PRIMARY KEY,
        current_page INTEGER NOT NULL DEFAULT 1,
        progress_percentage REAL NOT NULL DEFAULT 0,
        scroll_position REAL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        page INTEGER NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reader_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        theme TEXT NOT NULL DEFAULT 'light',
        brightness REAL NOT NULL DEFAULT 1,
        zoom REAL NOT NULL DEFAULT 1,
        reading_mode TEXT NOT NULL DEFAULT 'continuous',
        page_width TEXT NOT NULL DEFAULT 'comfortable',
        show_controls INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO reader_settings (id, theme, brightness, zoom, reading_mode, page_width, show_controls, updated_at)
      VALUES (1, 'light', 1.0, 1.0, 'continuous', 'comfortable', 1, datetime('now'));
    `);
    d1Initialized = true;
  } catch (err) {
    console.warn('Failed to auto-create D1 tables:', err);
  }
}

// Get Cloudflare D1 database binding if available in context
async function getD1(): Promise<D1Database | null> {
  let d1Instance: D1Database | null = null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    if (ctx?.env?.DB) {
      d1Instance = ctx.env.DB as D1Database;
    }
  } catch (e) {
    // Not running under OpenNext Cloudflare runtime
  }

  if (!d1Instance && (globalThis as any).DB) {
    d1Instance = (globalThis as any).DB;
  }

  if (d1Instance) {
    await ensureD1Tables(d1Instance);
    return d1Instance;
  }

  return null;
}

// Sync books manifest into Database
export async function syncBooksManifest(): Promise<void> {
  const booksToSync = discoverBooksLive();
  const d1 = await getD1();
  const now = new Date().toISOString();

  if (d1) {
    const statements = booksToSync.map(book => {
      return d1.prepare(`
        INSERT INTO books (id, file_name, file_path, title, author, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          file_name = excluded.file_name,
          file_path = excluded.file_path,
          title = excluded.title,
          author = excluded.author;
      `).bind(book.id, book.fileName, book.filePath, book.title, book.author || null, now, now);
    });

    if (statements.length > 0) {
      await d1.batch(statements);
    }
  } else {
    const store = getLocalStore();
    for (const book of booksToSync) {
      if (!store.books[book.id]) {
        store.books[book.id] = {
          id: book.id,
          file_name: book.fileName,
          file_path: book.filePath,
          title: book.title,
          author: book.author || null,
          page_count: null,
          created_at: now,
          updated_at: now
        };
      } else {
        store.books[book.id].file_name = book.fileName;
        store.books[book.id].file_path = book.filePath;
        store.books[book.id].title = book.title;
        store.books[book.id].author = book.author || null;
        store.books[book.id].updated_at = now;
      }
    }
    saveLocalStore();
  }
}

// Get All Books with Progress
export async function getAllBooks(): Promise<BookRecord[]> {
  await syncBooksManifest();
  const booksToSync = discoverBooksLive();
  const d1 = await getD1();

  const manifestMap = new Map(booksToSync.map(b => [b.id, b.url]));

  if (d1) {
    const query = `
      SELECT 
        b.id, b.file_name, b.file_path, b.title, b.author, b.page_count, b.created_at, b.updated_at,
        p.current_page, p.progress_percentage, p.scroll_position, p.updated_at as last_opened_at
      FROM books b
      LEFT JOIN reading_progress p ON b.id = p.book_id
      ORDER BY p.updated_at DESC, b.title ASC
    `;
    const res = await d1.prepare(query).all();
    const rows = res.results || [];
    return rows.map((row: any) => ({
      id: row.id,
      file_name: row.file_name,
      file_path: row.file_path,
      title: row.title,
      author: row.author,
      page_count: row.page_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      url: manifestMap.get(row.id) || `/books/${encodeURIComponent(row.file_name)}`,
      current_page: row.current_page || 1,
      progress_percentage: row.progress_percentage || 0,
      scroll_position: row.scroll_position || 0,
      last_opened_at: row.last_opened_at || null
    }));
  }

  const store = getLocalStore();
  const booksList = Object.values(store.books);

  return booksList.map((b: any) => {
    const p = store.reading_progress[b.id];
    return {
      id: b.id,
      file_name: b.file_name,
      file_path: b.file_path,
      title: b.title,
      author: b.author,
      page_count: b.page_count,
      created_at: b.created_at,
      updated_at: b.updated_at,
      url: manifestMap.get(b.id) || `/books/${encodeURIComponent(b.file_name)}`,
      current_page: p ? p.current_page : 1,
      progress_percentage: p ? p.progress_percentage : 0,
      scroll_position: p ? p.scroll_position : 0,
      last_opened_at: p ? p.updated_at : null
    };
  }).sort((a, b) => {
    const timeA = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
    const timeB = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.title.localeCompare(b.title);
  });
}

// Get Single Book By ID
export async function getBookById(id: string): Promise<BookRecord | null> {
  await syncBooksManifest();
  const booksToSync = discoverBooksLive();
  const d1 = await getD1();

  const manifestBook = booksToSync.find(b => b.id === id);
  if (!manifestBook) return null;

  if (d1) {
    const query = `
      SELECT 
        b.id, b.file_name, b.file_path, b.title, b.author, b.page_count, b.created_at, b.updated_at,
        p.current_page, p.progress_percentage, p.scroll_position, p.updated_at as last_opened_at
      FROM books b
      LEFT JOIN reading_progress p ON b.id = p.book_id
      WHERE b.id = ?
    `;
    const row: any = await d1.prepare(query).bind(id).first();
    return {
      id: manifestBook.id,
      file_name: manifestBook.fileName,
      file_path: manifestBook.filePath,
      title: manifestBook.title,
      author: manifestBook.author || (row ? row.author : null),
      page_count: row ? row.page_count : null,
      created_at: row ? row.created_at : new Date().toISOString(),
      updated_at: row ? row.updated_at : new Date().toISOString(),
      url: manifestBook.url,
      current_page: row?.current_page || 1,
      progress_percentage: row?.progress_percentage || 0,
      scroll_position: row?.scroll_position || 0,
      last_opened_at: row?.last_opened_at || null
    };
  }

  const store = getLocalStore();
  const b = store.books[id];
  const p = store.reading_progress[id];

  return {
    id: manifestBook.id,
    file_name: manifestBook.fileName,
    file_path: manifestBook.filePath,
    title: manifestBook.title,
    author: manifestBook.author || (b ? b.author : null),
    page_count: b ? b.page_count : null,
    created_at: b ? b.created_at : new Date().toISOString(),
    updated_at: b ? b.updated_at : new Date().toISOString(),
    url: manifestBook.url,
    current_page: p ? p.current_page : 1,
    progress_percentage: p ? p.progress_percentage : 0,
    scroll_position: p ? p.scroll_position : 0,
    last_opened_at: p ? p.updated_at : null
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
  const d1 = await getD1();
  const now = new Date().toISOString();

  if (d1) {
    await d1.prepare(`
      INSERT INTO reading_progress (book_id, current_page, progress_percentage, scroll_position, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET
        current_page = excluded.current_page,
        progress_percentage = excluded.progress_percentage,
        scroll_position = excluded.scroll_position,
        updated_at = excluded.updated_at;
    `).bind(bookId, currentPage, progressPercentage, scrollPosition, now).run();

    if (pageCount && pageCount > 0) {
      await d1.prepare(`UPDATE books SET page_count = ?, updated_at = ? WHERE id = ?`)
        .bind(pageCount, now, bookId).run();
    }
  } else {
    const store = getLocalStore();
    store.reading_progress[bookId] = {
      book_id: bookId,
      current_page: currentPage,
      progress_percentage: progressPercentage,
      scroll_position: scrollPosition,
      updated_at: now
    };
    if (pageCount && store.books[bookId]) {
      store.books[bookId].page_count = pageCount;
    }
    saveLocalStore();
  }
}

// Bookmarks
export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const d1 = await getD1();

  if (d1) {
    const query = `SELECT id, book_id, page, label, created_at FROM bookmarks WHERE book_id = ? ORDER BY page ASC`;
    const res = await d1.prepare(query).bind(bookId).all();
    return (res.results || []) as unknown as Bookmark[];
  }

  const store = getLocalStore();
  return store.bookmarks.filter(b => b.book_id === bookId).sort((a, b) => a.page - b.page);
}

export async function addBookmark(bookId: string, page: number, label?: string): Promise<Bookmark> {
  const d1 = await getD1();
  const id = `bm_${bookId}_${page}_${Date.now()}`;
  const now = new Date().toISOString();
  const bookmarkLabel = label || `Page ${page}`;
  const newBm: Bookmark = { id, book_id: bookId, page, label: bookmarkLabel, created_at: now };

  if (d1) {
    await d1.prepare(`
      INSERT INTO bookmarks (id, book_id, page, label, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING;
    `).bind(id, bookId, page, bookmarkLabel, now).run();
  } else {
    const store = getLocalStore();
    if (!store.bookmarks.some(b => b.book_id === bookId && b.page === page)) {
      store.bookmarks.push(newBm);
      saveLocalStore();
    }
  }

  return newBm;
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const d1 = await getD1();
  if (d1) {
    await d1.prepare(`DELETE FROM bookmarks WHERE id = ?`).bind(bookmarkId).run();
  } else {
    const store = getLocalStore();
    store.bookmarks = store.bookmarks.filter(b => b.id !== bookmarkId);
    saveLocalStore();
  }
}

// Reader Settings
export async function getReaderSettings(): Promise<ReaderSettings> {
  const d1 = await getD1();

  if (d1) {
    const query = `SELECT id, theme, brightness, zoom, reading_mode, page_width, show_controls, updated_at FROM reader_settings WHERE id = 1`;
    const row: any = await d1.prepare(query).first();
    return {
      id: 1,
      theme: row?.theme || 'light',
      brightness: row?.brightness ?? 1.0,
      zoom: row?.zoom ?? 1.0,
      reading_mode: row?.reading_mode || 'continuous',
      page_width: row?.page_width || 'comfortable',
      show_controls: row?.show_controls ?? 1,
      updated_at: row?.updated_at || new Date().toISOString()
    };
  }

  const store = getLocalStore();
  return store.reader_settings;
}

export async function saveReaderSettings(settings: Partial<ReaderSettings>): Promise<ReaderSettings> {
  const d1 = await getD1();
  const current = await getReaderSettings();

  const updated: ReaderSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };

  if (d1) {
    const query = `
      INSERT INTO reader_settings (id, theme, brightness, zoom, reading_mode, page_width, show_controls, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        theme = excluded.theme,
        brightness = excluded.brightness,
        zoom = excluded.zoom,
        reading_mode = excluded.reading_mode,
        page_width = excluded.page_width,
        show_controls = excluded.show_controls,
        updated_at = excluded.updated_at;
    `;
    await d1.prepare(query).bind(
      updated.theme,
      updated.brightness,
      updated.zoom,
      updated.reading_mode,
      updated.page_width,
      updated.show_controls ? 1 : 0,
      updated.updated_at
    ).run();
  } else {
    const store = getLocalStore();
    store.reader_settings = updated;
    saveLocalStore();
  }

  return updated;
}
