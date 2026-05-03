# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**万物手札 (Universal Journal H5)** — a vanilla JavaScript mobile journal/note-taking app with PWA support. Uses a **micro-kernel + plugin architecture** with no frontend framework (no React/Vue/Angular). All modules are exposed as globals on `window`.

**Version**: 7.0.3 | **License**: MIT

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vanilla JS (no framework) |
| Architecture | Micro-kernel + Plugin system |
| Bundler | Vite 5.x |
| Storage | IndexedDB (`idb` v7.1.1) |
| Routing | Custom hash router (`src/core/router.js`) |
| State | Custom Store (pub/sub with undo/redo/snapshots) |
| Encryption | Web Crypto API (AES-256-GCM + PBKDF2) |
| Charts | ECharts (dynamic CDN load) |
| Native | Capacitor (iOS/Android wrapper) |

## Development Commands

```bash
npm run dev       # Start Vite dev server (port 3000, API proxy to 47.236.199.100:4000)
npm run build     # Build production output to dist/
npm run preview   # Preview built output
npm run test      # Run Jest unit/integration tests
npm run lint      # ESLint on src/
npm run format    # Prettier on src/
```

**PowerShell quality gates** (Windows):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-all.ps1       # Full pre-commit check
powershell -ExecutionPolicy Bypass -File scripts\quality-gate.ps1  # Quality gate
powershell -ExecutionPolicy Bypass -File scripts\css-check.ps1     # CSS syntax check
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1 -FileMode  # Smoke test
```

**Full functional test** (standalone Playwright, 38 checks in 3 rounds):
```bash
node full-test-v7.mjs  # Runs against localhost:3003
```

## Code Architecture

### Entry Point

`index.html` loads all JS/CSS files via `<script>` and `<link>` tags (no module bundling for runtime). `src/main.js` is the bootstrap that initializes StorageService, registers plugins, boots the Kernel, and sets up UI/views.

### Micro-Kernel Architecture

```
src/
├── main.js              # Bootstrap: init storage → register plugins → boot kernel → init UI
├── core/                # Core infrastructure (6 files)
│   ├── kernel.js        # Micro-kernel: plugin lifecycle, boot sequence, global events
│   ├── store.js         # State management: pub/sub, undo/redo, snapshots, hydrate/persist
│   ├── router.js        # Hash-based routing
│   ├── hooks.js         # Plugin hook system
│   ├── plugin-loader.js # Plugin loader with dependency resolution + PluginAPI
│   └── event-bus.js     # Event bus (pub/sub)
├── services/            # Service layer (12 files)
│   ├── storage.js       # IndexedDB storage service
│   ├── crypto.js        # Encryption (AES-256-GCM + PBKDF2)
│   ├── sync.js          # GitHub Gist sync
│   ├── sync-merge.js    # Merge conflict resolution
│   ├── migration.js     # DB schema migration
│   ├── ai-lite.js       # Offline AI (summaries/tags/sentiment)
│   ├── mood.js          # Mood tracking
│   ├── streak.js        # Streak tracking
│   └── ... (image, metadata, block-parser, link-parser)
├── plugins/             # 30+ feature plugins
│   ├── auth/            # Authentication
│   ├── editor/          # Rich text editor
│   ├── records/         # Record CRUD
│   ├── search/          # Full-text search
│   ├── sync/            # Sync settings UI
│   ├── auto-sync/       # Auto background sync
│   ├── controller/      # Navigation controller
│   └── ... (calendar, timeline, favorites, templates, trash, batch, draft, tags,
│            visuals, theme, hotkeys, markdown, review, graph, mood, transitions,
│            profile, ui-effects, settings, security)
├── views/               # Page-level views (HomePage, etc.)
├── components/          # Reusable UI components
├── hooks/               # Data aggregation layer
└── styles/              # Theme-specific styles
```

### Key Architectural Patterns

1. **Global module exposure**: All core classes are attached to `window` (e.g., `window.Kernel`, `window.Store`, `window.Router`). **Always use `window.` prefix when referencing globals.**

2. **Plugin lifecycle**: Each plugin implements `load()` (register hooks/routes/UI) and `start()` (activate). The PluginLoader handles dependency ordering.

3. **Store pattern**: Pub/sub state management with `dispatch()`, `subscribe()`, `hydrate()` (restore from IndexedDB), and `persist()` (save to IndexedDB). Supports undo/redo and snapshots.

4. **Hash routing**: URL fragments drive navigation (e.g., `#editor?mode=create`). Routes map to page visibility toggling via `updatePageVisibility()`.

5. **Vite static serving**: The Vite config includes custom plugins that serve `src/` as static files during dev and copy `src/` to `dist/src/` during build. Runtime loads files directly, not through Vite's module system.

### Testing

**Three-layer strategy:**
- **Jest unit tests** (`tests/unit/*.test.js`) — 5 test files covering event-bus, image-service, plugin-loader, router, store. Uses jsdom with mocked IndexedDB/localStorage/crypto.
- **Jest integration tests** (`tests/integration/workflow.test.js`) — end-to-end workflow in jsdom.
- **Playwright E2E** (`e2e/`) — real browser tests against localhost:3001.
- **Full smoke test** (`full-test-v7.mjs`) — standalone Playwright script, 38 checks across 3 rounds against localhost:3003. This is the **minimum pass bar** before delivery.

### Important Constraints

- **No framework dependencies** — all code is vanilla JS with DOM manipulation
- **`index.html`** contains version parameters (`?v=`) for cache busting
- **`style.css`** and **`animations.css`** are large global stylesheets (~153KB combined)
- **`sw.js`** is the Service Worker for offline caching
- **Server proxy**: dev server proxies `/api` to `http://47.236.199.100:4000`

## Agent Development Rules

Read `AGENTS.md` for the full development workflow. Key rules:

1. **Design first**: Any change > 3 files must update `DESIGN.md` first
2. **Self-review**: Review your own code as if reviewing someone else's
3. **Real environment validation**: CSS bracket balance + JS syntax + full interaction walkthrough required
4. **Loop detection**: Same operation 3 times with no progress → stop and rethink
5. **Directory hygiene**: Root directory only keeps 6 categories of files

## Common Pitfalls (Historical Lessons)

| Issue | Lesson |
|-------|--------|
| State variable naming | Use clear names; return navigation uses `previousPage` |
| Search without debounce | All search/filter/input must have debounce |
| Fake security claims | Security declarations must match actual implementation |
| CSS brace mismatch | Run `css-check.ps1` after every CSS modification |
| Temporary doc sprawl | Put temp docs in `docs/`, not root |
| Auth 401 race condition | Kernel spread copies can cause state desync; AutoSyncPlugin 401 must not clear new registration sessions |
| "Button not working" but element exists | May be `opacity: 0` — check DOM visibility |
| `replace_all` + regex danger | Can accidentally match syntax; always review changes line by line |
