import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createSale, getRecentSales, getStats, initDb, listProducts } from './db';

const isDev = !app.isPackaged;

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

app.whenReady().then(() => {
  initDb();
  ipcMain.handle('dashboard:get', async () => getStats());
  ipcMain.handle('products:list', async () => listProducts());
  ipcMain.handle('sales:recent', async () => getRecentSales());
  ipcMain.handle('sales:create', async (_event, payload) => createSale(payload));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
