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
      }>;
    };
  }
}

