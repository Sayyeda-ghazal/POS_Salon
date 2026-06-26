# Project Status

This project is an offline-first POS desktop app built with Vite, React, Electron, and SQLite.

## Already Working

- Electron desktop shell launches the app and loads the renderer.
- Vite dev server runs the React UI in the browser.
- Local SQLite database is created automatically on first launch.
- Seed sample products are inserted into the database when it is empty.
- Product list is loaded into the UI from SQLite.
- POS cart flow works:
  - add products to cart
  - scan barcodes from keyboard input
  - calculate subtotal, tax, and total
  - create a sale locally
- Receipt printing is wired through Electron.
- Inventory list is available in the UI.
- Inventory adjustments are supported and stored locally.
- Recent sales and dashboard totals are loaded from the local database.
- Offline sync scaffolding is implemented:
  - sync queue table exists locally
  - Neon sync service is wired in Electron main
  - sync can be enabled with `NEON_DATABASE_URL`

## Local Data

- SQLite file name: `offline-pos.sqlite3`
- Storage location: Electron user data directory

## Runtime Files

- `electron/main.ts` starts the window and registers IPC handlers.
- `electron/preload.ts` exposes the POS API to the renderer.
- `electron/db.ts` manages the SQLite database and seeded products.
- `electron/sync.ts` handles optional Neon sync.

## Current Limits

- The app starts in offline mode by default.
- Neon sync is disabled unless `NEON_DATABASE_URL` is configured.
- Sample data is only seeded for products, not sales history.

## Useful Commands

```bash
npm install
npm run electron:dev
npm run rebuild:native
```

