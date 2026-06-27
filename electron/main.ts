import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import {
  adjustInventory,
  backupDatabase,
  deleteProduct,
  deleteProductPermanently,
  createProduct,
  createCustomer,
  createService,
  createVisit,
  redeemCustomerPoints,
  createSale,
  deleteCustomer,
  getRecentSales,
  getStats,
  getReports,
  getCustomerProfile,
  getSettings,
  initDb,
  findCustomers,
  listCustomers,
  listInventory,
  listProducts,
  listServices,
  restoreDatabase,
  updateLoyaltyRules,
  updateSalonInfo,
  updateCustomer,
} from './db';
import { SyncService } from './sync';

const isDev = !app.isPackaged;
const syncService = new SyncService();

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#07111f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

function buildReceiptHtml(payload: {
  receiptNo: string;
  cashierName: string;
  paymentMethod: string;
  createdAt: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  detailedItems: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}) {
  const { salonInfo } = getSettings();
  const money = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
  });

  const rows = payload.detailedItems
    .map(
      (item) => `
      <tr>
        <td>${item.productName}<br><span>${item.quantity} x ${money.format(item.unitPrice)}</span></td>
        <td style="text-align:right">${money.format(item.lineTotal)}</td>
      </tr>`
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #fff;
            color: #111;
            padding: 20px;
            width: 280px;
          }
          h1, p { margin: 0; }
          .muted { color: #666; font-size: 12px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 13px;
          }
          td {
            padding: 8px 0;
            vertical-align: top;
            border-bottom: 1px dashed #ddd;
          }
          .totals {
            margin-top: 12px;
            font-size: 13px;
          }
          .totals div {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
          }
          .grand {
            font-weight: 700;
            font-size: 15px;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <h1>Offline POS</h1>
        <p>${salonInfo.name}</p>
        <p class="muted">${salonInfo.tagline}</p>
        <p class="muted">${payload.receiptNo}</p>
        <p class="muted">${salonInfo.phone}${salonInfo.email ? ` · ${salonInfo.email}` : ''}</p>
        <p class="muted">${salonInfo.address}</p>
        <p class="muted">${payload.cashierName} · ${new Date(payload.createdAt).toLocaleString()}</p>
        <table>${rows}</table>
        <div class="totals">
          <div><span>Subtotal</span><span>${money.format(payload.subtotal)}</span></div>
          <div><span>Tax</span><span>${money.format(payload.taxTotal)}</span></div>
          <div><span>Discount</span><span>${money.format(payload.discountTotal)}</span></div>
          <div class="grand"><span>Total</span><span>${money.format(payload.grandTotal)}</span></div>
        </div>
        <p class="muted" style="margin-top:14px;">Payment: ${payload.paymentMethod}</p>
      </body>
    </html>
  `;
}

async function printReceipt(payload: Parameters<typeof buildReceiptHtml>[0]) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildReceiptHtml(payload))}`);
  const result = await win.webContents.print({ silent: false, printBackground: true });
  win.close();
  return result;
}

app.whenReady().then(() => {
  initDb();
  ipcMain.handle('dashboard:get', async () => getStats());
  ipcMain.handle('reports:get', async () => getReports());
  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:update-salon', async (_event, payload) => updateSalonInfo(payload));
  ipcMain.handle('settings:update-loyalty', async (_event, payload) => updateLoyaltyRules(payload));
  ipcMain.handle('database:backup', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Backup Offline POS Database',
      defaultPath: `offline-pos-backup-${new Date().toISOString().slice(0, 10)}.sqlite3`,
      filters: [{ name: 'SQLite Database', extensions: ['sqlite3', 'db'] }],
    });
    if (result.canceled || !result.filePath) {
      return { saved: false as const };
    }
    const backupPath = backupDatabase(result.filePath);
    return { saved: true as const, path: backupPath };
  });
  ipcMain.handle('database:restore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore Offline POS Database',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['sqlite3', 'db'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { restored: false as const };
    }
    const restored = restoreDatabase(result.filePaths[0]);
    return { restored: true as const, ...restored };
  });
  ipcMain.handle('products:list', async () => listProducts());
  ipcMain.handle('customers:list', async () => listCustomers());
  ipcMain.handle('customers:find', async (_event, payload) => findCustomers(payload?.query ?? '', payload?.limit ?? 10));
  ipcMain.handle('customers:profile', async (_event, payload) => getCustomerProfile(payload?.customerId ?? ''));
  ipcMain.handle('sales:recent', async () => getRecentSales());
  ipcMain.handle('sales:create', async (_event, payload) => createSale(payload));
  ipcMain.handle('customers:create', async (_event, payload) => createCustomer(payload));
  ipcMain.handle('customers:update', async (_event, payload) => updateCustomer(payload));
  ipcMain.handle('customers:delete', async (_event, payload) => deleteCustomer(payload));
  ipcMain.handle('visits:create', async (_event, payload) => createVisit(payload));
  ipcMain.handle('loyalty:redeem', async (_event, payload) => redeemCustomerPoints(payload));
  ipcMain.handle('products:create', async (_event, payload) => createProduct(payload));
  ipcMain.handle('services:list', async () => listServices());
  ipcMain.handle('services:create', async (_event, payload) => createService(payload));
  ipcMain.handle('products:delete', async (_event, payload) => deleteProduct(payload));
  ipcMain.handle('products:delete-permanent', async (_event, payload) =>
    deleteProductPermanently(payload)
  );
  ipcMain.handle('sync:status', async () => syncService.getStatus());
  ipcMain.handle('sync:run', async () => syncService.syncOnce());
  ipcMain.handle('inventory:list', async () => listInventory());
  ipcMain.handle('inventory:adjust', async (_event, payload) => adjustInventory(payload));
  ipcMain.handle('receipt:print', async (_event, payload) => printReceipt(payload));

  createWindow();
  syncService.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  syncService.stop();
  if (process.platform !== 'darwin') app.quit();
});
