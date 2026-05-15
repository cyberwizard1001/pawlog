# Pawlog — Claude context

Pawlog is a local copy management tool. It lets one user browse, edit, and version-control all product copy through a browser UI. Every save is a real git commit. It runs locally and is designed to eventually deploy to Azure Static Web Apps.

---

## Running the app

```bash
cd ~/Development/pawlog
npx astro dev --port 4321     # local dev server, hot-reload
npx astro build               # production build to dist/
node dist/server/entry.mjs    # run the production build
```

There are two git repos:
- `~/Development/pawlog/` — the app code
- `~/Development/pawlog/copy/` — the copy content (separate git history, excluded from app's .gitignore)

---

## Terminology

| Term | Meaning |
|---|---|
| Journey | Top-level grouping (was: channel). Corresponds to a folder in `copy/`. |
| Page | A JSON file within a journey (was: section). One file per page. |
| Section | A named group of copy items within a page (was: widget/group). Stored as `meta.groups[]`. |

---

## Architecture

```
src/lib/git.ts           Shell-out helpers — gitLog, gitShow, gitDiff, gitCommit, gitDelete, gitDeleteJourney, gitRecentLog
src/lib/content.ts       File I/O — getTree, readFile, writeFile; getJourneys/saveJourneys live here
src/layouts/Shell.astro  HTML shell; Alpine.js loaded from CDN here
src/components/Modal.astro  Reusable modal component (title, state props; body/footer slots)
src/pages/index.astro    Entire UI — Alpine.js x-data state, sidebar, table, slide-over panel
src/pages/api/           Eight API routes (tree, file, log, show, diff, page, journey, dashboard)
src/styles/global.css    All styles — CSS custom properties, no utility framework
copy/                    JSON files, one per page, organised by journey folder
```

The app is Astro SSR. The page tree is server-rendered. All dynamic behaviour (page selection, editing, history, diff) runs in the browser via Alpine.js fetching the API routes.

---

## Copy file schema

Every file in `copy/` follows this shape:

```json
{
  "meta": { "page": "...", "description": "...", "groups": ["Group A", "Group B"] },
  "items": {
    "snake_case_key": {
      "label": "Human-readable name",
      "description": "Optional usage note",
      "content": "The actual copy string.",
      "group": "Optional group name"
    }
  }
}
```

Keys must be stable snake_case — developers reference them in code.

---

## Adding journeys and pages

**New page:** create a `.json` file in the relevant journey folder, or use the + button in the sidebar.

**New journey:** use the "New journey" button at the bottom of the sidebar. Journeys are stored in `copy/journeys.json` (versioned in the copy sub-repo). Falls back to a hardcoded list if `journeys.json` doesn't exist.

---

## API routes

| Route | Method | What it does |
|---|---|---|
| `/api/tree` | GET | Returns the full journey/page tree |
| `/api/file?path=` | GET | Returns a copy file as JSON |
| `/api/file?path=` | POST | Writes file + runs git commit. Body: `{ data, note }` |
| `/api/log?path=` | GET | Returns `LogEntry[]` from git log |
| `/api/show?path=&hash=` | GET | Returns raw file content at a git hash |
| `/api/page` | POST | Create page. Body: `{ journey, slug, page, description? }` |
| `/api/page` | PATCH | Edit page. Body: `{ path, page, description? }` |
| `/api/page` | DELETE | Delete page. Body: `{ path }` |
| `/api/journey` | POST | Create journey. Body: `{ slug, name, description? }` |
| `/api/journey` | PATCH | Edit journey. Body: `{ slug, name, description? }` |
| `/api/journey` | DELETE | Delete journey + all its pages. Body: `{ slug }` |
| `/api/diff?path=&from=&to=` | GET | Returns raw git diff between two hashes |
| `/api/dashboard` | GET | Returns `{ stats: { journeys, pages, items }, recent: RecentCommit[] }` |

All `path` params are relative to `copy/`, e.g. `website/homepage.json`.

---

## Key conventions

- **No heavy reactive frameworks.** Alpine.js only, loaded from CDN. Do not add React, Vue, or Svelte.
- **No CSS frameworks.** All styles in `src/styles/global.css` using CSS custom properties.
- **No new server dependencies** unless strictly necessary — the whole point is a thin, maintainable stack.
- **API routes use named exports** (`export const GET`, `export const POST`), not default exports. This is the Astro SSR convention.
- **`COPY_DIR`** is resolved relative to `src/lib/git.ts` using `import.meta.url`. Don't hardcode paths.
- **git operations run with `cwd: COPY_DIR`** (the `copy/` sub-repo), not the app root.
- Commits auto-include a timestamp: `<note> — YYYY-MM-DD HH:MM:SS`. The note is optional.
- Saves are non-destructive in git — every save appends a new commit; no force-push or amend.

---

## Things to watch out for

- The `copy/` directory is a nested git repo. Running `git` commands from the app root won't see copy history — always `cd copy/` first or pass `cwd: COPY_DIR`.
- Alpine.js `x-data` is a plain JS object string inside an HTML attribute. Quote escaping is important in `index.astro`.
- `src/lib/content.ts` imports from `./git.ts` with the `.ts` extension — Astro/Vite requires this in ESM mode.
- `getJourneys()` in `content.ts` controls sidebar order. Folders not listed in `journeys.json` (or the fallback) are silently ignored.

---

## Azure deployment (future)

- Target: Azure Static Web Apps + Azure Functions
- The Node adapter (`dist/server/entry.mjs`) is the production entry point
- API routes map to Azure Functions in the SWA model with no code changes
- The `copy/` repo would be pushed to a remote (GitHub or Azure DevOps) for durability
