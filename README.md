# Pawlog

A local copy management tool — browse, edit, and version-control product copy through a browser UI. Every save is a real git commit.

Author: Nirmal Karthikeyan

---

## What it does

Pawlog gives you a single UI to view and edit copy across journeys. It runs locally and saves everything to a separate git repo, so you get full history, diffs between versions, and the ability to revert by creating a new commit from an old snapshot.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro 5 (SSR, Node adapter) | Server-renders the page tree; API routes for file/git ops; deploys cleanly to Azure |
| Interactivity | Alpine.js (CDN) | No build step; handles sidebar state, slide-over panel, fetch calls |
| Styles | Plain CSS with custom properties | Easy to maintain; no toolchain dependency |
| Versioning | Git (shell-out) | Real git history, diffs, and future-proof extensibility |
| Runtime | Node.js | Standard; Bun-compatible as a drop-in if needed |
| Copy storage | JSON files in a nested git repo | Human-readable, portable, diffable |

---

## Getting started

### Prerequisites

- Node.js 18+
- Git

### Run locally

```bash
cd ~/Development/pawlog
npx astro dev --port 4321
```

Open [http://localhost:4321](http://localhost:4321).

### Build for production

```bash
npx astro build
node dist/server/entry.mjs
```

---

## Project structure

```
pawlog/
  copy/                        # Separate git repo — source of truth for all copy
    <journey>/                 # One folder per journey (you decide the structure)
      <page>.json              # One file per page

  src/
    layouts/
      Shell.astro              # HTML shell — loads Alpine.js from CDN, global CSS
    components/
      Modal.astro              # Reusable modal (title, state props; body/footer slots)
    pages/
      index.astro              # Main UI: sidebar + copy table + slide-over editor
      api/
        tree.ts                # GET  /api/tree      — full journey/page tree
        file.ts                # GET  /api/file      — read a copy file
                               # POST /api/file      — write + git commit
        log.ts                 # GET  /api/log       — git log for a file
        show.ts                # GET  /api/show      — file content at a specific hash
        diff.ts                # GET  /api/diff      — git diff between two hashes
        page.ts                # POST/PATCH/DELETE   — create, rename, delete pages
        journey.ts             # POST/PATCH/DELETE   — create, rename, delete journeys
        dashboard.ts           # GET  /api/dashboard — stats + recent commits
    lib/
      git.ts                   # Shell-out helpers: gitLog, gitShow, gitDiff, gitCommit, etc.
      content.ts               # File I/O: getTree, readFile, writeFile, getJourneys, saveJourneys
    styles/
      global.css               # All styles — CSS custom properties, no framework

  astro.config.mjs             # SSR mode, Node adapter
  package.json
  tsconfig.json
  .gitignore                   # Excludes copy/ (it's its own git repo)
```

---

## The copy folder

`copy/` is a separate git repository. You decide what to put in it. The structure is:

- **Journeys** — top-level folders (e.g. `copy/website/`, `copy/app/`)
- **Pages** — JSON files within a journey (e.g. `copy/website/homepage.json`)

Journey names and ordering are stored in `copy/journeys.json`. You can create and rename journeys and pages from the UI; no code changes needed.

---

## Copy file schema

Each page is a JSON file with this shape:

```json
{
  "meta": {
    "page": "Homepage",
    "description": "Main website homepage",
    "groups": ["Hero", "Footer"]
  },
  "items": {
    "hero_headline": {
      "label": "Hero Headline",
      "description": "H1, above the fold",
      "content": "The actual copy string.",
      "group": "Hero"
    }
  }
}
```

| Field | Required | Purpose |
|---|---|---|
| `meta.page` | Yes | Display name shown in the UI header |
| `meta.description` | No | Subtitle shown under the page title |
| `meta.groups` | No | Ordered list of group names for display |
| `items.<key>.label` | Yes | Human-readable name shown in the table |
| `items.<key>.description` | No | Usage note |
| `items.<key>.content` | Yes | The actual copy string |
| `items.<key>.group` | No | Which group this item belongs to |

Keys are snake_case and stable — developers reference them in code.

---

## How versioning works

`copy/` is its own git repository, separate from the app code. Copy history is clean and isolated.

When you save an item in the UI:
1. Updated JSON is written to disk
2. `git add <file>` stages it
3. `git commit -m "<note> — <ISO timestamp>"` records the change

The History tab fetches `git log -- <file>` for that page. Select two commits and click **Show Diff** to see what changed.

To inspect history directly:
```bash
cd ~/Development/pawlog/copy
git log --oneline -- <journey>/<page>.json
git diff <hash1> <hash2> -- <journey>/<page>.json
git show <hash>
```

---

## API reference

All routes are under `/api/`. File paths are always relative to `copy/` (e.g. `website/homepage.json`).

| Method | Route | Params / Body | Description |
|---|---|---|---|
| GET | `/api/tree` | — | Full journey → page tree |
| GET | `/api/file` | `?path=` | Read a copy file as JSON |
| POST | `/api/file` | `?path=`, body: `{ data, note }` | Write a copy file and commit |
| GET | `/api/log` | `?path=` | Git log for a file. Returns `LogEntry[]` |
| GET | `/api/show` | `?path=&hash=` | File content at a specific git hash |
| GET | `/api/diff` | `?path=&from=&to=` | Raw git diff between two hashes |
| POST | `/api/page` | `{ journey, slug, page, description? }` | Create page |
| PATCH | `/api/page` | `{ path, page, description? }` | Rename/edit page metadata |
| DELETE | `/api/page` | `{ path }` | Delete page |
| POST | `/api/journey` | `{ slug, name, description? }` | Create journey |
| PATCH | `/api/journey` | `{ slug, name, description? }` | Rename/edit journey |
| DELETE | `/api/journey` | `{ slug }` | Delete journey and all its pages |
| GET | `/api/dashboard` | — | `{ stats: { journeys, pages, items }, recent: RecentCommit[] }` |

---

## Deployment

Astro's Node adapter produces a standalone server at `dist/server/entry.mjs`. Designed to be able deploy to Azure, but the production build is a standard Node server so it'll run anywhere.
