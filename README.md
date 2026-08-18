# 📖 Personal Kindle-Like PDF Reader

A polished, single-user personal Kindle & Apple Books-inspired PDF library and reader web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Cloudflare D1**, **Wrangler**, and **PDF.js**.

Designed for seamless reading across all your devices:
> **Open website → select a PDF → read → close browser → return later from any device → automatically continue from exactly where you stopped.**

---

## ✨ Features

- 📚 **Automatic Book Discovery**: Discovers `.pdf` files from `public/books/` or `public/book/` and automatically formats titles and author tags without manual database entry.
- ⚡ **Last Page Persistence**: Loads saved reading progress directly from Cloudflare D1 / local database and opens books immediately at your last page without blinking to page 1 first.
- 🎨 **Kindle & Apple Books Aesthetic**:
  - **Home Library**: Featured *Continue Reading* hero section with reading progress percentage, current page counter, search bar, and sorting controls.
  - **Distraction-Free Reader**: Auto-hiding header and floating controls toolbar that disappear after inactivity.
- 🌗 **Themes & Controls**:
  - **Themes**: Light, Sepia (warm e-reader tone), and Dark mode.
  - **Brightness Overlay**: Adjustable screen brightness slider (20% – 100%).
  - **Zoom & Layout**: 50% – 250% zoom scale, Page Max Width selection (Compact, Comfortable, Wide, Full Width).
  - **Reading Modes**: Continuous Scroll mode and Page-by-Page mode.
  - **Bookmarks**: Bookmark any page (`🔖`), open bookmarks drawer, and jump directly to bookmarked pages.
- ⌨️ **Keyboard Shortcuts**: Complete keyboard navigation support.
- 🔗 **Subpath Mounting Support**: Pre-configured with `basePath: "/reader"` to mount seamlessly as a sub-app under `/reader` on any existing parent domain or Webflow site.
- 🔒 **Zero Auth / Zero Upload Complexity**: Personal single-user web app — no signup, login, PDF uploads, or deletions. Static files are the source of truth for books.

---

## 🏗️ Architecture & Data Flow

```text
               ┌─────────────────────────────┐
               │        public/books/        │
               │                             │
               │  atomic-habits.pdf          │
               │  deep-work.pdf              │
               └──────────────┬──────────────┘
                              │
                    Build / Live Scanner
                              │
                              ▼
               ┌─────────────────────────────┐
               │    src/lib/db.ts Sync       │
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
               │       Cloudflare D1         │
               │   (or local .local-db.json) │
               └─────────────────────────────┘
```

- **Filesystem**: Stores actual PDF binary files in `public/books/`.
- **Cloudflare D1 / Local DB**: Stores metadata, reading progress, bookmarks, and reader preferences. Binary PDFs are **never** stored in D1.

---

## 📁 Project Structure

```text
.
├── migrations/
│   └── 0001_initial.sql           # D1 database schema
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
│   │       ├── ReaderControls.tsx # Auto-hiding top & bottom toolbar
│   │       ├── BookmarksDrawer.tsx# Bookmarks drawer
│   │       └── SettingsDrawer.tsx # Reader settings panel
│   └── lib/
│       ├── config.ts              # Subpath & URL helper
│       ├── db.ts                  # D1 & local database layer
│       └── generated-books.json   # Generated book manifest
├── next.config.ts                 # Next.config with basePath: "/reader"
├── wrangler.json                  # Cloudflare Wrangler & D1 binding configuration
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

Add your `.pdf` files into `public/books/`:

```text
public/books/
├── atomic-habits.pdf
├── deep-work.pdf
└── the-psychology-of-money.pdf
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000/reader](http://localhost:3000/reader) in your browser.

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
| `npm run cf-typegen` | Regenerate Wrangler types into `cloudflare-env.d.ts` |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE) © 2026 Rushikesh Shinde.
