import path from 'path';
import fs from 'fs';
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

// Global reference for local SQLite fallback during next dev
let sqliteDb: any = null;

function getLocalSqlite() {
  if (!sqliteDb) {
    // Dynamic import better-sqlite3 to prevent issues in Cloudflare bundle if tree-shaken
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), '.local-d1.sqlite');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');

    // Run migrations
    sqliteDb.exec(`
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
  }
  return sqliteDb;
}

// Get Cloudflare D1 database binding if available in context
async function getD1(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    if (ctx?.env?.DB) {
      return ctx.env.DB as D1Database;
    }
  } catch (e) {
    // Not running under OpenNext Cloudflare runtime
  }

  // Fallback to process.env.DB if attached
  if ((globalThis as any).DB) {
    return (globalThis as any).DB;
  }
  return null;
}

// Sync books manifest into Database
export async function syncBooksManifest(): Promise<void> {
  const d1 = await getD1();
  const now = new Date().toISOString();

  if (d1) {
    const statements = generatedBooks.map(book => {
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
    const db = getLocalSqlite();
    const stmt = db.prepare(`
      INSERT INTO books (id, file_name, file_path, title, author, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        file_path = excluded.file_path,
        title = excluded.title,
        author = excluded.author;
    `);

    for (const book of generatedBooks) {
      stmt.run(book.id, book.fileName, book.filePath, book.title, book.author || null, now, now);
    }
  }
}

// Get All Books with Progress
export async function getAllBooks(): Promise<BookRecord[]> {
  await syncBooksManifest();
  const d1 = await getD1();

  const manifestMap = new Map(generatedBooks.map(b => [b.id, b.url]));

  const query = `
    SELECT 
      b.id, b.file_name, b.file_path, b.title, b.author, b.page_count, b.created_at, b.updated_at,
      p.current_page, p.progress_percentage, p.scroll_position, p.updated_at as last_opened_at
    FROM books b
    LEFT JOIN reading_progress p ON b.id = p.book_id
    ORDER BY p.updated_at DESC, b.title ASC
  `;

  let rows: any[] = [];
  if (d1) {
    const res = await d1.prepare(query).all();
    rows = res.results || [];
  } else {
    const db = getLocalSqlite();
    rows = db.prepare(query).all();
  }

  return rows.map(row => ({
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

// Get Single Book By ID
export async function getBookById(id: string): Promise<BookRecord | null> {
  await syncBooksManifest();
  const d1 = await getD1();

  const manifestBook = generatedBooks.find(b => b.id === id);
  if (!manifestBook) return null;

  const query = `
    SELECT 
      b.id, b.file_name, b.file_path, b.title, b.author, b.page_count, b.created_at, b.updated_at,
      p.current_page, p.progress_percentage, p.scroll_position, p.updated_at as last_opened_at
    FROM books b
    LEFT JOIN reading_progress p ON b.id = p.book_id
    WHERE b.id = ?
  `;

  let row: any = null;
  if (d1) {
    row = await d1.prepare(query).bind(id).first();
  } else {
    const db = getLocalSqlite();
    row = db.prepare(query).get(id);
  }

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
    const db = getLocalSqlite();
    db.prepare(`
      INSERT INTO reading_progress (book_id, current_page, progress_percentage, scroll_position, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET
        current_page = excluded.current_page,
        progress_percentage = excluded.progress_percentage,
        scroll_position = excluded.scroll_position,
        updated_at = excluded.updated_at;
    `).run(bookId, currentPage, progressPercentage, scrollPosition, now);

    if (pageCount && pageCount > 0) {
      db.prepare(`UPDATE books SET page_count = ?, updated_at = ? WHERE id = ?`).run(pageCount, now, bookId);
    }
  }
}

// Bookmarks
export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const d1 = await getD1();
  const query = `SELECT id, book_id, page, label, created_at FROM bookmarks WHERE book_id = ? ORDER BY page ASC`;

  if (d1) {
    const res = await d1.prepare(query).bind(bookId).all();
    return (res.results || []) as unknown as Bookmark[];
  } else {
    const db = getLocalSqlite();
    return (db.prepare(query).all(bookId) || []) as unknown as Bookmark[];
  }
}

export async function addBookmark(bookId: string, page: number, label?: string): Promise<Bookmark> {
  const d1 = await getD1();
  const id = `bm_${bookId}_${page}_${Date.now()}`;
  const now = new Date().toISOString();
  const bookmarkLabel = label || `Page ${page}`;

  if (d1) {
    await d1.prepare(`
      INSERT INTO bookmarks (id, book_id, page, label, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING;
    `).bind(id, bookId, page, bookmarkLabel, now).run();
  } else {
    const db = getLocalSqlite();
    db.prepare(`
      INSERT INTO bookmarks (id, book_id, page, label, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING;
    `).run(id, bookId, page, bookmarkLabel, now);
  }

  return { id, book_id: bookId, page, label: bookmarkLabel, created_at: now };
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const d1 = await getD1();
  if (d1) {
    await d1.prepare(`DELETE FROM bookmarks WHERE id = ?`).bind(bookmarkId).run();
  } else {
    const db = getLocalSqlite();
    db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(bookmarkId);
  }
}

// Reader Settings
export async function getReaderSettings(): Promise<ReaderSettings> {
  const d1 = await getD1();
  const query = `SELECT id, theme, brightness, zoom, reading_mode, page_width, show_controls, updated_at FROM reader_settings WHERE id = 1`;

  let row: any = null;
  if (d1) {
    row = await d1.prepare(query).first();
  } else {
    const db = getLocalSqlite();
    row = db.prepare(query).get();
  }

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

export async function saveReaderSettings(settings: Partial<ReaderSettings>): Promise<ReaderSettings> {
  const d1 = await getD1();
  const current = await getReaderSettings();

  const updated: ReaderSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };

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

  if (d1) {
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
    const db = getLocalSqlite();
    db.prepare(query).run(
      updated.theme,
      updated.brightness,
      updated.zoom,
      updated.reading_mode,
      updated.page_width,
      updated.show_controls ? 1 : 0,
      updated.updated_at
    );
  }

  return updated;
}
