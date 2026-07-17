import { neon } from '@neondatabase/serverless';
import { getPendingSyncEntries, markSyncEntriesSynced, type SyncQueueRow } from './db';

type SyncStatus = {
  enabled: boolean;
  syncing: boolean;
  online: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  pendingCount: number;
  syncedCount: number;
};

type NeonClient = ReturnType<typeof neon>;

const emptyStatus = (): SyncStatus => ({
  enabled: false,
  syncing: false,
  online: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  pendingCount: 0,
  syncedCount: 0,
});

export class SyncService {
  private status = emptyStatus();
  private timer: NodeJS.Timeout | null = null;

  getStatus() {
    return this.status;
  }

  start() {
    this.status = {
      ...this.status,
      enabled: Boolean(process.env.NEON_DATABASE_URL),
    };

    if (!process.env.NEON_DATABASE_URL || this.timer) return;

    this.timer = setInterval(() => {
      void this.syncOnce();
    }, 30_000);

    void this.syncOnce();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async syncOnce() {
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      this.status = {
        ...this.status,
        enabled: false,
        syncing: false,
        online: false,
        lastRunAt: new Date().toISOString(),
        lastError: 'Neon is not configured',
      };
      return this.status;
    }

    if (this.status.syncing) return this.status;

    const sql = neon(databaseUrl) as NeonClient;
    this.status = {
      ...this.status,
      enabled: true,
      syncing: true,
      lastRunAt: new Date().toISOString(),
      lastError: null,
    };

    try {
      await ensureSchema(sql);
      const pendingRows = getPendingSyncEntries(50);
      let syncedCount = 0;

      for (const row of pendingRows) {
        if (row.entityType === 'transaction') {
          await syncTransaction(sql, row);
        } else if (row.entityType === 'sale') {
          await syncSale(sql, row);
        } else if (row.entityType === 'inventory_movement') {
          await syncInventoryMovement(sql, row);
        } else if (row.entityType === 'customer') {
          await syncCustomer(sql, row);
        } else if (row.entityType === 'visit') {
          await syncVisit(sql, row);
        }
        syncedCount += 1;
      }

      markSyncEntriesSynced(pendingRows.map((row) => row.id));

      this.status = {
        ...this.status,
        syncing: false,
        online: true,
        lastSuccessAt: new Date().toISOString(),
        pendingCount: 0,
        syncedCount,
      };
    } catch (error) {
      this.status = {
        ...this.status,
        syncing: false,
        online: false,
        lastError: error instanceof Error ? error.message : 'Sync failed',
      };
    }

    return this.status;
  }
}

