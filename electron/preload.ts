import { contextBridge, ipcRenderer } from 'electron';
import type { Product } from './schema';

contextBridge.exposeInMainWorld('pos', {
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  listProducts: () => ipcRenderer.invoke('products:list'),
  getRecentSales: () => ipcRenderer.invoke('sales:recent'),
  createSale: (payload: {
    cashierName: string;
    paymentMethod: string;
    discountTotal?: number;
    items: Array<{ productId: string; quantity: number }>;
  }) => ipcRenderer.invoke('sales:create', payload),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  syncNow: () => ipcRenderer.invoke('sync:run'),
  listInventory: () => ipcRenderer.invoke('inventory:list'),
  adjustInventory: (payload: { productId: string; delta: number; reason: string }) =>
    ipcRenderer.invoke('inventory:adjust', payload),
  printReceipt: (payload: {
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
  }) => ipcRenderer.invoke('receipt:print', payload),
});

declare global {
  interface Window {
    pos: {
      getDashboard: () => Promise<{
        salesToday: number;
        receiptCount: number;
        productCount: number;
        pendingSync: number;
        online: boolean;
        registerName: string;
      }>;
      listProducts: () => Promise<Product[]>;
      getRecentSales: () => Promise<Array<{
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
      }>>;
      createSale: (payload: {
        cashierName: string;
        paymentMethod: string;
        discountTotal?: number;
        items: Array<{ productId: string; quantity: number }>;
      }) => Promise<{
        id: string;
        receiptNo: string;
        subtotal: number;
        taxTotal: number;
        discountTotal: number;
        grandTotal: number;
        createdAt: string;
        itemCount: number;
        cashierName: string;
        paymentMethod: string;
        detailedItems: Array<{
          id: string;
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      }>;
      getSyncStatus: () => Promise<{
        enabled: boolean;
        syncing: boolean;
        online: boolean;
        lastRunAt: string | null;
        lastSuccessAt: string | null;
        lastError: string | null;
        pendingCount: number;
        syncedCount: number;
      }>;
      syncNow: () => Promise<{
        enabled: boolean;
        syncing: boolean;
        online: boolean;
        lastRunAt: string | null;
        lastSuccessAt: string | null;
        lastError: string | null;
        pendingCount: number;
        syncedCount: number;
      }>;
      listInventory: () => Promise<Array<{
        id: string;
        sku: string;
        barcode: string;
        name: string;
        category: string;
        price: number;
        stock: number;
        taxRate: number;
        isActive: number;
      }>>;
      adjustInventory: (payload: { productId: string; delta: number; reason: string }) => Promise<{
        productId: string;
        stock: number;
      }>;
      printReceipt: (payload: {
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
      }) => Promise<boolean>;
    };
  }
}
