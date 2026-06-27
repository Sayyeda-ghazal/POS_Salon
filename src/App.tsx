import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Product, ServicePackage } from '../electron/schema';

type CartLine = Product & { quantity: number };
type InventoryRow = Product;
type ServiceRow = ServicePackage;
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
type CustomerProfile = {
  customer: CustomerRow;
  recentVisits: VisitRow[];
  favoriteServices: CustomerServiceSummary[];
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
};
type ViewMode = 'dashboard' | 'customers' | 'billing' | 'pos' | 'inventory' | 'services' | 'reports' | 'settings';
type SaleResult = {
  id: string;
  receiptNo: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
  itemCount: number;
  detailedItems: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  cashierName: string;
  paymentMethod: string;
};
type DashboardSummary = {
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
};
type ReportSnapshot = {
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
type SettingsSnapshot = {
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
};

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h7v7H4v-7Zm9 5v-9h7v9h-7Z" />
    </svg>
  );
}

function CustomersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM8 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm8 2c-3.31 0-6 2.24-6 5v1h12v-1c0-2.76-2.69-5-6-5ZM8 14c-2.76 0-5 1.79-5 4v2h4v-1c0-1.52.55-2.9 1.46-4.03A6.87 6.87 0 0 0 8 14Z" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Zm2 5h6V6H9v2Zm0 4h6v-2H9v2Z" />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 7-4-4-3 3-4.5 4.5a3.75 3.75 0 0 0 0 5.3l-.5.5-2.5-2.5-2 2 3 3-.75.75a1 1 0 0 0 0 1.41l1.5 1.5a1 1 0 0 0 1.41 0L15.5 16l3 3 2-2-2.5-2.5.5-.5a3.75 3.75 0 0 0 5.3 0L21 11V7Z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h2v18H5V3Zm6 6h2v12h-2V9Zm6-4h2v16h-2V5Z" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 7.5 8-4.5 8 4.5V16.5l-8 4.5-8-4.5V7.5Zm8-2.8-5.5 3.1 5.5 3 5.5-3-5.5-3.1ZM6 9.9v5.3l5 2.8v-5.3L6 9.9Zm12 0-5 2.8V18l5-2.8V9.9Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94L2.83 13.2a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z" />
    </svg>
  );
}

const money = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
});