async function ensureSchema(sql: NeonClient) {
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      receipt_no TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax_total REAL NOT NULL,
      discount_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
      item_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      origin_type TEXT,
      origin_id TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      receipt_no TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax_total REAL NOT NULL,
      discount_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      visits_count INTEGER NOT NULL DEFAULT 0,
      last_visit_at TEXT,
      created_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      amount REAL NOT NULL,
      points_earned INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
    )
  `;
}

async function syncTransaction(sql: NeonClient, row: SyncQueueRow) {
  if (row.entityType !== 'transaction') return;

  const payload = JSON.parse(row.payload) as {
    id: string;
    receiptNo: string;
    customerId: string | null;
    customerName: string;
    cashierName: string;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    paymentMethod: string;
    loyaltyPointsEarned: number;
    itemCount: number;
    createdAt: string;
    originType: string | null;
    originId: string | null;
    detailedItems: Array<{
      id: string;
      itemType: string;
      itemId: string | null;
      name: string;
      price: number;
      qty: number;
      taxRate: number;
      lineTotal: number;
    }>;
  };

  await sql`
    INSERT INTO transactions (
      id,
      receipt_no,
      customer_id,
      customer_name,
      cashier_name,
      subtotal,
      tax_total,
      discount_total,
      grand_total,
      payment_method,
      loyalty_points_earned,
      item_count,
      created_at,
      origin_type,
      origin_id
    ) VALUES (
      ${payload.id},
      ${payload.receiptNo},
      ${payload.customerId},
      ${payload.customerName},
      ${payload.cashierName},
      ${payload.subtotal},
      ${payload.taxTotal},
      ${payload.discountTotal},
      ${payload.grandTotal},
      ${payload.paymentMethod},
      ${payload.loyaltyPointsEarned},
      ${payload.itemCount},
      ${payload.createdAt},
      ${payload.originType},
      ${payload.originId}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  for (const item of payload.detailedItems) {
    await sql`
      INSERT INTO transaction_items (
        id,
        transaction_id,
        item_type,
        item_id,
        name,
        price,
        qty,
        tax_rate,
        line_total
      ) VALUES (
        ${item.id},
        ${payload.id},
        ${item.itemType},
        ${item.itemId},
        ${item.name},
        ${item.price},
        ${item.qty},
        ${item.taxRate},
        ${item.lineTotal}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

async function syncSale(sql: NeonClient, row: SyncQueueRow) {
  if (row.entityType !== 'sale') return;

  const payload = JSON.parse(row.payload) as {
    saleId: string;
    receiptNo: string;
    cashierName: string;
    paymentMethod: string;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    detailedItems: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    createdAt: string;
  };

  await sql`
    INSERT INTO sales (
      id,
      receipt_no,
      cashier_name,
      subtotal,
      tax_total,
      discount_total,
      grand_total,
      payment_method,
      item_count,
      created_at
    ) VALUES (
      ${payload.saleId},
      ${payload.receiptNo},
      ${payload.cashierName},
      ${payload.subtotal},
      ${payload.taxTotal},
      ${payload.discountTotal},
      ${payload.grandTotal},
      ${payload.paymentMethod},
      ${payload.detailedItems.length},
      ${payload.createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  for (const item of payload.detailedItems) {
    await sql`
      INSERT INTO sale_items (
        id,
        sale_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        line_total
      ) VALUES (
        ${item.id},
        ${payload.saleId},
        ${item.productId},
        ${item.productName},
        ${item.quantity},
        ${item.unitPrice},
        ${item.lineTotal}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

async function syncInventoryMovement(sql: NeonClient, row: SyncQueueRow) {
  const payload = JSON.parse(row.payload) as {
    productId: string;
    delta: number;
    reason: string;
    productName: string;
  };

  await sql`
    INSERT INTO inventory_movements (
      id,
      product_id,
      delta,
      reason,
      created_at
    ) VALUES (
      ${row.id},
      ${payload.productId},
      ${payload.delta},
      ${payload.reason},
      ${row.createdAt}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function syncCustomer(sql: NeonClient, row: SyncQueueRow) {
  const payload = JSON.parse(row.payload) as {
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

  await sql`
    INSERT INTO customers (
      id,
      name,
      phone,
      email,
      notes,
      loyalty_points,
      visits_count,
      last_visit_at,
      created_at,
      is_active
    ) VALUES (
      ${payload.id},
      ${payload.name},
      ${payload.phone},
      ${payload.email},
      ${payload.notes},
      ${payload.loyaltyPoints},
      ${payload.visitsCount},
      ${payload.lastVisitAt},
      ${payload.createdAt},
      ${payload.isActive}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      notes = EXCLUDED.notes,
      loyalty_points = EXCLUDED.loyalty_points,
      visits_count = EXCLUDED.visits_count,
      last_visit_at = EXCLUDED.last_visit_at,
      is_active = EXCLUDED.is_active
  `;
}

async function syncVisit(sql: NeonClient, row: SyncQueueRow) {
  const payload = JSON.parse(row.payload) as {
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

  await sql`
    INSERT INTO visits (
      id,
      customer_id,
      customer_name,
      service_name,
      amount,
      points_earned,
      notes,
      created_at,
      source
    ) VALUES (
      ${payload.id},
      ${payload.customerId},
      ${payload.customerName},
      ${payload.serviceName},
      ${payload.amount},
      ${payload.pointsEarned},
      ${payload.notes},
      ${payload.createdAt},
      ${payload.source}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}
