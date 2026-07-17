import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import * as XLSX from 'xlsx';
import type { Product, SaleSummary, ServicePackage } from './schema';

type SaleRecord = SaleSummary & {
  id: string;
  receiptNo: string;
  customerId: string | null;
  customerName: string;
  cashierName: string;
  paymentMethod: string;
  createdAt: string;
  itemCount: number;
  loyaltyPointsEarned: number;
  originType: string | null;
  originId: string | null;
  detailedItems?: Array<{
    id: string;
    itemType: 'product' | 'service';
    itemId: string | null;
    name: string;
    qty: number;
    price: number;
    taxRate: number;
    lineTotal: number;
  }>;
};

type TransactionItemRecord = {
  id: string;
  transactionId: string;
  itemType: 'product' | 'service';
  itemId: string | null;
  name: string;
  price: number;
  qty: number;
  taxRate: number;
  lineTotal: number;
};

type TransactionLineInput = {
  type: 'product' | 'service';
  itemId?: string | null;
  name: string;
  price: number;
  qty?: number;
  taxRate?: number;
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
  serviceId: string | null;
  serviceCode: string | null;
  serviceName: string;
  servicePrice: number;
  amount: number;
  priceOverride: number;
  pointsEarned: number;
  notes: string | null;
  createdAt: string;
  source: string;
};

type LoyaltyTransactionRecord = {
  id: string;
  customerId: string;
  customerName: string;
  transactionType: 'earn' | 'redeem';
  points: number;
  notes: string | null;
  createdAt: string;
};

type ServiceRecord = ServicePackage;

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

export type LedgerItem = {
  itemType: 'product' | 'service';
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
};

export type LedgerEntry = {
  id: string;
  receiptNo: string;
  createdAt: string;
  paymentMethod: string;
  grandTotal: number;
  itemCount: number;
  pointsEarned: number;
  items: LedgerItem[];
};

export type CustomerProfile = {
  customer: CustomerRecord;
  // Services taken during the customer's most recent visit that had services.
  lastVisitServices: LedgerItem[];
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  // Full transaction ledger (newest first), shown behind a button.
  ledger: LedgerEntry[];
};

export type RevenueReport = {
  saleCount: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  averageSaleValue: number;
  topPaymentMethod: string;
  topProducts: Array<{
    productName: string;
    quantitySold: number;
    totalAmount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    saleCount: number;
  }>;
  recentSales: SaleRecord[];
};

export type CustomerReport = {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  averageVisitsPerCustomer: number;
  topCustomers: Array<{
    id: string;
    name: string;
    visitsCount: number;
    loyaltyPoints: number;
    totalSpent: number;
    lastVisitAt: string | null;
  }>;
};

export type VisitReport = {
  totalVisits: number;
  visitsToday: number;
  manualVisits: number;
  saleVisits: number;
  topServices: CustomerServiceSummary[];
  recentVisits: VisitRecord[];
};

export type LoyaltyReport = {
  totalEarned: number;
  totalRedeemed: number;
  outstandingBalance: number;
  topBalances: Array<{
    id: string;
    name: string;
    earned: number;
    redeemed: number;
    balance: number;
  }>;
  recentTransactions: LoyaltyTransactionRecord[];
};

export type ReportsSnapshot = {
  revenue: RevenueReport;
  customers: CustomerReport;
  visits: VisitReport;
  loyalty: LoyaltyReport;
};

export type SalonInfoSettings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  tagline: string;
};

export type LoyaltyRulesSettings = {
  // How many currency units (PKR) a customer must spend on services to earn 1 point.
  currencyPerPoint: number;
  minimumRedeemPoints: number;
};

export type AppSettingsSnapshot = {
  salonInfo: SalonInfoSettings;
  loyaltyRules: LoyaltyRulesSettings;
};

let database: InstanceType<typeof Database> | null = null;
let initialized = false;

const DB_FILENAME = 'offline-pos.sqlite3';
const SALON_INFO_KEY = 'salon_info';
const LOYALTY_RULES_KEY = 'loyalty_rules';

// Loyalty conversion: 15 PKR spent on services = 1 point, and when redeeming
// 1 point is worth 15 PKR of service value. Points are earned on services only.
const PKR_PER_POINT = 15;

const defaultSalonInfo: SalonInfoSettings = {
  name: 'Front Counter Salon',
  phone: '0300-0000000',
  email: 'hello@example.com',
  address: 'Main Boulevard, Lahore',
  tagline: 'Calm beauty operations, built for the front desk.',
};

const defaultLoyaltyRules: LoyaltyRulesSettings = {
  currencyPerPoint: PKR_PER_POINT,
  minimumRedeemPoints: 50,
};

function getDatabase() {
  if (!database) {
    const dbPath = getDatabasePath();
    database = new Database(dbPath);
    database.pragma('journal_mode = WAL');
  }
  return database;
}

