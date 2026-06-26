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

type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  loyaltyPoints: number;
  visitsCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  isActive: number;
};

type VisitRecord = {
  id: string;
  customerId: string | null;
  customerName: string;
  serviceName: string;
  amount: number;
  pointsEarned: number;
  notes: string | null;
  createdAt: string;
  source: string;
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

export type CustomerServiceSummary = {
  serviceName: string;
  visitCount: number;
  totalAmount: number;
};

export type CustomerProfile = {
  customer: CustomerRecord;
  recentVisits: VisitRecord[];
  favoriteServices: CustomerServiceSummary[];
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

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      loyaltyPoints INTEGER NOT NULL DEFAULT 0,
      visitsCount INTEGER NOT NULL DEFAULT 0,
      lastVisitAt TEXT,
      createdAt TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      customerId TEXT,
      customerName TEXT NOT NULL,
      serviceName TEXT NOT NULL,
      amount REAL NOT NULL,
      pointsEarned INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE INDEX IF NOT EXISTS idx_products_active_category_name ON products (isActive, category, name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (createdAt);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (createdAt);
    CREATE INDEX IF NOT EXISTS idx_visits_customer_id_created_at ON visits (customerId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_customers_active_name ON customers (isActive, name);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created_at ON sync_queue (status, createdAt);
  `);

  try {
    db.prepare('ALTER TABLE customers ADD COLUMN notes TEXT').run();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
      throw error;
    }
  }

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

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (customerCount.count === 0) {
    const seedCustomer = db.prepare(`
      INSERT INTO customers (id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive)
      VALUES (@id, @name, @phone, @email, @notes, @loyaltyPoints, @visitsCount, @lastVisitAt, @createdAt, 1)
    `);
    const rows = [
      {
        id: crypto.randomUUID(),
        name: 'Ayesha Khan',
        phone: '0300-1111111',
        email: 'ayesha@example.com',
        notes: 'Prefers evening appointments',
        loyaltyPoints: 24,
        visitsCount: 6,
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Sara Ali',
        phone: '0300-2222222',
        email: 'sara@example.com',
        notes: 'Loves facial packages',
        loyaltyPoints: 12,
        visitsCount: 3,
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Maira Shah',
        phone: '0300-3333333',
        email: 'maira@example.com',
        notes: 'Prefers nail art',
        loyaltyPoints: 8,
        visitsCount: 2,
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];
    for (const row of rows) seedCustomer.run(row);
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
  const revenueToday = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM visits WHERE date(createdAt) = date('now')`)
    .get() as { total: number };
  const visitsToday = db
    .prepare(`SELECT COUNT(*) as count FROM visits WHERE date(createdAt) = date('now')`)
    .get() as { count: number };
  const productCount = db
    .prepare('SELECT COUNT(*) as count FROM products WHERE isActive = 1')
    .get() as { count: number };
  const customerCount = db
    .prepare('SELECT COUNT(*) as count FROM customers WHERE isActive = 1')
    .get() as { count: number };
  const loyaltyPointsTotal = db
    .prepare('SELECT COALESCE(SUM(loyaltyPoints), 0) as total FROM customers WHERE isActive = 1')
    .get() as { total: number };
  const pointsEarnedToday = db
    .prepare(`SELECT COALESCE(SUM(pointsEarned), 0) as total FROM visits WHERE date(createdAt) = date('now')`)
    .get() as { total: number };
  const monthlyRevenue = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM visits WHERE strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')`)
    .get() as { total: number };
  const pendingSync = db
    .prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`)
    .get() as { count: number };
  const recentVisits = db
    .prepare(
      `SELECT id, customerId, customerName, serviceName, amount, pointsEarned, notes, createdAt, source
       FROM visits
       ORDER BY createdAt DESC
       LIMIT 6`
    )
    .all() as VisitRecord[];

  return {
    salesToday: money(revenueToday.total),
    receiptCount: visitsToday.count,
    productCount: productCount.count,
    customerCount: customerCount.count,
    visitsToday: visitsToday.count,
    revenueToday: money(revenueToday.total),
    monthlyRevenue: money(monthlyRevenue.total),
    loyaltyPointsTotal: loyaltyPointsTotal.total,
    pointsEarnedToday: pointsEarnedToday.total,
    averageVisitValue: visitsToday.count > 0 ? money(revenueToday.total / visitsToday.count) : 0,
    recentVisits,
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
    const visitId = crypto.randomUUID();

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

    db.prepare(`
      INSERT INTO visits (id, customerId, customerName, serviceName, amount, pointsEarned, notes, createdAt, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      visitId,
      null,
      'Walk-in',
      `POS Sale (${payload.paymentMethod})`,
      grandTotal,
      0,
      null,
      createdAt,
      'sale'
    );

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
    queue.run(
      crypto.randomUUID(),
      'visit',
      visitId,
      JSON.stringify({
        id: visitId,
        customerId: null,
        customerName: 'Walk-in',
        serviceName: `POS Sale (${payload.paymentMethod})`,
        amount: grandTotal,
        pointsEarned: 0,
        notes: null,
        createdAt,
        source: 'sale',
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

export function listCustomers(limit = 20, offset = 0): CustomerRecord[] {
  return getDatabase()
    .prepare(
      'SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE isActive = 1 ORDER BY name LIMIT ? OFFSET ?'
    )
    .all(limit, offset) as CustomerRecord[];
}

export function findCustomers(query: string, limit = 10): CustomerRecord[] {
  const db = getDatabase();
  const q = query.trim();

  if (!q) {
    return db
      .prepare(
        'SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE isActive = 1 ORDER BY lastVisitAt DESC, name LIMIT ?'
      )
      .all(limit) as CustomerRecord[];
  }

  const like = `%${q}%`;
  return db
    .prepare(
      `SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive
       FROM customers
       WHERE isActive = 1
         AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
       ORDER BY name
       LIMIT ?`
    )
    .all(like, like, like, limit) as CustomerRecord[];
}

export function createCustomer(payload: { name: string; phone?: string; email?: string; notes?: string }) {
  const db = getDatabase();
  const name = payload.name.trim();
  const phone = payload.phone?.trim() || null;
  const email = payload.email?.trim() || null;
  const notes = payload.notes?.trim() || null;

  if (!name) throw new Error('Customer name is required');

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO customers (id, name, phone, email, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive)
    VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?, 1)
  `).run(id, name, phone, email, notes, createdAt);

  db.prepare(`
    INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(
    crypto.randomUUID(),
    'customer',
    id,
    JSON.stringify({
      id,
      name,
      phone,
      email,
      notes,
      loyaltyPoints: 0,
      visitsCount: 0,
      lastVisitAt: null,
      createdAt,
      isActive: 1,
    }),
    createdAt
  );

  return {
    id,
    name,
    phone,
    email,
    notes,
    loyaltyPoints: 0,
    visitsCount: 0,
    lastVisitAt: null,
    createdAt,
    isActive: 1,
  } satisfies CustomerRecord;
}

export function updateCustomer(payload: { id: string; name: string; phone?: string; email?: string; notes?: string }) {
  const db = getDatabase();
  const id = payload.id.trim();
  const name = payload.name.trim();
  const phone = payload.phone?.trim() || null;
  const email = payload.email?.trim() || null;
  const notes = payload.notes?.trim() || null;

  if (!id) throw new Error('Customer id is required');
  if (!name) throw new Error('Customer name is required');

  const customer = db
    .prepare(
      'SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?'
    )
    .get(id) as CustomerRecord | undefined;
  if (!customer) throw new Error('Customer not found');

  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, email = ?, notes = ? WHERE id = ?'
  ).run(name, phone, email, notes, id);

  const updated = {
    ...customer,
    name,
    phone,
    email,
    notes,
  } satisfies CustomerRecord;

  db.prepare(`
    INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(
    crypto.randomUUID(),
    'customer',
    id,
    JSON.stringify(updated),
    new Date().toISOString()
  );

  return updated;
}

export function deleteCustomer(payload: { id: string }) {
  const db = getDatabase();
  const id = payload.id.trim();
  if (!id) throw new Error('Customer id is required');

  const customer = db
    .prepare(
      'SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?'
    )
    .get(id) as CustomerRecord | undefined;
  if (!customer) throw new Error('Customer not found');
  if (customer.isActive === 0) throw new Error('Customer is already deleted');

  db.prepare('UPDATE customers SET isActive = 0 WHERE id = ?').run(id);

  const deleted = {
    ...customer,
    isActive: 0,
  } satisfies CustomerRecord;

  db.prepare(`
    INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(
    crypto.randomUUID(),
    'customer',
    id,
    JSON.stringify(deleted),
    new Date().toISOString()
  );

  return deleted;
}

export function getCustomerProfile(customerId: string): CustomerProfile {
  const db = getDatabase();
  const customer = db
    .prepare(
      'SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?'
    )
    .get(customerId) as CustomerRecord | undefined;
  if (!customer) throw new Error('Customer not found');

  const recentVisits = db
    .prepare(
      'SELECT id, customerId, customerName, serviceName, amount, pointsEarned, notes, createdAt, source FROM visits WHERE customerId = ? ORDER BY createdAt DESC LIMIT 20'
    )
    .all(customerId) as VisitRecord[];

  const favoriteServices = db
    .prepare(
      `SELECT serviceName, COUNT(*) as visitCount, COALESCE(SUM(amount), 0) as totalAmount
       FROM visits
       WHERE customerId = ?
       GROUP BY serviceName
       ORDER BY visitCount DESC, totalAmount DESC, serviceName ASC
       LIMIT 5`
    )
    .all(customerId) as CustomerServiceSummary[];

  return {
    customer,
    recentVisits,
    favoriteServices,
  };
}

export function createVisit(payload: {
  customerId?: string | null;
  customerName?: string;
  serviceName: string;
  amount: number;
  notes?: string;
}) {
  const db = getDatabase();
  const serviceName = payload.serviceName.trim();
  if (!serviceName) throw new Error('Service name is required');
  if (payload.amount < 0) throw new Error('Amount cannot be negative');

  const customerId = payload.customerId?.trim() || null;
  let customerName = payload.customerName?.trim() || 'Walk-in';
  let pointsEarned = payload.amount > 0 ? Math.max(1, Math.floor(payload.amount / 100)) : 0;

  if (customerId) {
    const customer = db
      .prepare('SELECT id, name, loyaltyPoints, visitsCount FROM customers WHERE id = ? AND isActive = 1')
      .get(customerId) as { id: string; name: string; loyaltyPoints: number; visitsCount: number } | undefined;
    if (!customer) throw new Error('Customer not found');
    customerName = customer.name;
  } else {
    pointsEarned = 0;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const notes = payload.notes?.trim() || null;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO visits (id, customerId, customerName, serviceName, amount, pointsEarned, notes, createdAt, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, customerId, customerName, serviceName, payload.amount, pointsEarned, notes, createdAt, 'manual');

    if (customerId && pointsEarned > 0) {
      db.prepare(`
        UPDATE customers
        SET loyaltyPoints = loyaltyPoints + ?,
            visitsCount = visitsCount + 1,
            lastVisitAt = ?
        WHERE id = ?
      `).run(pointsEarned, createdAt, customerId);
    } else if (customerId) {
      db.prepare(`
        UPDATE customers
        SET visitsCount = visitsCount + 1,
            lastVisitAt = ?
        WHERE id = ?
      `).run(createdAt, customerId);
    }

    db.prepare(`
      INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(
      crypto.randomUUID(),
      'visit',
      id,
      JSON.stringify({
        id,
        customerId,
        customerName,
        serviceName,
        amount: payload.amount,
        pointsEarned,
        notes,
        createdAt,
        source: 'manual',
      }),
      createdAt
    );

    if (customerId) {
    const customer = db
        .prepare('SELECT id, name, phone, email, notes, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?')
        .get(customerId) as CustomerRecord | undefined;
      if (customer) {
        db.prepare(`
          INSERT INTO sync_queue (id, entityType, entityId, payload, status, createdAt)
          VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(
          crypto.randomUUID(),
          'customer',
          customerId,
          JSON.stringify({
            ...customer,
          }),
          createdAt
        );
      }
    }
  });

  tx();

  return {
    id,
    customerId,
    customerName,
    serviceName,
    amount: payload.amount,
    pointsEarned,
    notes,
    createdAt,
    source: 'manual',
  } satisfies VisitRecord;
}

export function getRecentVisits(limit = 8) {
  return getDatabase()
    .prepare(
      'SELECT id, customerId, customerName, serviceName, amount, pointsEarned, notes, createdAt, source FROM visits ORDER BY createdAt DESC LIMIT ?'
    )
    .all(limit) as VisitRecord[];
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
