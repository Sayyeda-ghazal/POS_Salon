import type { Product, ServicePackage } from '../electron/schema';

type CustomerRow = {
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

type VisitRow = {
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

type CustomerServiceSummary = {
  serviceName: string;
  visitCount: number;
  totalAmount: number;
};

type LedgerItem = {
  itemType: 'product' | 'service';
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
};

type LedgerEntry = {
  id: string;
  receiptNo: string;
  createdAt: string;
  paymentMethod: string;
  grandTotal: number;
  itemCount: number;
  pointsEarned: number;
  items: LedgerItem[];
};

type CustomerProfile = {
  customer: CustomerRow;
  lastVisitServices: LedgerItem[];
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  ledger: LedgerEntry[];
};

type SaleRecord = {
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
};

type TransactionRecord = SaleRecord & {
  detailedItems: Array<{
    id: string;
    itemType: 'product' | 'service';
    itemId: string | null;
    name: string;
    price: number;
    qty: number;
    taxRate: number;
    lineTotal: number;
  }>;
};

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

type ReportSnapshot = {
  revenue: {
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
    topServices: CustomerServiceSummary[];
    recentVisits: VisitRow[];
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
};

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
        recentVisits: VisitRow[];
        pendingSync: number;
        online: boolean;
        registerName: string;
      }>;
      getReports: () => Promise<ReportSnapshot>;
      getSettings: () => Promise<{
        salonInfo: {
          name: string;
          phone: string;
          email: string;
          address: string;
          tagline: string;
        };
        loyaltyRules: {
          currencyPerPoint: number;
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
        currencyPerPoint?: number;
        minimumRedeemPoints?: number;
      }) => Promise<{
        currencyPerPoint: number;
        minimumRedeemPoints: number;
      }>;
      backupDatabase: () => Promise<{ saved: boolean; path?: string }>;
      restoreDatabase: () => Promise<{ restored: boolean; restoredFrom?: string; tablesRestored?: number; rowsRestored?: number }>;
      listProducts: () => Promise<Product[]>;
      listServices: () => Promise<ServicePackage[]>;
      listCustomers: () => Promise<CustomerRow[]>;
      findCustomers: (payload: { query?: string; limit?: number }) => Promise<CustomerRow[]>;
      getCustomerProfile: (payload: { customerId: string }) => Promise<CustomerProfile>;
      getRecentTransactions: (payload?: { limit?: number }) => Promise<SaleRecord[]>;
      getRecentSales: () => Promise<SaleRecord[]>;
      getRecentBills: () => Promise<VisitRow[]>;
      createCustomer: (payload: { name: string; phone?: string; email?: string; notes?: string }) => Promise<CustomerRow>;
      updateCustomer: (payload: { id: string; name: string; phone?: string; email?: string; notes?: string }) => Promise<CustomerRow>;
      deleteCustomer: (payload: { id: string }) => Promise<CustomerRow>;
      createVisit: (payload: {
        customerId?: string | null;
        customerName?: string;
        serviceId?: string | null;
        serviceName?: string;
        amount?: number;
        notes?: string;
      }) => Promise<VisitRow>;
      createBill: (payload: {
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
      }) => Promise<VisitRow>;
      createTransaction: (payload: {
        cashierName: string;
        paymentMethod: string;
        discountTotal?: number;
        customerId?: string | null;
        customerName?: string;
        originType?: string;
        originId?: string | null;
        items: Array<{
          type: 'product' | 'service';
          itemId?: string | null;
          name: string;
          price: number;
          qty?: number;
          taxRate?: number;
        }>;
      }) => Promise<TransactionRecord>;
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
        redeemPoints?: number;
      }) => Promise<Product>;
      listAllServices: () => Promise<ServicePackage[]>;
      createService: (payload: {
        code: string;
        name: string;
        description: string;
        price: number;
        redeemPoints?: number;
      }) => Promise<ServicePackage>;
      deleteService: (payload: { serviceId: string }) => Promise<{
        serviceId: string;
        name: string;
        isActive: 0;
      }>;
      restoreService: (payload: { serviceId: string }) => Promise<{
        serviceId: string;
        name: string;
        isActive: 1;
      }>;
      deleteServicePermanently: (payload: { serviceId: string }) => Promise<{
        serviceId: string;
        name: string;
        removed: true;
      }>;
      deleteProduct: (payload: { productId: string }) => Promise<{
        productId: string;
        name: string;
        isActive: 0;
      }>;
      restoreProduct: (payload: { productId: string }) => Promise<{
        productId: string;
        name: string;
        isActive: 1;
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
      }) => Promise<TransactionRecord>;
      getSyncStatus: () => Promise<SyncStatus>;
      syncNow: () => Promise<SyncStatus>;
      listInventory: () => Promise<Product[]>;
      adjustInventory: (payload: { productId: string; delta: number; reason: string }) => Promise<{
        productId: string;
        stock: number;
      }>;
      printReceipt: (payload: {
        receiptNo: string;
        cashierName: string;
        customerName?: string;
        paymentMethod: string;
        createdAt: string;
        subtotal: number;
        taxTotal: number;
        discountTotal: number;
        grandTotal: number;
        pointsEarned?: number;
        detailedItems: Array<{
          itemType?: string;
          name?: string;
          productName?: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      }) => Promise<boolean>;
    };
  }
}
