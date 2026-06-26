import { contextBridge, ipcRenderer } from 'electron';
import type { Product } from './schema';

contextBridge.exposeInMainWorld('pos', {
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  listProducts: () => ipcRenderer.invoke('products:list'),
  listCustomers: () => ipcRenderer.invoke('customers:list'),
  findCustomers: (payload: { query?: string; limit?: number }) => ipcRenderer.invoke('customers:find', payload),
  getCustomerProfile: (payload: { customerId: string }) => ipcRenderer.invoke('customers:profile', payload),
  getRecentSales: () => ipcRenderer.invoke('sales:recent'),
  createCustomer: (payload: { name: string; phone?: string; email?: string; notes?: string }) =>
    ipcRenderer.invoke('customers:create', payload),
  updateCustomer: (payload: { id: string; name: string; phone?: string; email?: string; notes?: string }) =>
    ipcRenderer.invoke('customers:update', payload),
  deleteCustomer: (payload: { id: string }) => ipcRenderer.invoke('customers:delete', payload),
  createVisit: (payload: {
    customerId?: string | null;
    customerName?: string;
    serviceName: string;
    amount: number;
    notes?: string;
  }) => ipcRenderer.invoke('visits:create', payload),
  createProduct: (payload: {
    sku: string;
    barcode: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    taxRate: number;
  }) => ipcRenderer.invoke('products:create', payload),
  deleteProduct: (payload: { productId: string }) => ipcRenderer.invoke('products:delete', payload),
  deleteProductPermanently: (payload: { productId: string }) =>
    ipcRenderer.invoke('products:delete-permanent', payload),
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
        customerCount: number;
        visitsToday: number;
        revenueToday: number;
        monthlyRevenue: number;
        loyaltyPointsTotal: number;
        pointsEarnedToday: number;
        averageVisitValue: number;
        recentVisits: Array<{
          id: string;
          customerId: string | null;
          customerName: string;
          serviceName: string;
          amount: number;
          pointsEarned: number;
          notes: string | null;
          createdAt: string;
          source: string;
        }>;
        pendingSync: number;
        online: boolean;
        registerName: string;
      }>;
      listProducts: () => Promise<Product[]>;
      listCustomers: () => Promise<Array<{
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
      }>>;
      findCustomers: (payload: { query?: string; limit?: number }) => Promise<Array<{
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
      }>>;
      getCustomerProfile: (payload: { customerId: string }) => Promise<{
        customer: {
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
        recentVisits: Array<{
          id: string;
          customerId: string | null;
          customerName: string;
          serviceName: string;
          amount: number;
          pointsEarned: number;
          notes: string | null;
          createdAt: string;
          source: string;
        }>;
        favoriteServices: Array<{
          serviceName: string;
          visitCount: number;
          totalAmount: number;
        }>;
      }>;
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
      createCustomer: (payload: { name: string; phone?: string; email?: string; notes?: string }) => Promise<{
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
      }>;
      updateCustomer: (payload: { id: string; name: string; phone?: string; email?: string; notes?: string }) => Promise<{
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
      }>;
      deleteCustomer: (payload: { id: string }) => Promise<{
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
      }>;
      createVisit: (payload: {
        customerId?: string | null;
        customerName?: string;
        serviceName: string;
        amount: number;
        notes?: string;
      }) => Promise<{
        id: string;
        customerId: string | null;
        customerName: string;
        serviceName: string;
        amount: number;
        pointsEarned: number;
        notes: string | null;
        createdAt: string;
        source: string;
      }>;
      createProduct: (payload: {
        sku: string;
        barcode: string;
        name: string;
        category: string;
        price: number;
        stock: number;
        taxRate: number;
      }) => Promise<{
        id: string;
        sku: string;
        barcode: string;
        name: string;
        category: string;
        price: number;
        stock: number;
        taxRate: number;
        isActive: number;
      }>;
      deleteProduct: (payload: { productId: string }) => Promise<{
        productId: string;
        name: string;
        isActive: 0;
      }>;
      deleteProductPermanently: (payload: { productId: string }) => Promise<{
        productId: string;
        name: string;
        removed: true;
      }>;
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
