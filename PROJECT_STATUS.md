# Project Status

This project is an offline-first POS desktop app built with Vite, React, Electron, and SQLite.

## Already Working

- Electron desktop shell launches the app and loads the renderer.
- Vite dev server runs the React UI in the browser.
- Local SQLite database is created automatically on first launch.
- Seed sample products are inserted into the database when it is empty.
- Seed sample services/packages are inserted into the database when it is empty.
- Product list is loaded into the UI from SQLite.
- Service/package catalog is managed in the UI and can be used when logging visits.
- Salon information and loyalty rules can be configured from the Settings screen.
- POS cart flow works:
  - add products to cart
  - scan barcodes from keyboard input
  - calculate subtotal, tax, and total
  - create invoices/bills locally
- Receipt printing is wired through Electron.
- Inventory list is available in the UI.
- Inventory adjustments are supported and stored locally.
- Billing screen stores transaction records and prints receipts.
- Reports screen shows revenue, customer, visit, and loyalty summaries.
- Database backup and restore actions are available in Settings.
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
- `electron/db.ts` manages the SQLite database, settings, seeded products, and services.
- `electron/sync.ts` handles optional Neon sync.

## Current Limits

- The app starts in offline mode by default.
- Neon sync is disabled unless `NEON_DATABASE_URL` is configured.
- Sample data is only seeded for products, not sales history.
- Backup and restore currently operate on the local SQLite file only.

## Useful Commands

```bash
npm install
npm run electron:dev
npm run rebuild:native
```
