import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';
import type { CartItem, Product, SaleSummary } from './schema';

type SaleRecord = SaleSummary & {
  id: string;
  receiptNo: string;
  cashierName: string;
  paymentMethod: string;
  createdAt: string;
  itemCount: number;
  detailedItems?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

export type SyncQueueRow = {
  id: string;
  entityType: string;
  entityId: string;
  payload: string;
  status: string;
  createdAt: string;
  syncedAt: string | null;
};

let database: InstanceType<typeof Database> | null = null;
let initialized = false;

function getDatabase() {
  if (!database) {
    const dbPath = path.join(app.getPath('userData'), 'offline-pos.sqlite3');
    database = new Database(dbPath);
    database.pragma('journal_mode = WAL');
  }
  return database;
}

const money = (value: number) => Math.round(value * 100) / 100;

export function initDb() {
  if (initialized) return;
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      taxRate REAL NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      receiptNo TEXT NOT NULL,
      cashierName TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxTotal REAL NOT NULL,
      discountTotal REAL NOT NULL,
      grandTotal REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      itemCount INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      lineTotal REAL NOT NULL,
      FOREIGN KEY (saleId) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL,
      syncedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (count.count === 0) {
    const seed = db.prepare(`
      INSERT INTO products (id, sku, barcode, name, category, price, stock, taxRate, isActive)
      VALUES (@id, @sku, @barcode, @name, @category, @price, @stock, @taxRate, 1)
    `);
    const rows: Omit<Product, 'isActive'>[] = [
      { id: crypto.randomUUID(), sku: 'BRD-1001', barcode: '1110001110001', name: 'Sourdough Bread', category: 'Bakery', price: 4.5, stock: 42, taxRate: 0.08 },
      { id: crypto.randomUUID(), sku: 'MIL-2001', barcode: '2220002220002', name: 'Whole Milk', category: 'Dairy', price: 3.25, stock: 30, taxRate: 0.08 },
      { id: crypto.randomUUID(), sku: 'CF-3001', barcode: '3330003330003', name: 'House Coffee', category: 'Beverages', price: 6.75, stock: 18, taxRate: 0.08 },
      { id: crypto.randomUUID(), sku: 'SNK-4001', barcode: '4440004440004', name: 'Trail Mix', category: 'Snacks', price: 5.95, stock: 25, taxRate: 0.08 },
      { id: crypto.randomUUID(), sku: 'FR-5001', barcode: '5550005550005', name: 'Bananas', category: 'Produce', price: 2.99, stock: 50, taxRate: 0.08 },
    ];
    for (const row of rows) seed.run(row);
  }

  initialized = true;
}

export function listProducts(): Product[] {
  return getDatabase()
    .prepare('SELECT * FROM products WHERE isActive = 1 ORDER BY category, name')
    .all() as Product[];
}

export function getStats() {
  const db = getDatabase();
  const salesToday = db
    .prepare(`SELECT COALESCE(SUM(grandTotal), 0) as total FROM sales WHERE date(createdAt) = date('now')`)
    .get() as { total: number };
  const receiptCount = db
    .prepare(`SELECT COUNT(*) as count FROM sales WHERE date(createdAt) = date('now')`)
    .get() as { count: number };
  const productCount = db
    .prepare('SELECT COUNT(*) as count FROM products WHERE isActive = 1')
    .get() as { count: number };
  const pendingSync = db
    .prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`)
    .get() as { count: number };

  return {
    salesToday: money(salesToday.total),
    receiptCount: receiptCount.count,
    productCount: productCount.count,
    pendingSync: pendingSync.count,
    online: false,
    registerName: 'Front Counter 01',
  };
}

export function createSale(payload: {
  cashierName: string;
  paymentMethod: string;
  discountTotal?: number;
  items: Array<{ productId: string; quantity: number }>;
}) {
  const db = getDatabase();
  const loadedProducts = db
    .prepare('SELECT * FROM products WHERE id IN (' + payload.items.map(() => '?').join(',') + ')')
    .all(...payload.items.map((item) => item.productId)) as Product[];

  const byId = new Map(loadedProducts.map((product) => [product.id, product]));

  const detailedItems: CartItem[] = payload.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new Error('Product not found');
    if (item.quantity > product.stock) {
      throw new Error(`Not enough stock for ${product.name}`);
    }
    const lineTotal = money(product.price * item.quantity);
    return { ...product, quantity: item.quantity, lineTotal };
  });
  const saleItemRows = detailedItems.map((item) => ({
    id: crypto.randomUUID(),
    productId: item.id,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: item.lineTotal,
  }));

  const subtotal = money(detailedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxTotal = money(
    detailedItems.reduce((sum, item) => sum + item.lineTotal * item.taxRate, 0)
  );
  const discountTotal = money(payload.discountTotal ?? 0);
  const grandTotal = money(subtotal + taxTotal - discountTotal);

  const saleId = crypto.randomUUID();
  const saleCount = db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count: number };
  const receiptNo = `R-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(
    saleCount.count + 1
  ).padStart(5, '0')}`;
  const createdAt = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO sales
      (id, receiptNo, cashierName, subtotal, taxTotal, discountTotal, grandTotal, paymentMethod, itemCount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saleId,
      receiptNo,
      payload.cashierName,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      payload.paymentMethod,
      detailedItems.length,
      createdAt
    );

    const insertItem = db.prepare(`
      INSERT INTO sale_items (id, saleId, productId, productName, quantity, unitPrice, lineTotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    const insertMovement = db.prepare(`
      INSERT INTO inventory_movements (id, productId, delta, reason, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    const queue = db.prepare(`
      INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `);

    for (const item of saleItemRows) {
      insertItem.run(
        item.id,
        saleId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.lineTotal
      );
      updateStock.run(item.quantity, item.productId);
      insertMovement.run(crypto.randomUUID(), item.productId, -item.quantity, 'sale', createdAt);
    }

    queue.run(
      crypto.randomUUID(),
      'sale',
      saleId,
      JSON.stringify({
        saleId,
        receiptNo,
        cashierName: payload.cashierName,
        paymentMethod: payload.paymentMethod,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        detailedItems: saleItemRows,
        createdAt,
      }),
      createdAt
    );
  });

  transaction();

  return {
    id: saleId,
    receiptNo,
    subtotal,
    taxTotal,
    discountTotal,
    grandTotal,
    createdAt,
    itemCount: detailedItems.length,
    cashierName: payload.cashierName,
    paymentMethod: payload.paymentMethod,
    detailedItems: saleItemRows,
  } satisfies SaleRecord;
}

export function getRecentSales(limit = 10) {
  return getDatabase()
    .prepare(
      'SELECT id, receiptNo, cashierName, subtotal, taxTotal, discountTotal, grandTotal, paymentMethod, itemCount, createdAt FROM sales ORDER BY createdAt DESC LIMIT ?'
    )
    .all(limit) as SaleRecord[];
}

export function listInventory() {
  return getDatabase()
    .prepare(
      'SELECT id, sku, barcode, name, category, price, stock, taxRate, isActive FROM products ORDER BY category, name'
    )
    .all();
}

export function createProduct(payload: {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  taxRate: number;
}) {
  const db = getDatabase();
  const sku = payload.sku.trim();
  const barcode = payload.barcode.trim();
  const name = payload.name.trim();
  const category = payload.category.trim();

  if (!sku || !barcode || !name || !category) {
    throw new Error('SKU, barcode, name, and category are required');
  }
  if (payload.price < 0) throw new Error('Price cannot be negative');
  if (payload.stock < 0) throw new Error('Stock cannot be negative');
  if (payload.taxRate < 0) throw new Error('Tax rate cannot be negative');

  const existing = db
    .prepare('SELECT id FROM products WHERE sku = ? OR barcode = ?')
    .get(sku, barcode) as { id: string } | undefined;
  if (existing) {
    throw new Error('A product with the same SKU or barcode already exists');
  }

  const product = {
    id: crypto.randomUUID(),
    sku,
    barcode,
    name,
    category,
    price: money(payload.price),
    stock: Math.trunc(payload.stock),
    taxRate: payload.taxRate,
    isActive: 1,
  };

  db.prepare(`
    INSERT INTO products (id, sku, barcode, name, category, price, stock, taxRate, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.sku,
    product.barcode,
    product.name,
    product.category,
    product.price,
    product.stock,
    product.taxRate,
    product.isActive
  );

  return product;
}

export function adjustInventory(payload: {
  productId: string;
  delta: number;
  reason: string;
}) {
  const db = getDatabase();
  const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(payload.productId) as
    | { id: string; name: string; stock: number }
    | undefined;
  if (!product) throw new Error('Product not found');

  const nextStock = product.stock + payload.delta;
  if (nextStock < 0) throw new Error('Stock cannot go below zero');

  const tx = db.transaction(() => {
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(nextStock, payload.productId);
    db.prepare(
      'INSERT INTO inventory_movements (id, productId, delta, reason, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), payload.productId, payload.delta, payload.reason, new Date().toISOString());
    db.prepare(
      'INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      'inventory_movement',
      payload.productId,
      JSON.stringify({
        productId: payload.productId,
        delta: payload.delta,
        reason: payload.reason,
        productName: product.name,
      }),
      'pending',
      new Date().toISOString()
    );
  });

  tx();

  return {
    productId: payload.productId,
    stock: nextStock,
  };
}

export function deleteProduct(payload: { productId: string }) {
  const db = getDatabase();
  const product = db
    .prepare('SELECT id, name, isActive FROM products WHERE id = ?')
    .get(payload.productId) as { id: string; name: string; isActive: number } | undefined;
  if (!product) throw new Error('Product not found');
  if (product.isActive === 0) {
    throw new Error('Product is already deleted');
  }

  db.prepare('UPDATE products SET isActive = 0 WHERE id = ?').run(payload.productId);

  return {
    productId: payload.productId,
    name: product.name,
    isActive: 0,
  };
}

export function deleteProductPermanently(payload: { productId: string }) {
  const db = getDatabase();
  const product = db
    .prepare('SELECT id, name, isActive FROM products WHERE id = ?')
    .get(payload.productId) as { id: string; name: string; isActive: number } | undefined;
  if (!product) throw new Error('Product not found');
  if (product.isActive !== 0) {
    throw new Error('Only already deleted items can be removed permanently');
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(payload.productId);

  return {
    productId: payload.productId,
    name: product.name,
    removed: true,
  };
}

export function getPendingSyncEntries(limit = 25): SyncQueueRow[] {
  return getDatabase()
    .prepare(
      'SELECT id, entityType, entityId, payload, status, createdAt, syncedAt FROM sync_queue WHERE status = ? ORDER BY createdAt ASC LIMIT ?'
    )
    .all('pending', limit) as SyncQueueRow[];
}

export function markSyncEntriesSynced(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE sync_queue SET status = 'synced', syncedAt = ? WHERE id IN (${placeholders})`).run(
    new Date().toISOString(),
    ...ids
  );
}
