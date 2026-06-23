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
        if (row.entityType === 'sale') {
          await syncSale(sql, row);
        } else if (row.entityType === 'inventory_movement') {
          await syncInventoryMovement(sql, row);
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
