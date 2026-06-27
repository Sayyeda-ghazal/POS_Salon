import { contextBridge, ipcRenderer } from 'electron';
import type { Product } from './schema';

contextBridge.exposeInMainWorld('pos', {
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  getReports: () => ipcRenderer.invoke('reports:get'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSalonInfo: (payload: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    tagline?: string;
  }) => ipcRenderer.invoke('settings:update-salon', payload),
  updateLoyaltyRules: (payload: {
    pointsPer100Currency?: number;
    redemptionValuePerPoint?: number;
    minimumRedeemPoints?: number;
  }) => ipcRenderer.invoke('settings:update-loyalty', payload),
  backupDatabase: () => ipcRenderer.invoke('database:backup'),
  restoreDatabase: () => ipcRenderer.invoke('database:restore'),
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
    serviceId?: string | null;
    serviceName?: string;
    amount?: number;
    notes?: string;
  }) => ipcRenderer.invoke('visits:create', payload),
  redeemCustomerPoints: (payload: { customerId: string; points: number; notes?: string }) =>
    ipcRenderer.invoke('loyalty:redeem', payload),
  createProduct: (payload: {
    sku: string;
    barcode: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    taxRate: number;
  }) => ipcRenderer.invoke('products:create', payload),
  listServices: () => ipcRenderer.invoke('services:list'),
  createService: (payload: {
    code: string;
    name: string;
    description: string;
    price: number;
  }) => ipcRenderer.invoke('services:create', payload),
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
        }>;
        pendingSync: number;
        online: boolean;
        registerName: string;
      }>;
      getReports: () => Promise<{
        revenue: {
          saleCount: number;
          totalRevenue: number;
          totalTax: number;
          totalDiscount: number;
          averageSaleValue: number;
          topPaymentMethod: string;
          monthlyTrend: Array<{
            month: string;
            revenue: number;
            saleCount: number;
          }>;
          recentSales: Array<{
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
          }>;
        };
        customers: {
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
        visits: {
          totalVisits: number;
          visitsToday: number;
          manualVisits: number;
          saleVisits: number;
          topServices: Array<{
            serviceName: string;
            visitCount: number;
            totalAmount: number;
          }>;
          recentVisits: Array<{
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
          }>;
        };
        loyalty: {
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
          recentTransactions: Array<{
            id: string;
            customerId: string;
            customerName: string;
            transactionType: 'earn' | 'redeem';
            points: number;
            notes: string | null;
            createdAt: string;
          }>;
        };
      }>;
      getSettings: () => Promise<{
        salonInfo: {
          name: string;
          phone: string;
          email: string;
          address: string;
          tagline: string;
        };
        loyaltyRules: {
          pointsPer100Currency: number;
          redemptionValuePerPoint: number;
          minimumRedeemPoints: number;
        };
      }>;
      updateSalonInfo: (payload: {
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
        tagline?: string;
      }) => Promise<{
        name: string;
        phone: string;
        email: string;
        address: string;
        tagline: string;
      }>;
      updateLoyaltyRules: (payload: {
        pointsPer100Currency?: number;
        redemptionValuePerPoint?: number;
        minimumRedeemPoints?: number;
      }) => Promise<{
        pointsPer100Currency: number;
        redemptionValuePerPoint: number;
        minimumRedeemPoints: number;
      }>;
      backupDatabase: () => Promise<{ saved: boolean; path?: string }>;
      restoreDatabase: () => Promise<{ restored: boolean; restoredFrom?: string; databasePath?: string }>;
      listProducts: () => Promise<Product[]>;
      listServices: () => Promise<Array<{
        id: string;
        code: string;
        name: string;
        description: string;
        price: number;
        isActive: number;
      }>>;
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
        }>;
        favoriteServices: Array<{
          serviceName: string;
          visitCount: number;
          totalAmount: number;
        }>;
        pointsEarnedTotal: number;
        pointsRedeemedTotal: number;
        loyaltyTransactions: Array<{
          id: string;
          customerId: string;
          customerName: string;
          transactionType: 'earn' | 'redeem';
          points: number;
          notes: string | null;
          createdAt: string;
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
        serviceId?: string | null;
        serviceName?: string;
        amount?: number;
        notes?: string;
      }) => Promise<{
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
      }>;
      redeemCustomerPoints: (payload: { customerId: string; points: number; notes?: string }) => Promise<{
        customerId: string;
        pointsRedeemed: number;
        loyaltyPoints: number;
        createdAt: string;
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
      createService: (payload: {
        code: string;
        name: string;
        description: string;
        price: number;
      }) => Promise<{
        id: string;
        code: string;
        name: string;
        description: string;
        price: number;
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
