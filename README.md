# 📖 Personal Kindle-Like PDF Reader

A polished, single-user personal Kindle & Apple Books-inspired PDF library and reader web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Webflow Cloud Key-Value (KV) Store**, **Wrangler**, and **PDF.js**.

Designed for seamless reading across all your devices:
> **Open website → select a PDF → read → close browser → return later from any device → automatically continue from exactly where you stopped.**

---

## ✨ Features

- 📚 **Automatic Book Discovery & Naming Parser**: Discovers `.pdf` files from `public/books/` and automatically parses titles, languages, and author tags from `Book Name (Language) [Author Name].pdf` format without manual database entries.
- ⚡ **Last Page Persistence**: Loads saved reading progress directly from Webflow Cloud Key-Value (KV) Store / local `.local-kv.json` with an initial scroll guard that opens books directly at your last page without overwriting progress to page 1.
- 🧹 **Automatic Obsolete Book Purging**: Automatically deletes metadata, reading progress, and bookmark keys from KV storage when old `.pdf` files are removed from the repository.
- 📊 **Top Scrubbable Progress Bar**: Interactive top reading progress bar with real-time mouse/drag scrubbing and page hover tooltips (`Page X of Y`).
- 🎨 **Kindle & Apple Books Aesthetic**:
  - **Home Library**: Featured *Continue Reading* hero section with reading progress percentage, current page counter, search bar, and sorting controls.
  - **Distraction-Free Reader**: Auto-hiding header and floating controls toolbar that disappear after inactivity.
- 🌗 **Themes & Persisted Settings**:
  - **Themes**: Light, Sepia (warm e-reader tone), and Dark mode.
  - **Brightness Overlay**: Adjustable screen brightness slider (20% – 100%).
  - **Zoom & Layout**: 50% – 250% zoom scale, Page Max Width selection (Compact, Comfortable, Wide, Full Width).
  - **Reading Modes**: Continuous Scroll mode and Page-by-Page mode.
  - **Bookmarks**: Bookmark any page (`🔖`), open bookmarks drawer, and jump directly to bookmarked pages.
  - **KV Persistence**: All reader settings (`theme`, `brightness`, `zoom`, `reading_mode`, `page_width`) persist automatically across sessions in KV storage.
- ⌨️ **Keyboard Shortcuts**: Complete keyboard navigation support.
- 🔗 **Subpath Mounting Support**: Pre-configured with `basePath: "/reader"` to mount seamlessly as a sub-app under `/reader` on any existing parent domain or Webflow site.
- 🔒 **Zero Auth / Zero Upload Complexity**: Personal single-user web app — no signup, login, PDF uploads, or deletions. Static files are the source of truth for books.

---

## 🏗️ Architecture & Data Flow

```text
               ┌─────────────────────────────┐
               │        public/books/        │
               │                             │
               │  Book Name (Lang) [Author]  │
               └──────────────┬──────────────┘
                              │
                    Build / Live Scanner
                              │
                              ▼
               ┌─────────────────────────────┐
               │    src/lib/db.ts Manifest   │
               └──────────────┬──────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │        PDF Reader           │
               │  /reader/read/[bookId]      │
               └──────────────┬──────────────┘
                              │
                     Reading state & settings
                              │
                              ▼
               ┌─────────────────────────────┐
               │   Webflow Cloud KV Store    │
               │   (or local .local-kv.json) │
               └─────────────────────────────┘
```

- **Filesystem**: Stores actual PDF binary files in `public/books/`.
- **Webflow Cloud KV Store / Local `.local-kv.json`**: Stores book manifests (`books_manifest`), reading progress (`progress:<bookId>`), bookmarks (`bookmarks:<bookId>`), and reader settings (`reader_settings`). Binary PDFs are **never** stored in KV storage.

---

## 📁 Project Structure

```text
.
├── public/
│   ├── books/                     # PDF books directory (Source of Truth)
│   └── pdf.worker.min.mjs         # PDF.js web worker asset
├── scripts/
│   ├── generate-books.ts          # Manifest generator script
│   └── copy-pdf-worker.js         # PDF worker copy script
├── src/
│   ├── app/
│   │   ├── api/                   # API routes for books, progress, bookmarks, settings
│   │   ├── read/[bookId]/         # PDF Reader page
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Home Library page
│   ├── components/
│   │   ├── BookCard.tsx           # Book card & Continue Reading hero
│   │   ├── BookCover.tsx          # PDF first-page thumbnail renderer
│   │   └── reader/
│   │       ├── PdfViewer.tsx      # Canvas PDF renderer with lazy rendering
│   │       ├── ReaderControls.tsx # Auto-hiding top & bottom toolbar & progress bar
│   │       ├── BookmarksDrawer.tsx# Bookmarks drawer
│   │       └── SettingsDrawer.tsx # Reader settings panel
│   └── lib/
│       ├── config.ts              # Subpath & Environment helper
│       ├── db.ts                  # Key-Value (KV) storage layer
│       └── generated-books.json   # Generated book manifest
├── .env                           # Local environment config (ENVIRONMENT="dev")
├── cloudflare-env.d.ts            # Cloudflare KV binding interface
├── next.config.ts                 # Next.config with basePath: "/reader"
├── wrangler.json                  # Cloudflare Wrangler & KV binding configuration
├── webflow.json                   # Webflow Cloud configuration
└── package.json
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Add PDF Books

Add your `.pdf` files into `public/books/` using `Title (Language) [Author Name].pdf` format:

```text
public/books/
├── Atomic Habits (English) [James Clear].pdf
├── Deep Work (English) [Cal Newport].pdf
└── The Alchemist (Marathi) [Paulo Coelho].pdf
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000/reader](http://localhost:3000/reader) in your browser.

---

## ⚙️ Environment Variables

Configure `ENVIRONMENT` in your environment file or deployment dashboard:

| Environment | Variable Value | Target KV Storage |
| :--- | :--- | :--- |
| **Local Dev** | `ENVIRONMENT="dev"` | File-backed `.local-kv.json` store |
| **Webflow Cloud** | `ENVIRONMENT="production"` | Webflow Cloud KV Store (`KV` namespace binding) |

---

## ⌨️ Reader Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `←` / `A` | Previous page |
| `→` / `D` / `Space` | Next page |
| `Shift + Space` | Previous page |
| `B` | Toggle bookmark on current page |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `F` | Toggle Fullscreen |
| `Esc` | Exit fullscreen / close settings drawers |

---

## 🛠️ CLI Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Start Next.js dev server (http://localhost:3000/reader) |
| `npm run build` | Create an optimized production build |
| `npm run start` | Run production server |
| `npm run generate-books` | Regenerate book manifest from `public/books/` |
| `npm run deploy` | Deploy to Webflow Cloud (`webflow cloud deploy`) |
| `npm run preview` | Build with OpenNext and run local Cloudflare preview |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE) © 2026 Rushikesh Shinde.