export function getDatabasePath() {
  return path.join(app.getPath('userData'), DB_FILENAME);
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
      redeemPoints INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      receiptNo TEXT NOT NULL,
      customerId TEXT,
      customerName TEXT NOT NULL DEFAULT 'Walk-in',
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

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      receiptNo TEXT NOT NULL,
      customerId TEXT,
      customerName TEXT NOT NULL,
      cashierName TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxTotal REAL NOT NULL,
      discountTotal REAL NOT NULL,
      grandTotal REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      loyaltyPointsEarned INTEGER NOT NULL DEFAULT 0,
      itemCount INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      originType TEXT,
      originId TEXT
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transactionId TEXT NOT NULL,
      itemType TEXT NOT NULL,
      itemId TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      taxRate REAL NOT NULL DEFAULT 0,
      lineTotal REAL NOT NULL,
      FOREIGN KEY (transactionId) REFERENCES transactions(id)
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
      serviceId TEXT,
      serviceCode TEXT,
      serviceName TEXT NOT NULL,
      servicePrice REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL,
      priceOverride INTEGER NOT NULL DEFAULT 0,
      pointsEarned INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE INDEX IF NOT EXISTS idx_visits_source_created_at ON visits (source, createdAt);

    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      transactionType TEXT NOT NULL,
      points INTEGER NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      redeemPoints INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_active_category_name ON products (isActive, category, name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (createdAt);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (createdAt);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_id_created_at ON transactions (customerId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_transactions_origin ON transactions (originType, originId);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items (transactionId);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_type_item ON transaction_items (itemType, itemId);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (createdAt);
    CREATE INDEX IF NOT EXISTS idx_visits_customer_id_created_at ON visits (customerId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_customers_active_name ON customers (isActive, name);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
    CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id_created_at ON loyalty_transactions (customerId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_services_active_name ON services (isActive, name);
    CREATE INDEX IF NOT EXISTS idx_services_code ON services (code);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created_at ON sync_queue (status, createdAt);
  `);

  try {
    db.prepare('ALTER TABLE customers ADD COLUMN notes TEXT').run();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
      throw error;
    }
  }

  const visitColumnStatements = [
    'ALTER TABLE visits ADD COLUMN serviceId TEXT',
    'ALTER TABLE visits ADD COLUMN serviceCode TEXT',
    'ALTER TABLE visits ADD COLUMN servicePrice REAL NOT NULL DEFAULT 0',
    'ALTER TABLE visits ADD COLUMN priceOverride INTEGER NOT NULL DEFAULT 0',
  ];
  for (const statement of visitColumnStatements) {
    try {
      db.prepare(statement).run();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
        throw error;
      }
    }
  }

  try {
    db.prepare('ALTER TABLE loyalty_transactions ADD COLUMN notes TEXT').run();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
      throw error;
    }
  }

  // Add per-service redeem-points column, backfilling existing rows so they
  // stay redeemable (points needed = ceil(price / PKR_PER_POINT)).
  try {
    db.prepare('ALTER TABLE services ADD COLUMN redeemPoints INTEGER NOT NULL DEFAULT 0').run();
    db.prepare(
      `UPDATE services SET redeemPoints = CAST((price + ? - 1) / ? AS INTEGER) WHERE redeemPoints = 0`
    ).run(PKR_PER_POINT, PKR_PER_POINT);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
      throw error;
    }
  }

  // Add per-product redeem-points column (0 = not redeemable; set per product).
  try {
    db.prepare('ALTER TABLE products ADD COLUMN redeemPoints INTEGER NOT NULL DEFAULT 0').run();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
      throw error;
    }
  }

  db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?), (?, ?)').run(
    SALON_INFO_KEY,
    JSON.stringify(defaultSalonInfo),
    LOYALTY_RULES_KEY,
    JSON.stringify(defaultLoyaltyRules)
  );

  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (count.count === 0) {
    const seed = db.prepare(`
      INSERT INTO products (id, sku, barcode, name, category, price, stock, taxRate, redeemPoints, isActive)
      VALUES (@id, @sku, @barcode, @name, @category, @price, @stock, @taxRate, @redeemPoints, 1)
    `);
    const rows: Omit<Product, 'isActive'>[] = [
      { id: crypto.randomUUID(), sku: 'BRD-1001', barcode: '1110001110001', name: 'Sourdough Bread', category: 'Bakery', price: 4.5, stock: 42, taxRate: 0.08, redeemPoints: 0 },
      { id: crypto.randomUUID(), sku: 'MIL-2001', barcode: '2220002220002', name: 'Whole Milk', category: 'Dairy', price: 3.25, stock: 30, taxRate: 0.08, redeemPoints: 0 },
      { id: crypto.randomUUID(), sku: 'CF-3001', barcode: '3330003330003', name: 'House Coffee', category: 'Beverages', price: 6.75, stock: 18, taxRate: 0.08, redeemPoints: 0 },
      { id: crypto.randomUUID(), sku: 'SNK-4001', barcode: '4440004440004', name: 'Trail Mix', category: 'Snacks', price: 5.95, stock: 25, taxRate: 0.08, redeemPoints: 0 },
      { id: crypto.randomUUID(), sku: 'FR-5001', barcode: '5550005550005', name: 'Bananas', category: 'Produce', price: 2.99, stock: 50, taxRate: 0.08, redeemPoints: 0 },
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

  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get() as { count: number };
  if (serviceCount.count === 0) {
    const seedService = db.prepare(`
      INSERT INTO services (id, code, name, description, price, redeemPoints, isActive)
      VALUES (@id, @code, @name, @description, @price, @redeemPoints, 1)
    `);
    const rows: Omit<ServiceRecord, 'isActive'>[] = [
      {
        id: crypto.randomUUID(),
        code: 'FAC-1001',
        name: 'Deep Cleansing Facial',
        description: 'A refreshing facial treatment focused on cleansing and hydration.',
        price: 3500,
        redeemPoints: Math.ceil(3500 / PKR_PER_POINT),
      },
      {
        id: crypto.randomUUID(),
        code: 'HAI-2001',
        name: 'Signature Hair Spa',
        description: 'Scalp massage, nourishing mask, and smooth blow-dry finish.',
        price: 4800,
        redeemPoints: Math.ceil(4800 / PKR_PER_POINT),
      },
      {
        id: crypto.randomUUID(),
        code: 'NAI-3001',
        name: 'Classic Manicure',
        description: 'Nail shaping, cuticle care, polish, and finishing touch.',
        price: 2200,
        redeemPoints: Math.ceil(2200 / PKR_PER_POINT),
      },
    ];
    for (const row of rows) seedService.run(row);
  }

  try {
    migrateLegacyTransactions(db);
  } catch (error) {
    // Legacy migration is best-effort: a malformed or partially-migrated
    // legacy database must never block app startup / window creation.
    console.warn('Skipping legacy transaction migration:', error);
  }
  initialized = true;
}

function migrateLegacyTransactions(db: InstanceType<typeof Database>) {
  const hasTransactions = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'")
    .get() as { name: string } | undefined;
  if (!hasTransactions) return;

  const tableExists = (name: string) =>
    !!db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name);
  const columnNames = (table: string) =>
    new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (c) => c.name
      )
    );

  // Older databases may have a `sales` table that predates the customerId /
  // customerName columns. Only select columns that actually exist so the
  // migration never throws "no such column".
  const salesCols = tableExists('sales') ? columnNames('sales') : new Set<string>();
  const hasCustomerId = salesCols.has('customerId');
  const hasCustomerName = salesCols.has('customerName');

  const legacySaleRows = (!tableExists('sales')
    ? []
    : db
        .prepare(
          `SELECT id, receiptNo, cashierName, subtotal, taxTotal, discountTotal, grandTotal, paymentMethod, itemCount, createdAt${hasCustomerId ? ', customerId' : ''}${hasCustomerName ? ', customerName' : ''} FROM sales ORDER BY createdAt ASC`
        )
        .all()) as Array<{
    id: string;
    receiptNo: string;
    cashierName: string;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    paymentMethod: string;
    itemCount: number;
    createdAt: string;
    customerId: string | null;
    customerName: string | null;
  }>;

  const legacySaleItems = db
    .prepare(
      'SELECT id, saleId, productId, productName, quantity, unitPrice, lineTotal FROM sale_items ORDER BY saleId ASC'
    )
    .all() as Array<{
    id: string;
    saleId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;

  const saleItemsBySaleId = new Map<string, typeof legacySaleItems>();
  for (const item of legacySaleItems) {
    const current = saleItemsBySaleId.get(item.saleId) ?? [];
    current.push(item);
    saleItemsBySaleId.set(item.saleId, current);
  }

  const legacyVisits = db
    .prepare(
      `SELECT id, customerId, customerName, serviceId, serviceCode, serviceName, servicePrice, amount, priceOverride, pointsEarned, notes, createdAt, source
       FROM visits
       WHERE source != 'sale'
       ORDER BY createdAt ASC`
    )
    .all() as VisitRecord[];

  const insertTransaction = db.prepare(`
    INSERT OR IGNORE INTO transactions (
      id,
      receiptNo,
      customerId,
      customerName,
      cashierName,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      paymentMethod,
      loyaltyPointsEarned,
      itemCount,
      createdAt,
      originType,
      originId
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransactionItem = db.prepare(`
    INSERT OR IGNORE INTO transaction_items (
      id,
      transactionId,
      itemType,
      itemId,
      name,
      price,
      qty,
      taxRate,
      lineTotal
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sale of legacySaleRows) {
    const items = saleItemsBySaleId.get(sale.id) ?? [];
    const customerName = sale.customerName?.trim() || 'Walk-in';

    insertTransaction.run(
      sale.id,
      sale.receiptNo,
      sale.customerId ?? null,
      customerName,
      sale.cashierName,
      sale.subtotal,
      sale.taxTotal,
      sale.discountTotal,
      sale.grandTotal,
      sale.paymentMethod,
      0,
      sale.itemCount,
      sale.createdAt,
      'sale',
      sale.id
    );

    for (const item of items) {
      insertTransactionItem.run(
        `sale-${item.id}`,
        sale.id,
        'product',
        item.productId,
        item.productName,
        item.unitPrice,
        item.quantity,
        0,
        item.lineTotal
      );
    }
  }

  for (const visit of legacyVisits) {
    const transactionId = visit.id;
    const receiptNo = `T-${visit.createdAt.slice(0, 10).replaceAll('-', '')}-${visit.id.slice(0, 8).toUpperCase()}`;
    const customerName = visit.customerName?.trim() || 'Walk-in';
    const total = money(visit.amount);

    insertTransaction.run(
      transactionId,
      receiptNo,
      visit.customerId,
      customerName,
      'Legacy',
      total,
      0,
      0,
      total,
      visit.source === 'bill' ? 'Cash' : 'Cash',
      visit.pointsEarned,
      1,
      visit.createdAt,
      'visit',
      visit.id
    );

    insertTransactionItem.run(
      `visit-${visit.id}`,
      transactionId,
      'service',
      visit.serviceId,
      visit.serviceName,
      visit.amount,
      1,
      0,
      visit.amount
    );
  }
}

function readSetting<T>(key: string, fallback: T): T {
  const row = getDatabase().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: unknown) {
  getDatabase()
    .prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, JSON.stringify(value));
}

export function getSettings(): AppSettingsSnapshot {
  const storedLoyalty = readSetting<Partial<LoyaltyRulesSettings>>(LOYALTY_RULES_KEY, defaultLoyaltyRules);
  // Normalize so older stored settings (or missing fields) always resolve to valid values.
  const loyaltyRules: LoyaltyRulesSettings = {
    currencyPerPoint:
      Number.isFinite(storedLoyalty.currencyPerPoint) && Number(storedLoyalty.currencyPerPoint) >= 1
        ? Number(storedLoyalty.currencyPerPoint)
        : defaultLoyaltyRules.currencyPerPoint,
    minimumRedeemPoints: Number.isFinite(storedLoyalty.minimumRedeemPoints)
      ? Math.max(0, Math.trunc(Number(storedLoyalty.minimumRedeemPoints)))
      : defaultLoyaltyRules.minimumRedeemPoints,
  };
  return {
    salonInfo: readSetting(SALON_INFO_KEY, defaultSalonInfo),
    loyaltyRules,
  };
}

export function updateSalonInfo(payload: Partial<SalonInfoSettings>) {
  const current = getSettings().salonInfo;
  const next = {
    name: payload.name?.trim() || current.name,
    phone: payload.phone?.trim() || '',
    email: payload.email?.trim() || '',
    address: payload.address?.trim() || '',
    tagline: payload.tagline?.trim() || '',
  };
  saveSetting(SALON_INFO_KEY, next);
  return next;
}

export function updateLoyaltyRules(payload: Partial<LoyaltyRulesSettings>) {
  const current = getSettings().loyaltyRules;
  const next: LoyaltyRulesSettings = {
    // Must be at least 1 currency unit per point (used as a divisor when earning).
    currencyPerPoint: Number.isFinite(payload.currencyPerPoint)
      ? Math.max(1, Number(payload.currencyPerPoint))
      : current.currencyPerPoint,
    minimumRedeemPoints: Number.isFinite(payload.minimumRedeemPoints)
      ? Math.max(0, Math.trunc(Number(payload.minimumRedeemPoints)))
      : current.minimumRedeemPoints,
  };
  saveSetting(LOYALTY_RULES_KEY, next);
  return next;
}

// List all user tables (excludes SQLite internal tables).
function listUserTables(db: InstanceType<typeof Database>): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

// Backup = export every table to its own sheet in an .xlsx workbook.
export function backupDatabase(destinationPath: string) {
  const db = getDatabase();
  const workbook = XLSX.utils.book_new();

  for (const table of listUserTables(db)) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    const sheet = XLSX.utils.json_to_sheet(rows);
    // Sheet names are capped at 31 chars; all our table names are shorter.
    XLSX.utils.book_append_sheet(workbook, sheet, table.slice(0, 31));
  }

  // A workbook must contain at least one sheet.
  if (workbook.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['empty']]), 'info');
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  XLSX.writeFile(workbook, destinationPath);
  return destinationPath;
}

// Restore = read the .xlsx workbook and replace each matching table's rows.
export function restoreDatabase(sourcePath: string) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Backup file not found');
  }

  const db = getDatabase();
  const workbook = XLSX.readFile(sourcePath);

  // Valid columns for each existing table, so we only insert known columns.
  const tableColumns = new Map<string, Set<string>>();
  for (const table of listUserTables(db)) {
    const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
      (column) => column.name
    );
    tableColumns.set(table, new Set(columns));
  }

  const matchingSheets = workbook.SheetNames.filter((name) => tableColumns.has(name));
  if (matchingSheets.length === 0) {
    // No sheet matched any table — this is almost certainly not a valid backup.
    throw new Error('This file does not look like an Offline POS backup.');
  }

  let rowsRestored = 0;
  const runRestore = db.transaction(() => {
    for (const sheetName of matchingSheets) {
      const columns = tableColumns.get(sheetName)!;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, unknown>[];
      db.prepare(`DELETE FROM ${sheetName}`).run();

      for (const row of rows) {
        const keys = Object.keys(row).filter((key) => columns.has(key));
        if (keys.length === 0) continue;
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map((key) => (row[key] === undefined ? null : row[key]));
        db.prepare(`INSERT INTO ${sheetName} (${keys.join(', ')}) VALUES (${placeholders})`).run(
          ...(values as (string | number | null)[])
        );
        rowsRestored += 1;
      }
    }
  });

  runRestore();

  return {
    restoredFrom: sourcePath,
    tablesRestored: matchingSheets.length,
    rowsRestored,
  };
}

export function listProducts(): Product[] {
  return getDatabase()
    .prepare('SELECT * FROM products WHERE isActive = 1 ORDER BY category, name')
    .all() as Product[];
}

export function getStats() {
  const db = getDatabase();
  const revenueToday = db
    .prepare(`SELECT COALESCE(SUM(grandTotal), 0) as total FROM transactions WHERE date(createdAt) = date('now')`)
    .get() as { total: number };
  const receiptCount = db
    .prepare(`SELECT COUNT(*) as count FROM transactions WHERE date(createdAt) = date('now')`)
    .get() as { count: number };
  const visitsToday = db
    .prepare(
      `SELECT COUNT(DISTINCT t.id) as count
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service' AND date(t.createdAt) = date('now')`
    )
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
    .prepare(
      `SELECT COALESCE(SUM(loyaltyPointsEarned), 0) as total
       FROM transactions
       WHERE date(createdAt) = date('now')`
    )
    .get() as { total: number };
  const monthlyRevenue = db
    .prepare(
      `SELECT COALESCE(SUM(grandTotal), 0) as total
       FROM transactions
       WHERE strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')`
    )
    .get() as { total: number };
  const pendingSync = db
    .prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`)
    .get() as { count: number };
  const recentVisits = db
    .prepare(
      `SELECT
        t.id,
        t.customerId,
        t.customerName,
        NULL as serviceId,
        NULL as serviceCode,
        GROUP_CONCAT(ti.name, ', ') as serviceName,
        COALESCE(SUM(ti.price * ti.qty), 0) as servicePrice,
        COALESCE(SUM(ti.lineTotal), 0) as amount,
        0 as priceOverride,
        t.loyaltyPointsEarned as pointsEarned,
        NULL as notes,
        t.createdAt,
        'transaction' as source
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service'
       GROUP BY t.id
       ORDER BY t.createdAt DESC
       LIMIT 6`
    )
    .all() as VisitRecord[];

  return {
    salesToday: money(revenueToday.total),
    receiptCount: receiptCount.count,
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

export function createTransaction(payload: {
  cashierName: string;
  paymentMethod: string;
  discountTotal?: number;
  customerId?: string | null;
  customerName?: string;
  originType?: string;
  originId?: string | null;
  items: TransactionLineInput[];
}) {
  const db = getDatabase();
  const normalizedItems = payload.items.map((item) => {
    const qty = Math.trunc(item.qty ?? 1);
    if (!Number.isFinite(item.price)) throw new Error('Item price must be valid');
    if (!Number.isFinite(item.taxRate ?? 0)) throw new Error('Item tax rate must be valid');
    if (qty <= 0) throw new Error('Quantity must be greater than zero');
    return {
      type: item.type,
      itemId: item.itemId?.trim() || null,
      name: item.name?.trim() || '',
      price: money(item.price),
      qty,
      taxRate: money(item.taxRate ?? 0),
    };
  });

  if (normalizedItems.length === 0) {
    throw new Error('At least one item is required');
  }

  const productIds = normalizedItems
    .filter((item) => item.type === 'product' && item.itemId)
    .map((item) => item.itemId as string);
  const serviceIds = normalizedItems
    .filter((item) => item.type === 'service' && item.itemId)
    .map((item) => item.itemId as string);

  const loadedProducts = productIds.length
    ? (db
        .prepare(`SELECT id, sku, barcode, name, category, price, stock, taxRate, isActive FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`)
        .all(...productIds) as Product[])
    : [];
  const loadedServices = serviceIds.length
    ? (db
        .prepare(`SELECT id, code, name, description, price, isActive FROM services WHERE id IN (${serviceIds.map(() => '?').join(',')})`)
        .all(...serviceIds) as ServiceRecord[])
    : [];

  const productById = new Map(loadedProducts.map((product) => [product.id, product]));
  const serviceById = new Map(loadedServices.map((service) => [service.id, service]));

  const detailedItems: TransactionItemRecord[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  let loyaltyPointsEarned = 0;
  let serviceSubtotal = 0;

  for (const item of normalizedItems) {
    if (item.type === 'product') {
      if (!item.itemId) throw new Error('Product item id is required');
      const product = productById.get(item.itemId);
      if (!product || product.isActive === 0) throw new Error('Product not found');
      if (item.qty > product.stock) {
        throw new Error(`Not enough stock for ${product.name}`);
      }
      const resolvedPrice = item.price > 0 ? item.price : product.price;
      const resolvedTaxRate = item.name ? item.taxRate : product.taxRate;
      const resolvedName = item.name || product.name;
      const lineTotal = money(resolvedPrice * item.qty);
      detailedItems.push({
        id: crypto.randomUUID(),
        transactionId: '',
        itemType: 'product',
        itemId: product.id,
        name: resolvedName,
        price: resolvedPrice,
        qty: item.qty,
        taxRate: resolvedTaxRate,
        lineTotal,
      });
    } else {
      const service = item.itemId ? serviceById.get(item.itemId) : undefined;
      if (item.itemId && (!service || service.isActive === 0)) throw new Error('Service package not found');
      const resolvedPrice = item.price > 0 ? item.price : service?.price ?? 0;
      const resolvedName = item.name || service?.name || 'Service';
      const resolvedItemId = item.itemId || service?.id || null;
      const lineTotal = money(resolvedPrice * item.qty);
      detailedItems.push({
        id: crypto.randomUUID(),
        transactionId: '',
        itemType: 'service',
        itemId: resolvedItemId,
        name: resolvedName,
        price: resolvedPrice,
        qty: item.qty,
        taxRate: item.taxRate,
        lineTotal,
      });
      serviceSubtotal += lineTotal;
    }
  }

  // Points are earned on services only, using the configurable conversion rate
  // (currencyPerPoint PKR of service spend = 1 point).
  const currencyPerPoint = Math.max(1, getSettings().loyaltyRules.currencyPerPoint);
  loyaltyPointsEarned = Math.max(0, Math.floor(serviceSubtotal / currencyPerPoint));

  subtotal = money(detailedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  taxTotal = money(detailedItems.reduce((sum, item) => sum + item.lineTotal * item.taxRate, 0));
  const discountTotal = money(payload.discountTotal ?? 0);
  const grandTotal = money(subtotal + taxTotal - discountTotal);

  const transactionId = crypto.randomUUID();
  const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
  const receiptNo = `T-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(
    transactionCount.count + 1
  ).padStart(5, '0')}`;
  const createdAt = new Date().toISOString();
  const customerId = payload.customerId?.trim() || null;
  const customer = customerId
    ? (db
        .prepare('SELECT id, name, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?')
        .get(customerId) as CustomerRecord | undefined)
    : undefined;

  if (customerId && !customer) throw new Error('Customer not found');

  const customerName = customer?.name ?? payload.customerName?.trim() ?? 'Walk-in';
  const cashierName = payload.cashierName.trim();
  if (!cashierName) throw new Error('Cashier name is required');
  if (!payload.paymentMethod.trim()) throw new Error('Payment method is required');

  const transaction = db.transaction(() => {
    const originType = payload.originType?.trim() || 'checkout';
    const originId = payload.originId?.trim() || transactionId;

    db.prepare(`
      INSERT INTO transactions (
        id,
        receiptNo,
        customerId,
        customerName,
        cashierName,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        paymentMethod,
        loyaltyPointsEarned,
        itemCount,
        createdAt,
        originType,
        originId
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transactionId,
      receiptNo,
      customerId,
      customerName,
      cashierName,
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      payload.paymentMethod.trim(),
      loyaltyPointsEarned,
      detailedItems.length,
      createdAt,
      originType,
      originId
    );

    const insertItem = db.prepare(`
      INSERT INTO transaction_items (id, transactionId, itemType, itemId, name, price, qty, taxRate, lineTotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    for (const item of detailedItems) {
      insertItem.run(
        item.id,
        transactionId,
        item.itemType,
        item.itemId,
        item.name,
        item.price,
        item.qty,
        item.taxRate,
        item.lineTotal
      );
      item.transactionId = transactionId;

      if (item.itemType === 'product' && item.itemId) {
        updateStock.run(item.qty, item.itemId);
        insertMovement.run(crypto.randomUUID(), item.itemId, -item.qty, 'transaction', createdAt);
      }
    }

    if (customerId) {
      // Every transaction for a known customer counts as a visit.
      db.prepare(`
        UPDATE customers
        SET loyaltyPoints = loyaltyPoints + ?,
            visitsCount = visitsCount + 1,
            lastVisitAt = ?
        WHERE id = ?
      `).run(loyaltyPointsEarned, createdAt, customerId);

      // Points are only earned from services (loyaltyPointsEarned > 0).
      if (loyaltyPointsEarned > 0) {
        db.prepare(`
          INSERT INTO loyalty_transactions (id, customerId, customerName, transactionType, points, notes, createdAt)
          VALUES (?, ?, ?, 'earn', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          customerId,
          customerName,
          loyaltyPointsEarned,
          `Earned from transaction ${receiptNo}`,
          createdAt
        );
      }
    }

    queue.run(
      crypto.randomUUID(),
      'transaction',
      transactionId,
      JSON.stringify({
        id: transactionId,
        receiptNo,
        customerId,
        customerName,
        cashierName,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        paymentMethod: payload.paymentMethod.trim(),
        loyaltyPointsEarned,
        itemCount: detailedItems.length,
        createdAt,
        originType,
        originId,
        detailedItems,
      }),
      createdAt
    );
  });

  transaction();

  return {
    id: transactionId,
    receiptNo,
    customerId,
    customerName,
    cashierName,
    subtotal,
    taxTotal,
    discountTotal,
    grandTotal,
    paymentMethod: payload.paymentMethod.trim(),
    loyaltyPointsEarned,
    itemCount: detailedItems.length,
    createdAt,
    originType: payload.originType?.trim() || 'checkout',
    originId: payload.originId?.trim() || transactionId,
    detailedItems,
  } satisfies SaleRecord;
}

export function createSale(payload: {
  cashierName: string;
  paymentMethod: string;
  discountTotal?: number;
  items: Array<{ productId: string; quantity: number }>;
}) {
  return createTransaction({
    cashierName: payload.cashierName,
    paymentMethod: payload.paymentMethod,
    discountTotal: payload.discountTotal,
    originType: 'sale',
    items: payload.items.map((item) => ({
      type: 'product',
      itemId: item.productId,
      name: '',
      price: 0,
      qty: item.quantity,
      taxRate: 0,
    })),
  });
}

export function getRecentTransactions(limit = 10) {
  return getDatabase()
    .prepare(
      'SELECT id, receiptNo, customerId, customerName, cashierName, subtotal, taxTotal, discountTotal, grandTotal, paymentMethod, loyaltyPointsEarned, itemCount, createdAt, originType, originId FROM transactions ORDER BY createdAt DESC LIMIT ?'
    )
    .all(limit) as SaleRecord[];
}

export function getRecentSales(limit = 10) {
  return getRecentTransactions(limit);
}

export function getReports(): ReportsSnapshot {
  const db = getDatabase();

  const revenueSummary = db
    .prepare(
      `SELECT
        COUNT(*) as saleCount,
        COALESCE(SUM(grandTotal), 0) as totalRevenue,
        COALESCE(SUM(taxTotal), 0) as totalTax,
        COALESCE(SUM(discountTotal), 0) as totalDiscount
       FROM transactions`
    )
    .get() as { saleCount: number; totalRevenue: number; totalTax: number; totalDiscount: number };

  const topPaymentMethod = db
    .prepare(
      `SELECT paymentMethod, COUNT(*) as saleCount
       FROM transactions
       GROUP BY paymentMethod
       ORDER BY saleCount DESC, paymentMethod ASC
       LIMIT 1`
    )
    .get() as { paymentMethod: string; saleCount: number } | undefined;

  const monthlyTrend = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COALESCE(SUM(grandTotal), 0) as revenue, COUNT(*) as saleCount
       FROM transactions
       GROUP BY month
       ORDER BY month DESC
       LIMIT 6`
    )
    .all() as Array<{ month: string; revenue: number; saleCount: number }>;

  const recentSales = db
    .prepare(
      `SELECT
        id,
        receiptNo,
        customerId,
        customerName,
        cashierName,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        paymentMethod,
        loyaltyPointsEarned,
        itemCount,
        createdAt,
        originType,
        originId
       FROM transactions
       ORDER BY createdAt DESC
       LIMIT 8`
    )
    .all() as SaleRecord[];

  const customerSummary = db
    .prepare(
      `SELECT
        COUNT(*) as totalCustomers,
        COALESCE(SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END), 0) as activeCustomers,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END), 0) as newCustomersThisMonth,
        COALESCE(AVG(visitsCount), 0) as averageVisitsPerCustomer
       FROM customers`
    )
    .get() as {
    totalCustomers: number;
    activeCustomers: number;
    newCustomersThisMonth: number;
    averageVisitsPerCustomer: number;
  };

  const topCustomers = db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.visitsCount,
        c.loyaltyPoints,
        c.lastVisitAt,
        COALESCE(SUM(t.grandTotal), 0) as totalSpent
       FROM customers c
       LEFT JOIN transactions t ON t.customerId = c.id
       WHERE c.isActive = 1
       GROUP BY c.id
       ORDER BY totalSpent DESC, c.visitsCount DESC, c.name ASC
       LIMIT 10`
    )
    .all() as Array<{
    id: string;
    name: string;
    visitsCount: number;
    loyaltyPoints: number;
    lastVisitAt: string | null;
    totalSpent: number;
  }>;

  const visitSummary = db
    .prepare(
      `SELECT
        COUNT(DISTINCT t.id) as totalVisits,
        COUNT(DISTINCT CASE WHEN date(t.createdAt) = date('now') THEN t.id END) as visitsToday,
        COUNT(DISTINCT CASE WHEN t.originType = 'visit' THEN t.id END) as manualVisits,
        COUNT(DISTINCT CASE WHEN t.originType = 'sale' THEN t.id END) as saleVisits
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service'`
    )
    .get() as {
    totalVisits: number;
    visitsToday: number;
    manualVisits: number;
    saleVisits: number;
  };

  const topServices = db
    .prepare(
      `SELECT ti.name as serviceName, COUNT(*) as visitCount, COALESCE(SUM(ti.lineTotal), 0) as totalAmount
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service'
       GROUP BY ti.name
       ORDER BY visitCount DESC, totalAmount DESC, serviceName ASC
       LIMIT 8`
    )
    .all() as CustomerServiceSummary[];

  const topProducts = db
    .prepare(
      `SELECT ti.name as productName, COALESCE(SUM(ti.qty), 0) as quantitySold, COALESCE(SUM(ti.lineTotal), 0) as totalAmount
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'product'
       GROUP BY ti.name
       ORDER BY quantitySold DESC, totalAmount DESC, productName ASC
       LIMIT 8`
    )
    .all() as Array<{
    productName: string;
    quantitySold: number;
    totalAmount: number;
  }>;

  const recentVisits = db
    .prepare(
      `SELECT
        t.id,
        t.customerId,
        t.customerName,
        NULL as serviceId,
        NULL as serviceCode,
        GROUP_CONCAT(ti.name, ', ') as serviceName,
        COALESCE(SUM(ti.price * ti.qty), 0) as servicePrice,
        COALESCE(SUM(ti.lineTotal), 0) as amount,
        0 as priceOverride,
        t.loyaltyPointsEarned as pointsEarned,
        NULL as notes,
        t.createdAt,
        t.originType as source
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service'
       GROUP BY t.id
       ORDER BY t.createdAt DESC
       LIMIT 8`
    )
    .all() as VisitRecord[];

  const loyaltySummary = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN transactionType = 'earn' THEN points ELSE 0 END), 0) as totalEarned,
        COALESCE(SUM(CASE WHEN transactionType = 'redeem' THEN points ELSE 0 END), 0) as totalRedeemed
       FROM loyalty_transactions`
    )
    .get() as { totalEarned: number; totalRedeemed: number };

  const outstandingBalance = db
    .prepare('SELECT COALESCE(SUM(loyaltyPoints), 0) as total FROM customers WHERE isActive = 1')
    .get() as { total: number };

  const topBalances = db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.loyaltyPoints as balance,
        COALESCE(SUM(CASE WHEN lt.transactionType = 'earn' THEN lt.points ELSE 0 END), 0) as earned,
        COALESCE(SUM(CASE WHEN lt.transactionType = 'redeem' THEN lt.points ELSE 0 END), 0) as redeemed
       FROM customers c
       LEFT JOIN loyalty_transactions lt ON lt.customerId = c.id
       WHERE c.isActive = 1
       GROUP BY c.id
       ORDER BY balance DESC, earned DESC, c.name ASC
       LIMIT 10`
    )
    .all() as Array<{
    id: string;
    name: string;
    earned: number;
    redeemed: number;
    balance: number;
  }>;

  const recentTransactions = db
    .prepare(
      `SELECT id, customerId, customerName, transactionType, points, notes, createdAt
       FROM loyalty_transactions
       ORDER BY createdAt DESC
       LIMIT 10`
    )
    .all() as LoyaltyTransactionRecord[];

  return {
    revenue: {
      saleCount: revenueSummary.saleCount,
      totalRevenue: revenueSummary.totalRevenue,
      totalTax: revenueSummary.totalTax,
      totalDiscount: revenueSummary.totalDiscount,
      averageSaleValue: revenueSummary.saleCount > 0 ? money(revenueSummary.totalRevenue / revenueSummary.saleCount) : 0,
      topPaymentMethod: topPaymentMethod?.paymentMethod ?? 'Cash',
      topProducts,
      monthlyTrend,
      recentSales,
    },
    customers: {
      totalCustomers: customerSummary.totalCustomers,
      activeCustomers: customerSummary.activeCustomers,
      newCustomersThisMonth: customerSummary.newCustomersThisMonth,
      averageVisitsPerCustomer: money(customerSummary.averageVisitsPerCustomer),
      topCustomers,
    },
    visits: {
      totalVisits: visitSummary.totalVisits,
      visitsToday: visitSummary.visitsToday,
      manualVisits: visitSummary.manualVisits,
      saleVisits: visitSummary.saleVisits,
      topServices,
      recentVisits,
    },
    loyalty: {
      totalEarned: loyaltySummary.totalEarned,
      totalRedeemed: loyaltySummary.totalRedeemed,
      outstandingBalance: outstandingBalance.total,
      topBalances,
      recentTransactions,
    },
  };
}