const CASHIER_NAME = 'Amina Khan';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [recentSales, setRecentSales] = useState<Array<any>>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<ReportSnapshot | null>(null);
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    enabled: boolean;
    syncing: boolean;
    online: boolean;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    pendingCount: number;
    syncedCount: number;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<'ready' | 'saved'>('ready');
  const [view, setView] = useState<ViewMode>('dashboard');
  const [newItem, setNewItem] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: '',
    price: '0.00',
    stock: '0',
    taxRate: '0.08',
  });
  const [newItemStatus, setNewItemStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newItemError, setNewItemError] = useState('');
  const [newService, setNewService] = useState({
    code: '',
    name: '',
    description: '',
    price: '0.00',
  });
  const [newServiceStatus, setNewServiceStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newServiceError, setNewServiceError] = useState('');
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [newCustomerStatus, setNewCustomerStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newCustomerError, setNewCustomerError] = useState('');
  const [newVisit, setNewVisit] = useState({
    customerId: 'walk-in',
    serviceId: '',
    serviceName: '',
    amount: '0.00',
    manualAmount: false,
    notes: '',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMatches, setCustomerMatches] = useState<CustomerRow[]>([]);
  const [customerSearchStatus, setCustomerSearchStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedVisitCustomer, setSelectedVisitCustomer] = useState<CustomerRow | null>(null);
  const [newVisitStatus, setNewVisitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newVisitError, setNewVisitError] = useState('');
  const [customerDirectoryQuery, setCustomerDirectoryQuery] = useState('');
  const [customerDirectoryMatches, setCustomerDirectoryMatches] = useState<CustomerRow[]>([]);
  const [customerDirectoryStatus, setCustomerDirectoryStatus] = useState<'idle' | 'loading'>('idle');
  const [customerDirectoryRefreshToken, setCustomerDirectoryRefreshToken] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerProfileStatus, setCustomerProfileStatus] = useState<'idle' | 'loading'>('idle');
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [salonForm, setSalonForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    tagline: '',
  });
  const [loyaltyForm, setLoyaltyForm] = useState({
    pointsPer100Currency: '1',
    redemptionValuePerPoint: '1',
    minimumRedeemPoints: '50',
  });
  const [settingsStatus, setSettingsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [settingsError, setSettingsError] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [redeemPoints, setRedeemPoints] = useState('0');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [redeemError, setRedeemError] = useState('');
  const [customerFormMode, setCustomerFormMode] = useState<'create' | 'edit'>('create');
  const [customerFormStatus, setCustomerFormStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [customerFormError, setCustomerFormError] = useState('');
  const [customerModal, setCustomerModal] = useState<'customer' | 'visit' | 'edit' | 'redeem' | null>(null);
  const scanBuffer = useRef('');
  const scanTimer = useRef<number | null>(null);
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { key: 'customers', label: 'Customers', icon: <CustomersIcon /> },
    { key: 'billing', label: 'Billing', icon: <BillingIcon /> },
    { key: 'services', label: 'Services', icon: <ServicesIcon /> },
    { key: 'reports', label: 'Reports', icon: <ReportsIcon /> },
    { key: 'inventory', label: 'Inventory', icon: <InventoryIcon /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ] as const;
  const selectedService = useMemo(
    () => services.find((service) => service.id === newVisit.serviceId) ?? null,
    [newVisit.serviceId, services]
  );

  const refreshSettings = async () => {
    const next = await window.pos.getSettings();
    setSettings(next);
    setSalonForm(next.salonInfo);
    setLoyaltyForm({
      pointsPer100Currency: String(next.loyaltyRules.pointsPer100Currency),
      redemptionValuePerPoint: String(next.loyaltyRules.redemptionValuePerPoint),
      minimumRedeemPoints: String(next.loyaltyRules.minimumRedeemPoints),
    });
  };

  useEffect(() => {
    const load = async () => {
      const [dash, reportData, settingsData, list, serviceList, sales, sync, stock] = await Promise.all([
        window.pos.getDashboard(),
        window.pos.getReports(),
        window.pos.getSettings(),
        window.pos.listProducts(),
        window.pos.listServices(),
        window.pos.getRecentSales(),
        window.pos.getSyncStatus(),
        window.pos.listInventory(),
      ]);
      setDashboard(dash);
      setReports(reportData);
      setSettings(settingsData);
      setSalonForm(settingsData.salonInfo);
      setLoyaltyForm({
        pointsPer100Currency: String(settingsData.loyaltyRules.pointsPer100Currency),
        redemptionValuePerPoint: String(settingsData.loyaltyRules.redemptionValuePerPoint),
        minimumRedeemPoints: String(settingsData.loyaltyRules.minimumRedeemPoints),
      });
      setProducts(list);
      setServices(serviceList);
      setRecentSales(sales);
      setSyncStatus(sync);
      setInventory(stock);
    };

    void load();
    const timer = window.setInterval(() => {
      window.pos.getSyncStatus().then(setSyncStatus);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== 'pos' && view !== 'billing') return;
      if (event.key === 'Enter') {
        const code = scanBuffer.current.trim();
        scanBuffer.current = '';
        if (scanTimer.current) {
          window.clearTimeout(scanTimer.current);
          scanTimer.current = null;
        }
        if (!code) return;
        const match = products.find((product) => product.barcode === code);
        if (match) addToCart(match);
        return;
      }

      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
      scanBuffer.current += event.key;
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      scanTimer.current = window.setTimeout(() => {
        scanBuffer.current = '';
      }, 120);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [products, view]);

  useEffect(() => {
    let active = true;
    setCustomerSearchStatus('loading');

    const timer = window.setTimeout(async () => {
      try {
        const matches = await window.pos.findCustomers({
          query: customerSearch,
          limit: 8,
        });
        if (!active) return;
        setCustomerMatches(matches);
      } catch {
        if (!active) return;
        setCustomerMatches([]);
      } finally {
        if (active) setCustomerSearchStatus('idle');
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerSearch]);

  useEffect(() => {
    let active = true;
    setCustomerDirectoryStatus('loading');

    const timer = window.setTimeout(async () => {
      try {
        const matches = await window.pos.findCustomers({
          query: customerDirectoryQuery,
          limit: 20,
        });
        if (!active) return;
        setCustomerDirectoryMatches(matches);
      } catch {
        if (!active) return;
        setCustomerDirectoryMatches([]);
      } finally {
        if (active) setCustomerDirectoryStatus('idle');
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerDirectoryQuery, customerDirectoryRefreshToken]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerProfile(null);
      return;
    }

    let active = true;
    setCustomerProfileStatus('loading');

    window.pos
      .getCustomerProfile({ customerId: selectedCustomerId })
              .then((profile) => {
        if (!active) return;
        setCustomerProfile(profile);
        setCustomerForm({
          name: profile.customer.name,
          phone: profile.customer.phone ?? '',
          email: profile.customer.email ?? '',
          notes: profile.customer.notes ?? '',
        });
        setCustomerFormMode('edit');
        setCustomerFormError('');
        setCustomerFormStatus('idle');
        setRedeemPoints('0');
        setRedeemStatus('idle');
        setRedeemError('');
      })
      .catch((error) => {
        if (!active) return;
        setCustomerProfile(null);
        setCustomerFormError(error instanceof Error ? error.message : 'Could not load customer profile');
        setCustomerProfileStatus('idle');
      })
      .finally(() => {
        if (active) setCustomerProfileStatus('idle');
      });

    return () => {
      active = false;
    };
  }, [selectedCustomerId]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = `${product.name} ${product.sku} ${product.barcode} ${product.category}`.toLowerCase();
      return q.length === 0 || haystack.includes(q);
    });
  }, [products, query]);

  const activeInventory = useMemo(
    () => inventory.filter((item) => item.isActive === 1),
    [inventory]
  );
  const deletedInventory = useMemo(
    () => inventory.filter((item) => item.isActive === 0),
    [inventory]
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = cart.reduce((sum, item) => sum + item.price * item.quantity * item.taxRate, 0);
  const total = subtotal + tax;

  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setStatus('ready');
  };

  const increaseCartItem = (productId: string) => {
    setCart((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
    setStatus('ready');
  };

  const decreaseCartItem = (productId: string) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
    setStatus('ready');
  };

  const removeCartItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.id !== productId));
    setStatus('ready');
  };

  const clearCart = () => {
    setCart([]);
    setStatus('ready');
  };

  const refreshData = async () => {
    const [dash, reportData, settingsData, list, serviceList, sales, sync, stock] = await Promise.all([
      window.pos.getDashboard(),
      window.pos.getReports(),
      window.pos.getSettings(),
      window.pos.listProducts(),
      window.pos.listServices(),
      window.pos.getRecentSales(),
      window.pos.getSyncStatus(),
      window.pos.listInventory(),
    ]);
    setDashboard(dash);
    setReports(reportData);
    setSettings(settingsData);
    setSalonForm(settingsData.salonInfo);
    setLoyaltyForm({
      pointsPer100Currency: String(settingsData.loyaltyRules.pointsPer100Currency),
      redemptionValuePerPoint: String(settingsData.loyaltyRules.redemptionValuePerPoint),
      minimumRedeemPoints: String(settingsData.loyaltyRules.minimumRedeemPoints),
    });
    setProducts(list);
    setServices(serviceList);
    setRecentSales(sales);
    setSyncStatus(sync);
    setInventory(stock);
  };

  const submitSale = async () => {
    if (cart.length === 0) return;
    const result = (await window.pos.createSale({
      cashierName: CASHIER_NAME,
      paymentMethod: 'Cash',
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
    })) as SaleResult;
    setCart([]);
    setStatus('saved');
    await window.pos.printReceipt(result);
    await refreshData();
    alert(`Invoice saved locally as ${result.receiptNo}`);
  };

  const adjustStock = async (productId: string, delta: number) => {
    await window.pos.adjustInventory({
      productId,
      delta,
      reason: delta > 0 ? 'manual restock' : 'manual adjustment',
    });
    await refreshData();
  };

  const softDeleteItem = async (productId: string, itemName: string) => {
    const confirmed = window.confirm(
      `Delete ${itemName}? It will be marked as deleted and hidden from the POS.`
    );
    if (!confirmed) return;
    await window.pos.deleteProduct({ productId });
    await refreshData();
  };

  const hardDeleteItem = async (productId: string, itemName: string) => {
    const confirmed = window.confirm(
      `Permanently delete ${itemName}? This cannot be undone.`
    );
    if (!confirmed) return;
    await window.pos.deleteProductPermanently({ productId });
    await refreshData();
  };

  const createNewItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewItemStatus('saving');
    setNewItemError('');

    try {
      await window.pos.createProduct({
        sku: newItem.sku,
        barcode: newItem.barcode,
        name: newItem.name,
        category: newItem.category,
        price: Number(newItem.price),
        stock: Number(newItem.stock),
        taxRate: Number(newItem.taxRate),
      });
      setNewItem({
        sku: '',
        barcode: '',
        name: '',
        category: '',
        price: '0.00',
        stock: '0',
        taxRate: '0.08',
      });
      setNewItemStatus('saved');
      await refreshData();
    } catch (error) {
      setNewItemStatus('error');
      setNewItemError(error instanceof Error ? error.message : 'Could not create item');
    }
  };

  const createNewService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewServiceStatus('saving');
    setNewServiceError('');

    try {
      await window.pos.createService({
        code: newService.code,
        name: newService.name,
        description: newService.description,
        price: Number(newService.price),
      });
      setNewService({
        code: '',
        name: '',
        description: '',
        price: '0.00',
      });
      setNewServiceStatus('saved');
      await refreshData();
    } catch (error) {
      setNewServiceStatus('error');
      setNewServiceError(error instanceof Error ? error.message : 'Could not create service');
    }
  };

  const saveSalonSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsStatus('saving');
    setSettingsError('');

    try {
      const next = await window.pos.updateSalonInfo(salonForm);
      setSalonForm(next);
      setSettings((current) =>
        current
          ? {
              ...current,
              salonInfo: next,
            }
          : current
      );
      setSettingsStatus('saved');
    } catch (error) {
      setSettingsStatus('error');
      setSettingsError(error instanceof Error ? error.message : 'Could not save salon information');
    }
  };

  const saveLoyaltySettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsStatus('saving');
    setSettingsError('');

    try {
      const next = await window.pos.updateLoyaltyRules({
        pointsPer100Currency: Number(loyaltyForm.pointsPer100Currency),
        redemptionValuePerPoint: Number(loyaltyForm.redemptionValuePerPoint),
        minimumRedeemPoints: Number(loyaltyForm.minimumRedeemPoints),
      });
      setLoyaltyForm({
        pointsPer100Currency: String(next.pointsPer100Currency),
        redemptionValuePerPoint: String(next.redemptionValuePerPoint),
        minimumRedeemPoints: String(next.minimumRedeemPoints),
      });
      setSettings((current) =>
        current
          ? {
              ...current,
              loyaltyRules: next,
            }
          : current
      );
      setSettingsStatus('saved');
    } catch (error) {
      setSettingsStatus('error');
      setSettingsError(error instanceof Error ? error.message : 'Could not save loyalty rules');
    }
  };

  const backupDatabase = async () => {
    setBackupStatus('saving');
    setBackupMessage('');

    try {
      const result = await window.pos.backupDatabase();
      setBackupStatus('saved');
      setBackupMessage(result.saved && result.path ? `Backup saved to ${result.path}` : 'Backup was canceled.');
    } catch (error) {
      setBackupStatus('error');
      setBackupMessage(error instanceof Error ? error.message : 'Could not back up the database');
    }
  };

  const restoreDatabase = async () => {
    const confirmed = window.confirm(
      'Restore database from a backup file? This will replace the current local database.'
    );
    if (!confirmed) return;

    setRestoreStatus('saving');
    setRestoreMessage('');

    try {
      const result = await window.pos.restoreDatabase();
      if (!result.restored) {
        setRestoreStatus('saved');
        setRestoreMessage('Restore was canceled.');
        return;
      }

      setRestoreStatus('saved');
      setRestoreMessage(`Restored from ${result.restoredFrom ?? 'backup file'}`);
      setSelectedCustomerId('');
      setCustomerProfile(null);
      setCustomerFormStatus('idle');
      setCustomerFormError('');
      setCustomerDirectoryRefreshToken((current) => current + 1);
      setView('dashboard');
      await refreshData();
    } catch (error) {
      setRestoreStatus('error');
      setRestoreMessage(error instanceof Error ? error.message : 'Could not restore the database');
    }
  };

  const createNewCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewCustomerStatus('saving');
    setNewCustomerError('');

    try {
      await window.pos.createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone || undefined,
        email: newCustomer.email || undefined,
        notes: newCustomer.notes || undefined,
      });
      setNewCustomer({ name: '', phone: '', email: '', notes: '' });
      setNewCustomerStatus('saved');
      setCustomerModal(null);
      await refreshData();
    } catch (error) {
      setNewCustomerStatus('error');
      setNewCustomerError(error instanceof Error ? error.message : 'Could not create customer');
    }
  };

  const createNewVisit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewVisitStatus('saving');
    setNewVisitError('');

    try {
      const selectedCustomerId = newVisit.customerId === 'walk-in' ? null : newVisit.customerId;
      const selectedCustomer = selectedCustomerId ? selectedVisitCustomer : null;
      if (!selectedService) {
        throw new Error('Please select a service package');
      }
      const amount = newVisit.manualAmount ? Number(newVisit.amount) : selectedService.price;

      await window.pos.createVisit({
        customerId: selectedCustomerId,
        customerName: selectedCustomer?.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        amount,
        notes: newVisit.notes || undefined,
      });
      setNewVisit({
        customerId: 'walk-in',
        serviceId: '',
        serviceName: '',
        amount: '0.00',
        manualAmount: false,
        notes: '',
      });
      setCustomerSearch('');
      setCustomerMatches([]);
      setSelectedVisitCustomer(null);
      setNewVisitStatus('saved');
      setCustomerModal(null);
      await refreshData();
    } catch (error) {
      setNewVisitStatus('error');
      setNewVisitError(error instanceof Error ? error.message : 'Could not create visit');
    }
  };

  const closeCustomerModal = () => {
    setCustomerModal(null);
  };

  const openAddCustomerModal = () => {
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      notes: '',
    });
    setCustomerFormMode('create');
    setSelectedCustomerId('');
    setCustomerProfile(null);
    setCustomerFormError('');
    setCustomerFormStatus('idle');
    setRedeemPoints('0');
    setRedeemStatus('idle');
    setRedeemError('');
    setCustomerModal('customer');
  };

  const openVisitModal = () => {
    const hasSelectedCustomer = Boolean(selectedCustomerId && customerProfile);
    setNewVisit({
      customerId: hasSelectedCustomer ? selectedCustomerId : 'walk-in',
      serviceId: '',
      serviceName: '',
      amount: '0.00',
      manualAmount: false,
      notes: '',
    });
    setCustomerSearch(hasSelectedCustomer ? customerProfile!.customer.name : '');
    setCustomerMatches([]);
    setSelectedVisitCustomer(hasSelectedCustomer ? customerProfile!.customer : null);
    setNewVisitStatus('idle');
    setNewVisitError('');
    setCustomerModal('visit');
  };

  const openEditCustomerModal = () => {
    if (!customerProfile || !selectedCustomerId) return;
    setCustomerForm({
      name: customerProfile.customer.name,
      phone: customerProfile.customer.phone ?? '',
      email: customerProfile.customer.email ?? '',
      notes: customerProfile.customer.notes ?? '',
    });
    setCustomerFormMode('edit');
    setCustomerFormStatus('idle');
    setCustomerFormError('');
    setCustomerModal('edit');
  };

  const openRedeemModal = () => {
    if (!customerProfile || !selectedCustomerId) return;
    setRedeemPoints('0');
    setRedeemStatus('idle');
    setRedeemError('');
    setCustomerModal('redeem');
  };

  const clearCustomerSelection = () => {
    setSelectedCustomerId('');
    setCustomerProfile(null);
    setCustomerFormMode('create');
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      notes: '',
    });
    setCustomerFormError('');
    setCustomerFormStatus('idle');
    setRedeemPoints('0');
    setRedeemStatus('idle');
    setRedeemError('');
    setCustomerModal(null);
  };

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerFormStatus('saving');
    setCustomerFormError('');

    try {
      if (customerFormMode === 'edit' && selectedCustomerId) {
        const updated = await window.pos.updateCustomer({
          id: selectedCustomerId,
          name: customerForm.name,
          phone: customerForm.phone || undefined,
          email: customerForm.email || undefined,
          notes: customerForm.notes || undefined,
        });
        setCustomerProfile((current) =>
          current
            ? {
                ...current,
                customer: updated,
              }
            : current
        );
      } else {
        const created = await window.pos.createCustomer({
          name: customerForm.name,
          phone: customerForm.phone || undefined,
          email: customerForm.email || undefined,
          notes: customerForm.notes || undefined,
        });
        setSelectedCustomerId(created.id);
      }

      setCustomerFormStatus('saved');
      setCustomerDirectoryRefreshToken((current) => current + 1);
      setCustomerModal(null);
      await refreshData();
    } catch (error) {
      setCustomerFormStatus('error');
      setCustomerFormError(error instanceof Error ? error.message : 'Could not save customer');
    }
  };

  const redeemCustomerPoints = async () => {
    if (!selectedCustomerId || !customerProfile) return;

    setRedeemStatus('saving');
    setRedeemError('');

    try {
      const result = await window.pos.redeemCustomerPoints({
        customerId: selectedCustomerId,
        points: Number(redeemPoints),
        notes: `Redeemed from ${customerProfile.customer.name}`,
      });
      setRedeemPoints('0');
      setRedeemStatus('saved');
      setCustomerModal(null);
      setCustomerProfile((current) =>
        current
          ? {
              ...current,
              customer: {
                ...current.customer,
                loyaltyPoints: result.loyaltyPoints,
              },
              pointsRedeemedTotal: current.pointsRedeemedTotal + result.pointsRedeemed,
              loyaltyTransactions: [
                {
                  id: `redeem-${Date.now()}`,
                  customerId: selectedCustomerId,
                  customerName: customerProfile.customer.name,
                  transactionType: 'redeem',
                  points: result.pointsRedeemed,
                  notes: `Redeemed from ${customerProfile.customer.name}`,
                  createdAt: result.createdAt,
                },
                ...current.loyaltyTransactions,
              ],
            }
          : current
      );
      await refreshData();
    } catch (error) {
      setRedeemStatus('error');
      setRedeemError(error instanceof Error ? error.message : 'Could not redeem points');
    }
  };

  const removeCustomer = async () => {
    if (!selectedCustomerId || !customerProfile) return;
    const confirmed = window.confirm(`Delete ${customerProfile.customer.name}? This hides the customer from the active list.`);
    if (!confirmed) return;

    setCustomerFormStatus('saving');
    setCustomerFormError('');

    try {
      await window.pos.deleteCustomer({ id: selectedCustomerId });
      clearCustomerSelection();
      setCustomerDirectoryQuery('');
      setCustomerDirectoryRefreshToken((current) => current + 1);
      await refreshData();
    } catch (error) {
      setCustomerFormStatus('error');
      setCustomerFormError(error instanceof Error ? error.message : 'Could not delete customer');
    }
  };

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark">OP</div>
          <div className="sidebar-brand-copy">
            <p className="eyebrow">{settings?.salonInfo.name ?? 'Offline POS'}</p>
          </div>
        </div>

        <nav className="sidebar-menu" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav-button ${view === item.key ? 'sidebar-nav-button-active' : ''}`}
              onClick={() => setView(item.key)}
              aria-label={item.label}
              title={item.label}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {view === 'dashboard'
                ? 'Front desk'
                : view === 'customers'
                  ? 'Reception'
                  : view === 'reports'
                    ? 'Reporting'
                    : view === 'billing' || view === 'pos'
                      ? 'Billing desk'
                  : view === 'services'
                    ? 'Treatment catalog'
                  : view === 'settings'
                    ? 'Administration'
                  : 'Cashier station'}
            </p>
            <h2>
              {view === 'dashboard'
                ? 'Parlor dashboard for customers, visits, and loyalty.'
                : view === 'customers'
                  ? 'Manage customer profiles, history, and favorite services.'
                  : view === 'reports'
                    ? 'Review revenue, visit, customer, and loyalty performance.'
                  : view === 'billing' || view === 'pos'
                    ? 'Generate invoices, save transactions, and print receipts.'
                  : view === 'services'
                    ? 'Create treatment packages with codes, descriptions, and pricing.'
                  : view === 'settings'
                    ? 'Configure the salon profile, loyalty rules, and database maintenance.'
                  : 'Fast checkout, built to feel calm and premium.'}
            </h2>
          </div>
        </header>

        {view === 'dashboard' ? (
          <section className="dashboard-view">
            <div className="dashboard-hero">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h3>Everything the front desk needs in one glance.</h3>
                <p className="muted">
                  Track customers, today's visits, revenue, and loyalty points while keeping quick actions close by.
                </p>
              </div>
              <div className="dashboard-hero-actions">
                <button className="ghost-button" onClick={() => setView('billing')}>
                  New Bill
                </button>
                <button className="ghost-button" onClick={() => setView('services')}>
                  Services
                </button>
                <button className="ghost-button" onClick={() => setView('reports')}>
                  Reports
                </button>
              </div>
            </div>

            <div className="dashboard-metrics">
              <div className="metric-card">
                <span>Total customers</span>
                <strong>{dashboard?.customerCount ?? '...'}</strong>
                <small>Active client profiles</small>
              </div>
              <div className="metric-card">
                <span>Today's visits</span>
                <strong>{dashboard?.visitsToday ?? '...'}</strong>
                <small>Walk-ins and booked sessions</small>
              </div>
              <div className="metric-card">
                <span>Revenue summary</span>
                <strong>{dashboard ? money.format(dashboard.revenueToday) : '...'}</strong>
                <small>{dashboard ? `${money.format(dashboard.monthlyRevenue)} this month` : 'Monthly revenue'}</small>
              </div>
              <div className="metric-card">
                <span>Loyalty points</span>
                <strong>{dashboard?.loyaltyPointsTotal ?? '...'}</strong>
                <small>{dashboard?.pointsEarnedToday ?? 0} earned today</small>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Quick actions</p>
                    <h2>Customer center</h2>
                  </div>
                  <span className="pill pill-offline">Local first</span>
                </div>

                <div className="quick-actions-grid">
                  <button
                    className="mini-form mini-action-button"
                    type="button"
                    onClick={() => {
                      setView('customers');
                      openAddCustomerModal();
                    }}
                  >
                    <h3>Add Customer</h3>
                    <span>Open a popup for customer details.</span>
                  </button>
                  <button
                    className="mini-form mini-action-button"
                    type="button"
                    onClick={() => {
                      setView('customers');
                      openVisitModal();
                    }}
                  >
                    <h3>New Visit</h3>
                    <span>Select a customer and service in a popup.</span>
                  </button>
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Recent visits</p>
                    <h2>Transaction history</h2>
                  </div>
                  <span className="pill pill-online">{dashboard?.recentVisits.length ?? 0} logged</span>
                </div>
                <div className="list dashboard-visit-list">
                  {(dashboard?.recentVisits ?? []).map((visit) => (
                    <div className="list-item" key={visit.id}>
                      <div>
                        <strong>{visit.customerName}</strong>
                        <span>
                          {visit.serviceCode ? `${visit.serviceCode} · ` : ''}
                          {visit.serviceName}
                          {visit.priceOverride ? ' · manual price' : ''}
                          {visit.notes ? ` · ${visit.notes}` : ''}
                        </span>
                      </div>
                      <div className="right">
                        <strong>{money.format(visit.amount)}</strong>
                        <span>
                          {visit.pointsEarned} points ·{' '}
                          {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : view === 'customers' ? (
          <section className="customer-management">
            <div className={`customer-management-layout ${customerProfile ? 'customer-management-layout-split' : 'customer-management-layout-full'}`}>
              <aside className="panel customer-directory">
                <div className="customer-directory-head">
                  <div>
                    <p className="eyebrow">Customer management</p>
                    <h2>Search by name or phone</h2>
                  </div>
                  <button className="ghost-button ghost-button-small" onClick={openAddCustomerModal}>
                    New customer
                  </button>
                </div>

                <input
                  className="search customer-search"
                  placeholder="Type name or phone number"
                  value={customerDirectoryQuery}
                  onChange={(event) => setCustomerDirectoryQuery(event.target.value)}
                />

                <div className="customer-directory-list">
                  {customerDirectoryStatus === 'loading' ? <span className="muted">Loading customers...</span> : null}
                  {customerDirectoryMatches.map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      className={`customer-directory-item ${selectedCustomerId === customer.id ? 'customer-directory-item-active' : ''}`}
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      <div>
                        <strong>{customer.name}</strong>
                        <span>{customer.phone || 'No phone'}</span>
                      </div>
                      <div className="right">
                        <strong>{customer.visitsCount}</strong>
                        <span>visits</span>
                      </div>
                    </button>
                  ))}
                  {customerDirectoryStatus === 'idle' && customerDirectoryMatches.length === 0 ? (
                    <span className="muted">No customers found.</span>
                  ) : null}
                </div>
              </aside>

              {customerProfile ? (
                <section className="panel customer-profile-panel">
                  <div className="customer-profile-stats">
                    <div className="metric-card">
                      <span>Visits</span>
                      <strong>{customerProfile.customer.visitsCount}</strong>
                      <small>Total visits</small>
                    </div>
                    <div className="metric-card">
                      <span>Points earned</span>
                      <strong>{customerProfile.pointsEarnedTotal}</strong>
                      <small>From completed visits</small>
                    </div>
                    <div className="metric-card">
                      <span>Points redeemed</span>
                      <strong>{customerProfile.pointsRedeemedTotal}</strong>
                      <small>Loyalty used</small>
                    </div>
                    <div className="metric-card">
                      <span>Loyalty balance</span>
                      <strong>{customerProfile.customer.loyaltyPoints}</strong>
                      <small>Available points</small>
                    </div>
                    <div className="metric-card">
                      <span>Last visit</span>
                      <strong>
                        {customerProfile.customer.lastVisitAt
                          ? new Date(customerProfile.customer.lastVisitAt).toLocaleDateString()
                          : '—'}
                      </strong>
                      <small>Most recent session</small>
                    </div>
                  </div>

                  <div className="customer-profile-grid">
                    <section className="customer-profile-card">
                      <div className="inventory-section-head">
                        <div>
                          <h3>Services taken</h3>
                          <span className="muted">Most requested treatments</span>
                        </div>
                      </div>
                      <div className="customer-summary-list">
                        {customerProfile.favoriteServices.length > 0 ? (
                          customerProfile.favoriteServices.map((service) => (
                            <div className="customer-summary-item" key={service.serviceName}>
                              <div>
                                <strong>{service.serviceName}</strong>
                                <span>{service.visitCount} visits</span>
                              </div>
                              <div className="right">
                                <strong>{money.format(service.totalAmount)}</strong>
                                <span>spent</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="muted">No visit history yet.</span>
                        )}
                      </div>
                    </section>

                    <section className="customer-profile-card">
                      <div className="inventory-section-head">
                        <div>
                          <h3>Transaction history</h3>
                          <span className="muted">Latest salon visits</span>
                        </div>
                      </div>
                      <div className="customer-history-list">
                        {customerProfile.recentVisits.length > 0 ? (
                          customerProfile.recentVisits.map((visit) => (
                            <div className="customer-history-item" key={visit.id}>
                              <div>
                                <strong>{visit.serviceName}</strong>
                                <span>
                                  {visit.serviceCode ? `${visit.serviceCode} · ` : ''}
                                  {visit.priceOverride ? 'manual price · ' : ''}
                                  {visit.notes || 'No notes'}
                                </span>
                              </div>
                              <div className="right">
                                <strong>{money.format(visit.amount)}</strong>
                                <span>
                                  {new Date(visit.createdAt).toLocaleDateString()} · {visit.pointsEarned} points
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="muted">No visits recorded for this customer.</span>
                        )}
                      </div>
                    </section>

                    <section className="customer-profile-card">
                      <div className="inventory-section-head">
                        <div>
                          <h3>Loyalty activity</h3>
                          <span className="muted">Points earned and redeemed</span>
                        </div>
                      </div>
                      <div className="customer-history-list">
                        {customerProfile.loyaltyTransactions.length > 0 ? (
                          customerProfile.loyaltyTransactions.map((entry) => (
                            <div className="customer-history-item" key={entry.id}>
                              <div>
                                <strong>{entry.transactionType === 'earn' ? 'Points earned' : 'Points redeemed'}</strong>
                                <span>{entry.notes || 'No notes'}</span>
                              </div>
                              <div className="right">
                                <strong>{entry.transactionType === 'earn' ? '+' : '-'}{entry.points}</strong>
                                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="muted">No loyalty transactions yet.</span>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="customer-profile-actions">
                    <button className="ghost-button" onClick={openEditCustomerModal}>
                      Edit customer
                    </button>
                    <button className="ghost-button" onClick={openRedeemModal}>
                      Redeem loyalty
                    </button>
                    <button className="danger-button" onClick={removeCustomer} disabled={customerProfile.customer.isActive === 0}>
                      Delete customer
                    </button>
                    <button className="ghost-button" onClick={clearCustomerSelection}>
                      Clear selection
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        ) : view === 'billing' || view === 'pos' ? (
          <section className="workspace">
          <div className="catalog">
            <div className="search-wrap">
                <input
                  autoFocus
                  className="search"
                  placeholder="Search item, code, or category"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <button className="product-card" key={product.id} onClick={() => addToCart(product)}>
                  <div className="product-top">
                    <span className="category">{product.category}</span>
                    <span className="stock">{product.stock} left</span>
                  </div>
                  <h3>{product.name}</h3>
                  <div className="product-bottom">
                    <strong>{money.format(product.price)}</strong>
                    <span>{product.sku}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="cart">
            <div className="cart-header">
              <div>
                <p className="eyebrow">Current basket</p>
                <h3>{cart.length} items</h3>
              </div>
              <div className="cart-header-actions">
                <span className={status === 'saved' ? 'pill pill-online' : 'pill'}>{status}</span>
                {cart.length > 0 ? (
                  <button className="ghost-button ghost-button-small" onClick={clearCart}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="cart-lines">
              {cart.length === 0 ? (
                <div className="empty">
                  <strong>No items yet</strong>
                  <span>Scan a barcode or tap a product to begin.</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div className="cart-line" key={item.id}>
                    <div className="cart-line-main">
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.quantity} x {money.format(item.price)}
                        </span>
                      </div>
                      <div className="cart-line-controls">
                        <button
                          className="ghost-button ghost-button-small"
                          onClick={() => decreaseCartItem(item.id)}
                          aria-label={`Decrease ${item.name}`}
                        >
                          -
                        </button>
                        <button
                          className="ghost-button ghost-button-small"
                          onClick={() => increaseCartItem(item.id)}
                          aria-label={`Increase ${item.name}`}
                        >
                          +
                        </button>
                        <button
                          className="ghost-button ghost-button-small"
                          onClick={() => removeCartItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{money.format(item.price * item.quantity)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <strong>{money.format(subtotal)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{money.format(tax)}</strong>
              </div>
              <div className="grand">
                <span>Total</span>
                <strong>{money.format(total)}</strong>
              </div>
            </div>

            <button className="primary-button" onClick={submitSale} disabled={cart.length === 0}>
              Generate invoice
            </button>

            <div className="inventory-section inventory-section-muted">
              <div className="inventory-section-head">
                <div>
                  <h3>Saved bills</h3>
                  <span className="muted">Latest transaction records</span>
                </div>
                <span className="muted">{recentSales.length} stored</span>
              </div>
              <div className="customer-history-list">
                {recentSales.slice(0, 6).map((sale) => (
                  <div className="customer-history-item" key={sale.id}>
                    <div>
                      <strong>{sale.receiptNo}</strong>
                      <span>
                        {sale.itemCount} items · {sale.paymentMethod} ·{' '}
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="right">
                      <strong>{money.format(sale.grandTotal)}</strong>
                      <span>{sale.cashierName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          </section>
        ) : view === 'reports' ? (
          <section className="reports-view">
            <div className="dashboard-metrics">
              <div className="metric-card">
                <span>Revenue</span>
                <strong>{reports ? money.format(reports.revenue.totalRevenue) : '...'}</strong>
                <small>{reports?.revenue.saleCount ?? 0} invoices</small>
              </div>
              <div className="metric-card">
                <span>Customers</span>
                <strong>{reports?.customers.totalCustomers ?? '...'}</strong>
                <small>{reports?.customers.activeCustomers ?? 0} active</small>
              </div>
              <div className="metric-card">
                <span>Visits</span>
                <strong>{reports?.visits.totalVisits ?? '...'}</strong>
                <small>{reports?.visits.visitsToday ?? 0} today</small>
              </div>
              <div className="metric-card">
                <span>Loyalty balance</span>
                <strong>{reports?.loyalty.outstandingBalance ?? '...'}</strong>
                <small>{reports?.loyalty.totalRedeemed ?? 0} redeemed</small>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Revenue reports</p>
                    <h2>Sales and billing performance</h2>
                  </div>
                  <span className="pill pill-online">{reports?.revenue.topPaymentMethod ?? 'Cash'}</span>
                </div>
                <div className="list">
                  <div className="list-item">
                    <div>
                      <strong>Total revenue</strong>
                      <span>Gross billed amount</span>
                    </div>
                    <div className="right">
                      <strong>{reports ? money.format(reports.revenue.totalRevenue) : '...'}</strong>
                      <span>{reports?.revenue.saleCount ?? 0} sales</span>
                    </div>
                  </div>
                  <div className="list-item">
                    <div>
                      <strong>Total tax</strong>
                      <span>Collected tax</span>
                    </div>
                    <div className="right">
                      <strong>{reports ? money.format(reports.revenue.totalTax) : '...'}</strong>
                      <span>Across bills</span>
                    </div>
                  </div>
                  <div className="list-item">
                    <div>
                      <strong>Total discounts</strong>
                      <span>Applied reductions</span>
                    </div>
                    <div className="right">
                      <strong>{reports ? money.format(reports.revenue.totalDiscount) : '...'}</strong>
                      <span>Across bills</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Customer reports</p>
                    <h2>Customer activity</h2>
                  </div>
                </div>
                <div className="list">
                  <div className="list-item">
                    <div>
                      <strong>New this month</strong>
                      <span>Fresh profiles created</span>
                    </div>
                    <div className="right">
                      <strong>{reports?.customers.newCustomersThisMonth ?? 0}</strong>
                      <span>customers</span>
                    </div>
                  </div>
                  {reports?.customers.topCustomers.slice(0, 5).map((customer) => (
                    <div className="list-item" key={customer.id}>
                      <div>
                        <strong>{customer.name}</strong>
                        <span>
                          {customer.visitsCount} visits · {customer.loyaltyPoints} points
                        </span>
                      </div>
                      <div className="right">
                        <strong>{money.format(customer.totalSpent)}</strong>
                        <span>{customer.lastVisitAt ? new Date(customer.lastVisitAt).toLocaleDateString() : 'No visit'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Visit reports</p>
                    <h2>Services and attendance</h2>
                  </div>
                </div>
                <div className="list">
                  <div className="list-item">
                    <div>
                      <strong>Total visits</strong>
                      <span>All recorded sessions</span>
                    </div>
                    <div className="right">
                      <strong>{reports?.visits.totalVisits ?? '...'}</strong>
                      <span>{reports?.visits.saleVisits ?? 0} from sales</span>
                    </div>
                  </div>
                  {reports?.visits.topServices.slice(0, 5).map((service) => (
                    <div className="list-item" key={service.serviceName}>
                      <div>
                        <strong>{service.serviceName}</strong>
                        <span>{service.visitCount} visits</span>
                      </div>
                      <div className="right">
                        <strong>{money.format(service.totalAmount)}</strong>
                        <span>collected</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Loyalty reports</p>
                    <h2>Points movement</h2>
                  </div>
                </div>
                <div className="list">
                  <div className="list-item">
                    <div>
                      <strong>Points earned</strong>
                      <span>From completed visits</span>
                    </div>
                    <div className="right">
                      <strong>{reports?.loyalty.totalEarned ?? 0}</strong>
                      <span>earned</span>
                    </div>
                  </div>
                  <div className="list-item">
                    <div>
                      <strong>Points redeemed</strong>
                      <span>Used by customers</span>
                    </div>
                    <div className="right">
                      <strong>{reports?.loyalty.totalRedeemed ?? 0}</strong>
                      <span>redeemed</span>
                    </div>
                  </div>
                  {reports?.loyalty.topBalances.slice(0, 5).map((customer) => (
                    <div className="list-item" key={customer.id}>
                      <div>
                        <strong>{customer.name}</strong>
                        <span>
                          {customer.earned} earned · {customer.redeemed} redeemed
                        </span>
                      </div>
                      <div className="right">
                        <strong>{customer.balance}</strong>
                        <span>balance</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : view === 'services' ? (
          <section className="inventory-view">
            <div className="panel">
              <div className="inventory-head">
                <div>
                  <p className="eyebrow">Treatment catalog</p>
                  <h2>Service / package management</h2>
                </div>
                <span className="pill pill-offline">{services.length} active services</span>
              </div>

              <form className="new-item-form" onSubmit={createNewService}>
                <div className="form-head">
                  <div>
                    <p className="eyebrow">Add service</p>
                    <h3>New package</h3>
                  </div>
                  <span className={`pill ${newServiceStatus === 'saved' ? 'pill-online' : 'pill-offline'}`}>
                    {newServiceStatus === 'saved' ? 'Saved' : 'Local only'}
                  </span>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Code</span>
                    <input
                      className="field"
                      value={newService.code}
                      onChange={(event) => setNewService((current) => ({ ...current, code: event.target.value }))}
                      placeholder="FAC-1001"
                      required
                    />
                  </label>
                  <label>
                    <span>Name</span>
                    <input
                      className="field"
                      value={newService.name}
                      onChange={(event) => setNewService((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Deep Cleansing Facial"
                      required
                    />
                  </label>
                  <label className="full-width">
                    <span>Description</span>
                    <input
                      className="field"
                      value={newService.description}
                      onChange={(event) =>
                        setNewService((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Hydrating facial treatment with a full cleanse and mask"
                      required
                    />
                  </label>
                  <label>
                    <span>Price</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newService.price}
                      onChange={(event) => setNewService((current) => ({ ...current, price: event.target.value }))}
                      required
                    />
                  </label>
                </div>

                <div className="form-footer">
                  <button className="primary-button" type="submit" disabled={newServiceStatus === 'saving'}>
                    {newServiceStatus === 'saving' ? 'Saving...' : 'Add service'}
                  </button>
                  <div className="form-message">
                    {newServiceError ? (
                      <span className="error-text">{newServiceError}</span>
                    ) : newServiceStatus === 'saved' ? (
                      <span className="success-text">Service added to the catalog.</span>
                    ) : (
                      <span className="muted">These services can be selected from the visit form.</span>
                    )}
                  </div>
                </div>
              </form>

              <div className="inventory-section">
                <div className="inventory-section-head">
                  <h3>Active services</h3>
                  <span className="muted">{services.length} showing</span>
                </div>
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <colgroup>
                      <col className="inventory-col-service" />
                      <col className="inventory-col-stock" />
                      <col className="inventory-col-price" />
                      <col className="inventory-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Code</th>
                        <th>Price</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => (
                        <tr key={service.id}>
                          <td>
                            <div className="inventory-name-cell">
                              <strong>{service.name}</strong>
                              <span>Package treatment</span>
                            </div>
                          </td>
                          <td className="inventory-cell-number">
                            <strong>{service.code}</strong>
                          </td>
                          <td className="inventory-cell-number">{money.format(service.price)}</td>
                          <td>
                            <span className="muted">{service.description}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        ) : view === 'settings' ? (
          <section className="dashboard-view">
            <div className="dashboard-hero">
              <div>
                <p className="eyebrow">Settings</p>
                <h3>Keep the salon profile and loyalty rules in sync.</h3>
                <p className="muted">
                  Update the business details shown on receipts, tune point earning and redemption, and maintain local backups.
                </p>
              </div>
              <div className="dashboard-hero-actions">
                <button className="ghost-button" onClick={() => void backupDatabase()} disabled={backupStatus === 'saving'}>
                  {backupStatus === 'saving' ? 'Backing up...' : 'Backup database'}
                </button>
                <button className="ghost-button" onClick={() => void restoreDatabase()} disabled={restoreStatus === 'saving'}>
                  {restoreStatus === 'saving' ? 'Restoring...' : 'Restore database'}
                </button>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Salon information</p>
                    <h2>Receipt and brand details</h2>
                  </div>
                  <span className={`pill ${settingsStatus === 'saved' ? 'pill-online' : 'pill-offline'}`}>
                    {settingsStatus === 'saved' ? 'Saved' : 'Local only'}
                  </span>
                </div>

                <form className="new-item-form" onSubmit={saveSalonSettings}>
                  <div className="form-grid">
                    <label>
                      <span>Salon name</span>
                      <input
                        className="field"
                        value={salonForm.name}
                        onChange={(event) => setSalonForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Luxe Salon"
                        required
                      />
                    </label>
                    <label>
                      <span>Tagline</span>
                      <input
                        className="field"
                        value={salonForm.tagline}
                        onChange={(event) => setSalonForm((current) => ({ ...current, tagline: event.target.value }))}
                        placeholder="Front Counter"
                        required
                      />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input
                        className="field"
                        value={salonForm.phone}
                        onChange={(event) => setSalonForm((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="0300-1234567"
                        required
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        className="field"
                        value={salonForm.email}
                        onChange={(event) => setSalonForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="hello@salon.com"
                      />
                    </label>
                    <label className="full-width">
                      <span>Address</span>
                      <input
                        className="field"
                        value={salonForm.address}
                        onChange={(event) => setSalonForm((current) => ({ ...current, address: event.target.value }))}
                        placeholder="Shop 12, Main Boulevard"
                        required
                      />
                    </label>
                  </div>

                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={settingsStatus === 'saving'}>
                      {settingsStatus === 'saving' ? 'Saving...' : 'Save salon info'}
                    </button>
                    <div className="form-message">
                      {settingsError ? (
                        <span className="error-text">{settingsError}</span>
                      ) : settingsStatus === 'saved' ? (
                        <span className="success-text">Salon information updated.</span>
                      ) : (
                        <span className="muted">These details appear on printed receipts.</span>
                      )}
                    </div>
                  </div>
                </form>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Loyalty rules</p>
                    <h2>Points configuration</h2>
                  </div>
                  <span className={`pill ${settingsStatus === 'saved' ? 'pill-online' : 'pill-offline'}`}>
                    {settingsStatus === 'saved' ? 'Saved' : 'Local only'}
                  </span>
                </div>

                <form className="new-item-form" onSubmit={saveLoyaltySettings}>
                  <div className="form-grid">
                    <label>
                      <span>Points per 100 currency</span>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="1"
                        value={loyaltyForm.pointsPer100Currency}
                        onChange={(event) =>
                          setLoyaltyForm((current) => ({ ...current, pointsPer100Currency: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Redemption value per point</span>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="0.01"
                        value={loyaltyForm.redemptionValuePerPoint}
                        onChange={(event) =>
                          setLoyaltyForm((current) => ({ ...current, redemptionValuePerPoint: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Minimum redeem points</span>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="1"
                        value={loyaltyForm.minimumRedeemPoints}
                        onChange={(event) =>
                          setLoyaltyForm((current) => ({ ...current, minimumRedeemPoints: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={settingsStatus === 'saving'}>
                      {settingsStatus === 'saving' ? 'Saving...' : 'Save loyalty rules'}
                    </button>
                    <div className="form-message">
                      <span className="muted">
                        Earn is calculated per 100 currency spent. Redemption respects the minimum threshold.
                      </span>
                    </div>
                  </div>
                </form>
              </section>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Database maintenance</p>
                    <h2>Backup and restore</h2>
                  </div>
                </div>
                <div className="list">
                  <div className="list-item">
                    <div>
                      <strong>Backup database</strong>
                      <span>Create a local SQLite copy before major changes.</span>
                    </div>
                    <div className="right">
                      <button className="ghost-button" onClick={() => void backupDatabase()} disabled={backupStatus === 'saving'}>
                        {backupStatus === 'saving' ? 'Backing up...' : 'Backup'}
                      </button>
                      {backupMessage ? <span className="muted">{backupMessage}</span> : null}
                    </div>
                  </div>
                  <div className="list-item">
                    <div>
                      <strong>Restore database</strong>
                      <span>Replace the current data with a saved SQLite backup.</span>
                    </div>
                    <div className="right">
                      <button className="danger-button" onClick={() => void restoreDatabase()} disabled={restoreStatus === 'saving'}>
                        {restoreStatus === 'saving' ? 'Restoring...' : 'Restore'}
                      </button>
                      {restoreMessage ? <span className="muted">{restoreMessage}</span> : null}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section className="inventory-view">
            <div className="panel">
              <div className="inventory-head">
                <div>
                  <p className="eyebrow">Stock room</p>
                  <h2>Inventory control</h2>
                </div>
                <span className="pill pill-offline">{activeInventory.length} active items</span>
              </div>

              <form className="new-item-form" onSubmit={createNewItem}>
                <div className="form-head">
                  <div>
                    <p className="eyebrow">Add item</p>
                    <h3>New product</h3>
                  </div>
                  <span className={`pill ${newItemStatus === 'saved' ? 'pill-online' : 'pill-offline'}`}>
                    {newItemStatus === 'saved' ? 'Saved' : 'Local only'}
                  </span>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Product name</span>
                    <input
                      className="field"
                      value={newItem.name}
                      onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Deep Cleansing Facial"
                      required
                    />
                  </label>
                  <label>
                    <span>Category</span>
                    <input
                      className="field"
                      value={newItem.category}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, category: event.target.value }))
                      }
                      placeholder="Facials"
                      required
                    />
                  </label>
                  <label>
                    <span>SKU</span>
                    <input
                      className="field"
                      value={newItem.sku}
                      onChange={(event) => setNewItem((current) => ({ ...current, sku: event.target.value }))}
                      placeholder="FAC-1001"
                      required
                    />
                  </label>
                  <label>
                    <span>Barcode</span>
                    <input
                      className="field"
                      value={newItem.barcode}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, barcode: event.target.value }))
                      }
                      placeholder="SRV-1000001"
                      required
                    />
                  </label>
                  <label>
                    <span>Price</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.price}
                      onChange={(event) => setNewItem((current) => ({ ...current, price: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    <span>Starting stock</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="1"
                      value={newItem.stock}
                      onChange={(event) => setNewItem((current) => ({ ...current, stock: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    <span>Tax rate</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.taxRate}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, taxRate: event.target.value }))
                      }
                      required
                    />
                  </label>
                </div>

                <div className="form-footer">
                  <button className="primary-button" type="submit" disabled={newItemStatus === 'saving'}>
                    {newItemStatus === 'saving' ? 'Saving...' : 'Add item'}
                  </button>
                  <div className="form-message">
                    {newItemError ? (
                      <span className="error-text">{newItemError}</span>
                    ) : newItemStatus === 'saved' ? (
                      <span className="success-text">Item added to local inventory.</span>
                    ) : (
                      <span className="muted">This saves locally in SQLite.</span>
                    )}
                  </div>
                </div>
              </form>

              <div className="inventory-section">
                <div className="inventory-section-head">
                  <h3>Active items</h3>
                  <span className="muted">{activeInventory.length} showing</span>
                </div>
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <colgroup>
                      <col className="inventory-col-service" />
                      <col className="inventory-col-stock" />
                      <col className="inventory-col-price" />
                      <col className="inventory-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Stock</th>
                        <th>Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeInventory.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="inventory-name-cell">
                              <strong>{item.name}</strong>
                              <span>
                                {item.category} · {item.sku} · {item.barcode}
                              </span>
                            </div>
                          </td>
                          <td className="inventory-cell-number">
                            <strong>{item.stock}</strong>
                          </td>
                          <td className="inventory-cell-number">{money.format(item.price)}</td>
                          <td>
                            <div className="inventory-action-cell">
                              <div className="inventory-actions">
                                <button className="ghost-button ghost-button-small" onClick={() => adjustStock(item.id, -1)}>
                                  -1
                                </button>
                                <button className="ghost-button ghost-button-small" onClick={() => adjustStock(item.id, 1)}>
                                  +1
                                </button>
                                <button className="ghost-button ghost-button-small" onClick={() => adjustStock(item.id, 10)}>
                                  +10
                                </button>
                                <button className="danger-button danger-button-small" onClick={() => softDeleteItem(item.id, item.name)}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {deletedInventory.length > 0 ? (
                <div className="inventory-section inventory-section-muted">
                  <div className="inventory-section-head">
                    <div>
                      <h3>Deleted items</h3>
                      <span className="muted">{deletedInventory.length} hidden from POS</span>
                    </div>
                    <button
                      className="ghost-button ghost-button-small"
                      onClick={() => setShowDeletedItems((current) => !current)}
                    >
                      {showDeletedItems ? 'Hide deleted' : 'Show deleted'}
                    </button>
                  </div>
                  {showDeletedItems ? (
                    <>
                      <div className="inventory-table-head inventory-table-head-muted">
                        <span>Service</span>
                        <span>Stock</span>
                        <span>Rate</span>
                        <span>Action</span>
                      </div>
                    <div className="inventory-list">
                      {deletedInventory.map((item) => (
                        <div className="inventory-row inventory-row-deleted" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span className="deleted-pill">Deleted</span>
                            <span>
                              {item.category} · {item.sku} · {item.barcode}
                            </span>
                          </div>
                          <div className="inventory-meta">
                            <strong>{item.stock}</strong>
                            <span>{money.format(item.price)}</span>
                          </div>
                          <div className="inventory-action-cell">
                            <span className="inventory-action-label">Actions</span>
                            <div className="inventory-actions">
                              <button className="danger-button danger-button-small" onClick={() => hardDeleteItem(item.id, item.name)}>
                                Delete permanently
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        )}

        {customerModal ? (
          <div className="modal-backdrop" onClick={closeCustomerModal} role="presentation">
            <section className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <div className="dashboard-panel-head">
                <div>
                  <p className="eyebrow">
                    {customerModal === 'customer'
                      ? 'Add customer'
                      : customerModal === 'visit'
                        ? 'New visit'
                        : customerModal === 'edit'
                          ? 'Edit customer'
                          : 'Redeem loyalty'}
                  </p>
                  <h2>
                    {customerModal === 'customer'
                      ? 'Create a customer profile'
                      : customerModal === 'visit'
                        ? 'Log a salon visit'
                        : customerModal === 'edit'
                          ? customerProfile?.customer.name || 'Update customer'
                          : 'Spend loyalty points'}
                  </h2>
                </div>
                <button className="ghost-button ghost-button-small" type="button" onClick={closeCustomerModal}>
                  Close
                </button>
              </div>

              {customerModal === 'customer' ? (
                <form className="new-item-form" onSubmit={createNewCustomer}>
                  <div className="form-grid">
                    <label>
                      <span>Name</span>
                      <input
                        className="field"
                        placeholder="Ayesha Khan"
                        value={newCustomer.name}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input
                        className="field"
                        placeholder="0300-1234567"
                        value={newCustomer.phone}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label className="full-width">
                      <span>Email</span>
                      <input
                        className="field"
                        placeholder="client@example.com"
                        value={newCustomer.email}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label className="full-width">
                      <span>Notes</span>
                      <input
                        className="field"
                        placeholder="Preferred stylist, allergies, reminders"
                        value={newCustomer.notes}
                        onChange={(event) => setNewCustomer((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={newCustomerStatus === 'saving'}>
                      {newCustomerStatus === 'saving' ? 'Saving...' : 'Add customer'}
                    </button>
                    <div className="form-message">
                      {newCustomerError ? (
                        <span className="error-text">{newCustomerError}</span>
                      ) : newCustomerStatus === 'saved' ? (
                        <span className="success-text">Customer saved.</span>
                      ) : (
                        <span className="muted">Store local customer profiles.</span>
                      )}
                    </div>
                  </div>
                </form>
              ) : customerModal === 'visit' ? (
                <form className="new-item-form" onSubmit={createNewVisit}>
                  <div className="form-grid">
                    <label>
                      <span>Customer</span>
                      <input
                        className="field"
                        placeholder="Search customer name or phone"
                        value={customerSearch}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCustomerSearch(value);
                          setSelectedVisitCustomer(null);
                          setNewVisit((current) => ({ ...current, customerId: 'walk-in' }));
                        }}
                      />
                    </label>
                    <div className="customer-results full-width">
                      <button
                        type="button"
                        className={`customer-result ${newVisit.customerId === 'walk-in' ? 'customer-result-selected' : ''}`}
                        onClick={() => {
                          setNewVisit((current) => ({ ...current, customerId: 'walk-in' }));
                          setCustomerSearch('');
                          setCustomerMatches([]);
                          setSelectedVisitCustomer(null);
                        }}
                      >
                        <strong>Walk-in</strong>
                        <span>Use when the customer is not in the system yet.</span>
                      </button>
                      {customerSearchStatus === 'loading' ? <span className="muted">Searching customers...</span> : null}
                      {customerMatches.map((customer) => (
                        <button
                          type="button"
                          key={customer.id}
                          className={`customer-result ${newVisit.customerId === customer.id ? 'customer-result-selected' : ''}`}
                          onClick={() => {
                            setNewVisit((current) => ({ ...current, customerId: customer.id }));
                            setCustomerSearch(customer.name);
                            setCustomerMatches([]);
                            setSelectedVisitCustomer(customer);
                          }}
                        >
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.phone || 'No phone'}
                            {customer.visitsCount ? ` · ${customer.visitsCount} visits` : ''}
                          </span>
                        </button>
                      ))}
                      {customerSearch && customerSearchStatus === 'idle' && customerMatches.length === 0 ? (
                        <span className="muted">No matching customers found.</span>
                      ) : null}
                    </div>
                    <label className="full-width">
                      <span>Service / package</span>
                      <select
                        className="field"
                        value={newVisit.serviceId}
                        onChange={(event) => {
                          const service = services.find((item) => item.id === event.target.value) ?? null;
                          setNewVisit((current) => ({
                            ...current,
                            serviceId: service?.id ?? '',
                            serviceName: service?.name ?? '',
                            amount: service ? service.price.toFixed(2) : current.amount,
                            manualAmount: false,
                          }));
                        }}
                        required
                      >
                        <option value="" disabled>
                          Select a service package
                        </option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.code} · {service.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedService ? (
                      <div className="customer-results full-width">
                        <div className="customer-result customer-result-selected">
                          <div>
                            <strong>{selectedService.name}</strong>
                            <span>
                              {selectedService.code} · {selectedService.description}
                            </span>
                          </div>
                          <div className="right">
                            <strong>{money.format(selectedService.price)}</strong>
                            <span>default price</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="muted">Choose a service package to auto-calculate the amount.</span>
                    )}
                    <label className="checkbox-row full-width">
                      <input
                        type="checkbox"
                        checked={newVisit.manualAmount}
                        onChange={(event) =>
                          setNewVisit((current) => ({
                            ...current,
                            manualAmount: event.target.checked,
                            amount: event.target.checked
                              ? current.amount
                              : selectedService
                                ? selectedService.price.toFixed(2)
                                : current.amount,
                          }))
                        }
                        disabled={!selectedService}
                      />
                      <span>Manual price override</span>
                    </label>
                    <label>
                      <span>Amount</span>
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="1500"
                        value={newVisit.manualAmount && selectedService ? newVisit.amount : selectedService?.price.toFixed(2) ?? newVisit.amount}
                        onChange={(event) =>
                          setNewVisit((current) => ({ ...current, amount: event.target.value, manualAmount: true }))
                        }
                        required
                        readOnly={Boolean(selectedService) && !newVisit.manualAmount}
                      />
                    </label>
                    <label className="full-width">
                      <span>Notes</span>
                      <input
                        className="field"
                        placeholder="Preferred stylist, follow-up, etc."
                        value={newVisit.notes}
                        onChange={(event) => setNewVisit((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={newVisitStatus === 'saving'}>
                      {newVisitStatus === 'saving' ? 'Saving...' : 'New visit'}
                    </button>
                    <div className="form-message">
                      {newVisitError ? (
                        <span className="error-text">{newVisitError}</span>
                      ) : newVisitStatus === 'saved' ? (
                        <span className="success-text">Visit logged.</span>
                      ) : (
                        <span className="muted">Earn loyalty points on paid visits.</span>
                      )}
                    </div>
                  </div>
                </form>
              ) : customerModal === 'edit' ? (
                <form className="new-item-form" onSubmit={saveCustomer}>
                  <div className="form-grid">
                    <label>
                      <span>Name</span>
                      <input
                        className="field"
                        placeholder="Ayesha Khan"
                        value={customerForm.name}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Phone number</span>
                      <input
                        className="field"
                        placeholder="0300-1234567"
                        value={customerForm.phone}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        className="field"
                        placeholder="client@example.com"
                        value={customerForm.email}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Notes</span>
                      <input
                        className="field"
                        placeholder="Preferred stylist, allergies, reminders"
                        value={customerForm.notes}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={customerFormStatus === 'saving'}>
                      {customerFormStatus === 'saving' ? 'Saving...' : 'Save changes'}
                    </button>
                    <div className="form-message">
                      {customerFormError ? (
                        <span className="error-text">{customerFormError}</span>
                      ) : customerFormStatus === 'saved' ? (
                        <span className="success-text">Customer saved.</span>
                      ) : (
                        <span className="muted">Update profile details and notes.</span>
                      )}
                    </div>
                  </div>
                </form>
              ) : (
                <form
                  className="new-item-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void redeemCustomerPoints();
                  }}
                >
                  <div className="form-grid">
                    <label>
                      <span>Points to redeem</span>
                      <input
                        className="field"
                        type="number"
                        min="1"
                        step="1"
                        value={redeemPoints}
                        onChange={(event) => setRedeemPoints(event.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={redeemStatus === 'saving'}>
                      {redeemStatus === 'saving' ? 'Saving...' : 'Redeem points'}
                    </button>
                    <div className="form-message">
                      {redeemError ? (
                        <span className="error-text">{redeemError}</span>
                      ) : redeemStatus === 'saved' ? (
                        <span className="success-text">Points redeemed.</span>
                      ) : (
                        <span className="muted">Subtracts from the customer balance and logs the transaction.</span>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
