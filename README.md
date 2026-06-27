# Offline POS

A polished offline-first point-of-sale desktop app built with Vite, React, Electron, and SQLite.

## Requirements

- Node.js 20 or newer recommended
- npm

## Install

From the project root:

```bash
npm install
```

If you already have `node_modules` and see a `better-sqlite3` runtime mismatch, rebuild the native deps with:

```bash
npm run rebuild:native
```

## Run the app

Start the Electron desktop app in development mode:

```bash
npm run electron:dev
```

This runs:

- the Vite renderer on `http://localhost:5173`
- the Electron main process compiler in watch mode
- the Electron shell once the app is ready

If you only want the web renderer during UI work, run:

```bash
npm run dev
```

## Build

Create production assets:

```bash
npm run build
```

Build the Electron app package:

```bash
npm run electron:build
```

## What the app does

- Loads seeded products into a local SQLite database on first launch
- Loads seeded service/package templates into a local SQLite database on first launch
- Lets you create invoices/bills and print receipts
- Tracks inventory adjustments
- Lets you create and browse treatment/service packages
- Includes revenue, customer, visit, and loyalty reports
- Lets you configure salon information and loyalty rules
- Supports local SQLite backup and restore from the Settings screen
- Keeps sync queue state for offline-first workflows

## Local data

The SQLite database is stored in the Electron user data directory as:

```text
offline-pos.sqlite3
```

## Troubleshooting

- If `better-sqlite3` fails to install, make sure your system has the native build tools required for Node modules.
- If Electron reports a `NODE_MODULE_VERSION` mismatch, run `npm run rebuild:native` and start the app again.
- If the desktop app does not open, check that the renderer is available on port `5173`.

## Project Scripts

- `npm run dev` - start the Vite dev server
- `npm run electron:dev` - start the full Electron desktop app in development
- `npm run build` - build renderer plus Electron main process
- `npm run preview` - preview the Vite production build
- `npm run electron:build` - build the packaged Electron app