export function listInventory() {
  return getDatabase()
    .prepare(
      'SELECT id, sku, barcode, name, category, price, stock, taxRate, redeemPoints, isActive FROM products ORDER BY category, name'
    )
    .all();
}

export function listServices(): ServiceRecord[] {
  return getDatabase()
    .prepare(
      'SELECT id, code, name, description, price, redeemPoints, isActive FROM services WHERE isActive = 1 ORDER BY name'
    )
    .all() as ServiceRecord[];
}

export function createProduct(payload: {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  taxRate: number;
  redeemPoints?: number;
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
    redeemPoints: Math.max(0, Math.trunc(payload.redeemPoints ?? 0)),
    isActive: 1,
  };

  db.prepare(`
    INSERT INTO products (id, sku, barcode, name, category, price, stock, taxRate, redeemPoints, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.sku,
    product.barcode,
    product.name,
    product.category,
    product.price,
    product.stock,
    product.taxRate,
    product.redeemPoints,
    product.isActive
  );

  return product;
}

export function createService(payload: {
  code: string;
  name: string;
  description: string;
  price: number;
  redeemPoints?: number;
}) {
  const db = getDatabase();
  const code = payload.code.trim();
  const name = payload.name.trim();
  const description = payload.description.trim();

  if (!code || !name || !description) {
    throw new Error('Code, name, and description are required');
  }
  if (payload.price < 0) throw new Error('Price cannot be negative');
  const redeemPoints = Math.max(0, Math.trunc(payload.redeemPoints ?? 0));

  const existing = db
    .prepare('SELECT id FROM services WHERE code = ?')
    .get(code) as { id: string } | undefined;
  if (existing) {
    throw new Error('A service with the same code already exists');
  }

  const service = {
    id: crypto.randomUUID(),
    code,
    name,
    description,
    price: money(payload.price),
    redeemPoints,
    isActive: 1,
  };

  db.prepare(`
    INSERT INTO services (id, code, name, description, price, redeemPoints, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    service.id,
    service.code,
    service.name,
    service.description,
    service.price,
    service.redeemPoints,
    service.isActive
  );

  return service;
}

// All services including deleted ones (for the Services management page).
export function listAllServices(): ServiceRecord[] {
  return getDatabase()
    .prepare(
      'SELECT id, code, name, description, price, redeemPoints, isActive FROM services ORDER BY isActive DESC, name'
    )
    .all() as ServiceRecord[];
}

export function deleteService(payload: { serviceId: string }) {
  const db = getDatabase();
  const service = db
    .prepare('SELECT id, name, isActive FROM services WHERE id = ?')
    .get(payload.serviceId) as { id: string; name: string; isActive: number } | undefined;
  if (!service) throw new Error('Service not found');
  if (service.isActive === 0) throw new Error('Service is already deleted');

  db.prepare('UPDATE services SET isActive = 0 WHERE id = ?').run(payload.serviceId);
  return { serviceId: payload.serviceId, name: service.name, isActive: 0 };
}

export function restoreService(payload: { serviceId: string }) {
  const db = getDatabase();
  const service = db
    .prepare('SELECT id, name, isActive FROM services WHERE id = ?')
    .get(payload.serviceId) as { id: string; name: string; isActive: number } | undefined;
  if (!service) throw new Error('Service not found');
  if (service.isActive === 1) throw new Error('Service is already active');

  db.prepare('UPDATE services SET isActive = 1 WHERE id = ?').run(payload.serviceId);
  return { serviceId: payload.serviceId, name: service.name, isActive: 1 };
}

export function deleteServicePermanently(payload: { serviceId: string }) {
  const db = getDatabase();
  const service = db
    .prepare('SELECT id, name, isActive FROM services WHERE id = ?')
    .get(payload.serviceId) as { id: string; name: string; isActive: number } | undefined;
  if (!service) throw new Error('Service not found');
  if (service.isActive !== 0) throw new Error('Only already deleted services can be removed permanently');

  db.prepare('DELETE FROM services WHERE id = ?').run(payload.serviceId);
  return { serviceId: payload.serviceId, name: service.name, removed: true };
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

  // Full transaction ledger for this customer (newest first).
  const transactions = db
    .prepare(
      `SELECT id, receiptNo, paymentMethod, grandTotal, itemCount, loyaltyPointsEarned, createdAt
       FROM transactions
       WHERE customerId = ?
       ORDER BY createdAt DESC`
    )
    .all(customerId) as Array<{
    id: string;
    receiptNo: string;
    paymentMethod: string;
    grandTotal: number;
    itemCount: number;
    loyaltyPointsEarned: number;
    createdAt: string;
  }>;

  const transactionItems = db
    .prepare(
      `SELECT ti.transactionId, ti.itemType, ti.name, ti.qty, ti.price, ti.lineTotal
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transactionId
       WHERE t.customerId = ?`
    )
    .all(customerId) as Array<{
    transactionId: string;
    itemType: 'product' | 'service';
    name: string;
    qty: number;
    price: number;
    lineTotal: number;
  }>;

  const itemsByTransaction = new Map<string, LedgerItem[]>();
  for (const item of transactionItems) {
    const list = itemsByTransaction.get(item.transactionId) ?? [];
    list.push({
      itemType: item.itemType,
      name: item.name,
      qty: item.qty,
      price: item.price,
      lineTotal: item.lineTotal,
    });
    itemsByTransaction.set(item.transactionId, list);
  }

  const ledger: LedgerEntry[] = transactions.map((t) => ({
    id: t.id,
    receiptNo: t.receiptNo,
    createdAt: t.createdAt,
    paymentMethod: t.paymentMethod,
    grandTotal: t.grandTotal,
    itemCount: t.itemCount,
    pointsEarned: t.loyaltyPointsEarned,
    items: itemsByTransaction.get(t.id) ?? [],
  }));

  // Services from the most recent visit that actually included services.
  const lastVisitServices =
    ledger.find((entry) => entry.items.some((item) => item.itemType === 'service'))?.items.filter(
      (item) => item.itemType === 'service'
    ) ?? [];

  const pointsEarnedTotal = db
    .prepare(
      `SELECT COALESCE(SUM(loyaltyPointsEarned), 0) as total
       FROM transactions
       WHERE customerId = ?`
    )
    .get(customerId) as { total: number };

  const pointsRedeemedTotal = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) as total
       FROM loyalty_transactions
       WHERE customerId = ? AND transactionType = 'redeem'`
    )
    .get(customerId) as { total: number };

  return {
    customer,
    lastVisitServices,
    pointsEarnedTotal: pointsEarnedTotal.total,
    pointsRedeemedTotal: pointsRedeemedTotal.total,
    ledger,
  };
}

export function createVisit(payload: {
  customerId?: string | null;
  customerName?: string;
  serviceId?: string | null;
  serviceName?: string;
  amount?: number;
  notes?: string;
  source?: string;
}) {
  const result = createTransaction({
    cashierName: 'Legacy',
    paymentMethod: 'Cash',
    customerId: payload.customerId ?? null,
    customerName: payload.customerName,
    items: [
      {
        type: 'service',
        itemId: payload.serviceId ?? null,
        name: payload.serviceName ?? '',
        price: payload.amount ?? 0,
        qty: 1,
        taxRate: 0,
      },
    ],
  });

  return {
    id: result.id,
    customerId: result.customerId,
    customerName: result.customerName,
    serviceId: result.detailedItems?.[0]?.itemId ?? null,
    serviceCode: null,
    serviceName: result.detailedItems?.map((item) => item.name).join(', ') ?? '',
    servicePrice: result.detailedItems?.[0]?.price ?? 0,
    amount: result.grandTotal,
    priceOverride: 0,
    pointsEarned: result.loyaltyPointsEarned,
    notes: payload.notes?.trim() || null,
    createdAt: result.createdAt,
    source: payload.source?.trim() || 'transaction',
  } satisfies VisitRecord;
}

export function createBill(payload: {
  customerId?: string | null;
  customerName?: string;
  serviceId?: string | null;
  serviceName?: string;
  amount?: number;
  notes?: string;
  services?: Array<{
    serviceId: string;
    serviceCode?: string | null;
    serviceName: string;
    price: number;
  }>;
}) {
  const services = (payload.services ?? [])
    .map((service) => ({
      serviceId: service.serviceId.trim(),
      serviceCode: service.serviceCode?.trim() || null,
      serviceName: service.serviceName.trim(),
      price: service.price,
    }))
    .filter((service) => service.serviceName && Number.isFinite(service.price));

  return createTransaction({
    cashierName: 'Legacy',
    paymentMethod: 'Cash',
    customerId: payload.customerId ?? null,
    customerName: payload.customerName,
    items: (services.length > 0
      ? services
      : [
          {
            serviceId: payload.serviceId?.trim() || null,
            serviceCode: null,
            serviceName: payload.serviceName?.trim() || '',
            price: payload.amount ?? 0,
          },
        ]
    ).map((service) => ({
      type: 'service',
      itemId: service.serviceId,
      name: service.serviceName,
      price: service.price,
      qty: 1,
      taxRate: 0,
    })),
  }) satisfies SaleRecord;
}

export function redeemCustomerPoints(payload: { customerId: string; points: number; notes?: string }) {
  const db = getDatabase();
  const loyaltyRules = getSettings().loyaltyRules;
  const customerId = payload.customerId.trim();
  const points = Math.trunc(payload.points);
  const notes = payload.notes?.trim() || null;

  if (!customerId) throw new Error('Customer id is required');
  if (!Number.isFinite(points) || points <= 0) throw new Error('Points must be greater than zero');
  if (points < loyaltyRules.minimumRedeemPoints) {
    throw new Error(`Minimum redeem amount is ${loyaltyRules.minimumRedeemPoints} points`);
  }

  const customer = db
    .prepare('SELECT id, name, loyaltyPoints, visitsCount, lastVisitAt, createdAt, isActive FROM customers WHERE id = ?')
    .get(customerId) as CustomerRecord | undefined;
  if (!customer) throw new Error('Customer not found');
  if (customer.isActive === 0) throw new Error('Customer is deleted');
  if (customer.loyaltyPoints < points) throw new Error('Not enough loyalty points');

  const createdAt = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE customers SET loyaltyPoints = loyaltyPoints - ? WHERE id = ?').run(points, customerId);
    db.prepare(`
      INSERT INTO loyalty_transactions (id, customerId, customerName, transactionType, points, notes, createdAt)
      VALUES (?, ?, ?, 'redeem', ?, ?, ?)
    `).run(crypto.randomUUID(), customerId, customer.name, points, notes, createdAt);
  });

  tx();

  return {
    customerId,
    pointsRedeemed: points,
    loyaltyPoints: customer.loyaltyPoints - points,
    createdAt,
  };
}

export function getRecentVisits(limit = 8) {
  return getDatabase()
    .prepare(
      `SELECT
        t.id,
        t.customerId,
        t.customerName,
        NULL as serviceId,
        NULL as serviceCode,
        GROUP_CONCAT(ti.name, ', ') as serviceName,
        COALESCE(SUM(ti.price * ti.qty), 0) as servicePrice,
        COALESCE(SUM(ti.lineTotal), 0) as amount,
        0 as priceOverride,
        t.loyaltyPointsEarned as pointsEarned,
        NULL as notes,
        t.createdAt,
        t.originType as source
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE ti.itemType = 'service'
       GROUP BY t.id
       ORDER BY t.createdAt DESC
       LIMIT ?`
    )
    .all(limit) as VisitRecord[];
}

export function getRecentBills(limit = 10) {
  return getDatabase()
    .prepare(
      `SELECT
        t.id,
        t.customerId,
        t.customerName,
        NULL as serviceId,
        NULL as serviceCode,
        GROUP_CONCAT(ti.name, ', ') as serviceName,
        COALESCE(SUM(ti.price * ti.qty), 0) as servicePrice,
        COALESCE(SUM(ti.lineTotal), 0) as amount,
        0 as priceOverride,
        t.loyaltyPointsEarned as pointsEarned,
        NULL as notes,
        t.createdAt,
        t.originType as source
       FROM transactions t
       JOIN transaction_items ti ON ti.transactionId = t.id
       WHERE t.originType = 'visit' AND ti.itemType = 'service'
       GROUP BY t.id
       ORDER BY t.createdAt DESC
       LIMIT ?`
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

export function restoreProduct(payload: { productId: string }) {
  const db = getDatabase();
  const product = db
    .prepare('SELECT id, name, isActive FROM products WHERE id = ?')
    .get(payload.productId) as { id: string; name: string; isActive: number } | undefined;
  if (!product) throw new Error('Product not found');
  if (product.isActive === 1) throw new Error('Product is already active');

  db.prepare('UPDATE products SET isActive = 1 WHERE id = ?').run(payload.productId);
  return { productId: payload.productId, name: product.name, isActive: 1 };
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
