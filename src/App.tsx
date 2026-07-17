import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Product, ServicePackage } from '../electron/schema';

type CartLine = {
  id: string;
  type: 'product' | 'service';
  itemId: string | null;
  name: string;
  price: number;
  qty: number;
  taxRate: number;
};
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
type ViewMode = 'dashboard' | 'customers' | 'checkout' | 'inventory' | 'services' | 'reports' | 'settings';
type SaleResult = {
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
  createdAt: string;
  itemCount: number;
  originType: string | null;
  originId: string | null;
  detailedItems: Array<{
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
    recentSales: Array<{
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
    currencyPerPoint: number;
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

// Loyalty conversion (mirrors backend): 15 PKR of service = 1 point,
// and 1 point is worth 15 PKR of service value when redeeming.
const PKR_PER_POINT = 15;

type PickerOption = { id: string; name: string; price: number; meta?: string };

// Searchable dropdown: type to filter or scroll the list, click to pick.
function SearchSelect({
  label,
  placeholder,
  options,
  emptyText,
  onPick,
}: {
  label: string;
  placeholder: string;
  options: PickerOption[];
  emptyText: string;
  onPick: (id: string) => void;
}) {
  const [queryText, setQueryText] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => `${option.name} ${option.meta ?? ''}`.toLowerCase().includes(q));
  }, [options, queryText]);

  return (
    <div className="search-select">
      <label>
        <span>{label}</span>
        <input
          className="field"
          placeholder={placeholder}
          value={queryText}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQueryText(event.target.value);
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
      </label>
      {open ? (
        <div className="search-select-list">
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                type="button"
                className="search-select-item"
                key={option.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(option.id);
                  setQueryText('');
                  setOpen(false);
                }}
              >
                <span>
                  {option.name}
                  {option.meta ? <span className="muted"> · {option.meta}</span> : null}
                </span>
                <strong>{money.format(option.price)}</strong>
              </button>
            ))
          ) : (
            <span className="muted search-select-empty">{emptyText}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceInventory, setServiceInventory] = useState<ServiceRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [recentSales, setRecentSales] = useState<Array<any>>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<ReportSnapshot | null>(null);
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [recentBills, setRecentBills] = useState<Array<VisitRow>>([]);
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
  const [billCart, setBillCart] = useState<Array<ServiceRow & { quantity: number }>>([]);
  const [status, setStatus] = useState<'ready' | 'saved'>('ready');
  const [view, setView] = useState<ViewMode>('dashboard');
  const [checkoutCustomerQuery, setCheckoutCustomerQuery] = useState('');
  const [checkoutCustomerMatches, setCheckoutCustomerMatches] = useState<CustomerRow[]>([]);
  const [checkoutCustomerSearchStatus, setCheckoutCustomerSearchStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedCheckoutCustomer, setSelectedCheckoutCustomer] = useState<CustomerRow | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('Cash');
  const [checkoutDiscount, setCheckoutDiscount] = useState('0.00');
  const [checkoutDiscountType, setCheckoutDiscountType] = useState<'pkr' | 'percent'>('pkr');
  const [checkoutStatus, setCheckoutStatus] = useState<'ready' | 'saved'>('ready');
  const [checkoutCustomerOpen, setCheckoutCustomerOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<SaleResult | null>(null);
  const [newItem, setNewItem] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: '',
    price: '0.00',
    stock: '0',
    taxRate: '0.08',
    redeemPoints: '0',
  });
  const [newItemStatus, setNewItemStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newItemError, setNewItemError] = useState('');
  const [newService, setNewService] = useState({
    code: '',
    name: '',
    description: '',
    price: '0.00',
    redeemPoints: '0',
  });
  const [newServiceStatus, setNewServiceStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newServiceError, setNewServiceError] = useState('');
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [showDeletedServices, setShowDeletedServices] = useState(false);
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
  const [billCustomerQuery, setBillCustomerQuery] = useState('');
  const [billCustomerMatches, setBillCustomerMatches] = useState<CustomerRow[]>([]);
  const [billCustomerSearchStatus, setBillCustomerSearchStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedBillCustomer, setSelectedBillCustomer] = useState<CustomerRow | null>(null);
  const [selectedBillServices, setSelectedBillServices] = useState<ServiceRow[]>([]);
  const [billNotes, setBillNotes] = useState('');
  const [billStatus, setBillStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [billError, setBillError] = useState('');
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
    currencyPerPoint: '15',
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
  const [customerModal, setCustomerModal] = useState<'customer' | 'visit' | 'edit' | 'redeem' | 'bill' | 'ledger' | null>(null);
  const scanBuffer = useRef('');
  const scanTimer = useRef<number | null>(null);
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { key: 'customers', label: 'Customers', icon: <CustomersIcon /> },
    { key: 'checkout', label: 'Checkout', icon: <BillingIcon /> },
    { key: 'services', label: 'Services', icon: <ServicesIcon /> },
    { key: 'reports', label: 'Reports', icon: <ReportsIcon /> },
    { key: 'inventory', label: 'Inventory', icon: <InventoryIcon /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ] as const;
  const selectedService = useMemo(
    () => services.find((service) => service.id === newVisit.serviceId) ?? null,
    [newVisit.serviceId, services]
  );
  const selectedBillServiceIds = useMemo(
    () => new Set(selectedBillServices.map((service) => service.id)),
    [selectedBillServices]
  );
  const selectedBillTotal = useMemo(
    () => selectedBillServices.reduce((total, service) => total + service.price, 0),
    [selectedBillServices]
  );

  const refreshSettings = async () => {
    const next = await window.pos.getSettings();
    setSettings(next);
    setSalonForm(next.salonInfo);
    setLoyaltyForm({
      currencyPerPoint: String(next.loyaltyRules.currencyPerPoint),
      minimumRedeemPoints: String(next.loyaltyRules.minimumRedeemPoints),
    });
  };

  useEffect(() => {
    const load = async () => {
      const [dash, reportData, settingsData, list, serviceList, allServiceList, sales, bills, sync, stock] =
        await Promise.all([
          window.pos.getDashboard(),
          window.pos.getReports(),
          window.pos.getSettings(),
          window.pos.listProducts(),
          window.pos.listServices(),
          window.pos.listAllServices(),
          window.pos.getRecentSales(),
          window.pos.getRecentBills(),
          window.pos.getSyncStatus(),
          window.pos.listInventory(),
        ]);
      setDashboard(dash);
      setReports(reportData);
      setSettings(settingsData);
      setSalonForm(settingsData.salonInfo);
      setLoyaltyForm({
        currencyPerPoint: String(settingsData.loyaltyRules.currencyPerPoint),
        minimumRedeemPoints: String(settingsData.loyaltyRules.minimumRedeemPoints),
      });
      setProducts(list);
      setServices(serviceList);
      setServiceInventory(allServiceList);
      setRecentSales(sales);
      setRecentBills(bills);
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
      if (view !== 'checkout') return;
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
    if (view === 'checkout') return;
    scanBuffer.current = '';
    if (scanTimer.current) {
      window.clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
  }, [view]);

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
    if (view !== 'checkout') return;

    let active = true;
    setCheckoutCustomerSearchStatus('loading');

    const timer = window.setTimeout(async () => {
      try {
        const matches = await window.pos.findCustomers({
          query: checkoutCustomerQuery,
          limit: 8,
        });
        if (!active) return;
        setCheckoutCustomerMatches(matches);
      } catch {
        if (!active) return;
        setCheckoutCustomerMatches([]);
      } finally {
        if (active) setCheckoutCustomerSearchStatus('idle');
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkoutCustomerQuery, view]);

  useEffect(() => {
    if (customerModal !== 'bill') return;

    let active = true;
    setBillCustomerSearchStatus('loading');

    const timer = window.setTimeout(async () => {
      try {
        const matches = await window.pos.findCustomers({
          query: billCustomerQuery,
          limit: 8,
        });
        if (!active) return;
        setBillCustomerMatches(matches);
      } catch {
        if (!active) return;
        setBillCustomerMatches([]);
      } finally {
        if (active) setBillCustomerSearchStatus('idle');
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [billCustomerQuery, customerModal, view]);

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
  const activeServices = useMemo(
    () => serviceInventory.filter((item) => item.isActive === 1),
    [serviceInventory]
  );
  const deletedServices = useMemo(
    () => serviceInventory.filter((item) => item.isActive === 0),
    [serviceInventory]
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = cart.reduce((sum, item) => sum + item.price * item.qty * item.taxRate, 0);
  const discountInput = Number(checkoutDiscount) || 0;
  const discount =
    checkoutDiscountType === 'percent'
      ? Math.min(subtotal, (subtotal * Math.max(0, Math.min(100, discountInput))) / 100)
      : Math.min(subtotal + tax, Math.max(0, discountInput));
  const total = Math.max(0, subtotal + tax - discount);
  // Points preview: services only, using the configurable earning rate.
  const currencyPerPoint = settings?.loyaltyRules.currencyPerPoint || PKR_PER_POINT;
  const serviceSubtotal = cart
    .filter((item) => item.type === 'service')
    .reduce((sum, item) => sum + item.price * item.qty, 0);
  const pointsToEarn = Math.floor(serviceSubtotal / currencyPerPoint);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...current,
        {
          id: product.id,
          type: 'product',
          itemId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          taxRate: product.taxRate,
        },
      ];
    });
    setCheckoutStatus('ready');
  };

  const increaseCartItem = (productId: string) => {
    setCart((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, qty: item.qty + 1 } : item
      )
    );
    setCheckoutStatus('ready');
  };

  const decreaseCartItem = (productId: string) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    );
    setCheckoutStatus('ready');
  };

  const removeCartItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.id !== productId));
    setCheckoutStatus('ready');
  };

  const clearCart = () => {
    setCart([]);
    setCheckoutStatus('ready');
  };

  const addServiceToCart = (service: ServiceRow) => {
    setCart((current) => {
      const found = current.find((item) => item.type === 'service' && item.itemId === service.id);
      if (found) {
        return current.map((item) =>
          item.type === 'service' && item.itemId === service.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...current,
        {
          id: `service-${service.id}`,
          type: 'service',
          itemId: service.id,
          name: service.name,
          price: service.price,
          qty: 1,
          taxRate: 0,
        },
      ];
    });
    setCheckoutStatus('ready');
  };

  const updateCheckoutCustomer = (customer: CustomerRow | null) => {
    setSelectedCheckoutCustomer(customer);
    setCheckoutCustomerQuery(customer?.name ?? '');
  };

  const clearCheckout = () => {
    clearCart();
    updateCheckoutCustomer(null);
    setCheckoutDiscount('0.00');
    setCheckoutPaymentMethod('Cash');
  };

  const refreshData = async () => {
    const [dash, reportData, settingsData, list, serviceList, allServiceList, transactions, bills, sync, stock] =
      await Promise.all([
        window.pos.getDashboard(),
        window.pos.getReports(),
        window.pos.getSettings(),
        window.pos.listProducts(),
        window.pos.listServices(),
        window.pos.listAllServices(),
        window.pos.getRecentTransactions({ limit: 12 }),
        window.pos.getRecentBills(),
        window.pos.getSyncStatus(),
        window.pos.listInventory(),
      ]);
    setDashboard(dash);
    setReports(reportData);
    setSettings(settingsData);
    setSalonForm(settingsData.salonInfo);
    setLoyaltyForm({
      currencyPerPoint: String(settingsData.loyaltyRules.currencyPerPoint),
      minimumRedeemPoints: String(settingsData.loyaltyRules.minimumRedeemPoints),
    });
    setProducts(list);
    setServices(serviceList);
    setServiceInventory(allServiceList);
    setRecentSales(transactions);
    setRecentBills(bills);
    setSyncStatus(sync);
    setInventory(stock);
  };

  const submitCheckout = async () => {
    if (cart.length === 0) return;
    const result = (await window.pos.createTransaction({
      cashierName: CASHIER_NAME,
      paymentMethod: checkoutPaymentMethod,
      discountTotal: discount,
      customerId: selectedCheckoutCustomer?.id ?? null,
      customerName: selectedCheckoutCustomer?.name ?? 'Walk-in',
      items: cart.map((item) => ({
        type: item.type,
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        qty: item.qty,
        taxRate: item.taxRate,
      })),
    })) as SaleResult;
    clearCheckout();
    setCheckoutStatus('saved');
    // Show an on-screen receipt preview; the user prints from there.
    setReceiptPreview(result);
    await refreshData();
  };

  const printCurrentReceipt = async () => {
    if (!receiptPreview) return;
    await window.pos.printReceipt({
      ...receiptPreview,
      pointsEarned: receiptPreview.loyaltyPointsEarned,
      detailedItems: receiptPreview.detailedItems.map((item) => ({
        itemType: item.itemType,
        name: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        lineTotal: item.lineTotal,
      })),
    });
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

  const restoreItem = async (productId: string) => {
    await window.pos.restoreProduct({ productId });
    await refreshData();
  };

  const softDeleteService = async (serviceId: string, serviceName: string) => {
    const confirmed = window.confirm(
      `Delete ${serviceName}? It will be marked as deleted and hidden from the POS.`
    );
    if (!confirmed) return;
    await window.pos.deleteService({ serviceId });
    await refreshData();
  };

  const restoreServiceItem = async (serviceId: string) => {
    await window.pos.restoreService({ serviceId });
    await refreshData();
  };

  const hardDeleteService = async (serviceId: string, serviceName: string) => {
    const confirmed = window.confirm(`Permanently delete ${serviceName}? This cannot be undone.`);
    if (!confirmed) return;
    await window.pos.deleteServicePermanently({ serviceId });
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
        redeemPoints: Number(newItem.redeemPoints) || 0,
      });
      setNewItem({
        sku: '',
        barcode: '',
        name: '',
        category: '',
        price: '0.00',
        stock: '0',
        taxRate: '0.08',
        redeemPoints: '0',
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
        redeemPoints: Number(newService.redeemPoints) || 0,
      });
      setNewService({
        code: '',
        name: '',
        description: '',
        price: '0.00',
        redeemPoints: '0',
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
        currencyPerPoint: Number(loyaltyForm.currencyPerPoint),
        minimumRedeemPoints: Number(loyaltyForm.minimumRedeemPoints),
      });
      setLoyaltyForm({
        currencyPerPoint: String(next.currencyPerPoint),
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
      setRestoreMessage(
        `Restored ${result.rowsRestored ?? 0} rows across ${result.tablesRestored ?? 0} tables from the backup.`
      );
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

  const openBillModal = () => {
    setBillCustomerQuery('');
    setBillCustomerMatches([]);
    setBillCustomerSearchStatus('idle');
    setSelectedBillCustomer(null);
    setSelectedBillServices([]);
    setBillNotes('');
    setBillStatus('idle');
    setBillError('');
    setCustomerModal('bill');
  };

  const chooseBillCustomer = (customer: CustomerRow) => {
    setSelectedBillCustomer(customer);
    setBillCustomerQuery(customer.name);
    setBillCustomerMatches([]);
    setBillCustomerSearchStatus('idle');
  };

  const chooseBillService = (service: ServiceRow) => {
    setSelectedBillServices((current) =>
      current.some((item) => item.id === service.id)
        ? current.filter((item) => item.id !== service.id)
        : [...current, service]
    );
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

  const openLedgerModal = () => {
    if (!customerProfile || !selectedCustomerId) return;
    setCustomerModal('ledger');
  };

  const createNewBill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBillStatus('saving');
    setBillError('');

    try {
      if (!selectedBillCustomer) {
        throw new Error('Please select a customer');
      }
      if (selectedBillServices.length === 0) {
        throw new Error('Please select at least one service');
      }

      const result = await window.pos.createBill({
        customerId: selectedBillCustomer.id,
        customerName: selectedBillCustomer.name,
        services: selectedBillServices.map((service) => ({
          serviceId: service.id,
          serviceCode: service.code,
          serviceName: service.name,
          price: service.price,
        })),
        notes: billNotes || undefined,
      });

      setBillStatus('saved');
      setBillCustomerQuery('');
      setBillCustomerMatches([]);
      setBillCustomerSearchStatus('idle');
      setSelectedBillCustomer(null);
      setSelectedBillServices([]);
      setBillNotes('');
      setCustomerModal(null);
      await refreshData();
      alert(
        `Bill created for ${result.customerName} - ${result.serviceName} (${money.format(result.amount)})`
      );
    } catch (error) {
      setBillStatus('error');
      setBillError(error instanceof Error ? error.message : 'Could not create bill');
    }
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

  const redeemService = async (service: ServiceRow) => {
    if (!selectedCustomerId || !customerProfile) return;

    const confirmed = window.confirm(
      `Redeem "${service.name}" for ${service.redeemPoints} points from ${customerProfile.customer.name}?`
    );
    if (!confirmed) return;

    setRedeemStatus('saving');
    setRedeemError('');

    try {
      const result = await window.pos.redeemCustomerPoints({
        customerId: selectedCustomerId,
        points: service.redeemPoints,
        notes: `Redeemed "${service.name}"`,
      });
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
            }
          : current
      );
      await refreshData();
    } catch (error) {
      setRedeemStatus('error');
      alert(error instanceof Error ? error.message : 'Could not redeem points');
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
                    : view === 'checkout'
                      ? 'Checkout desk'
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
                  : view === 'checkout'
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
                <button className="ghost-button" onClick={() => setView('checkout')}>
                  New Transaction
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
                <small>Customer visits logged today</small>
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
                    onClick={() => setView('checkout')}
                  >
                    <h3>New Transaction</h3>
                    <span>Open the unified checkout screen.</span>
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
                      <small>From services ({currencyPerPoint} PKR = 1 pt)</small>
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

                  <div className="customer-profile-grid customer-profile-grid-single">
                    <section className="customer-profile-card">
                      <div className="inventory-section-head">
                        <div>
                          <h3>Service taken</h3>
                          <span className="muted">Services from the last visit</span>
                        </div>
                        {customerProfile.customer.lastVisitAt ? (
                          <span className="pill pill-online">
                            {new Date(customerProfile.customer.lastVisitAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="customer-summary-list">
                        {customerProfile.lastVisitServices.length > 0 ? (
                          customerProfile.lastVisitServices.map((service, index) => (
                            <div className="customer-summary-item" key={`${service.name}-${index}`}>
                              <div>
                                <strong>{service.name}</strong>
                                <span>
                                  {service.qty} x {money.format(service.price)}
                                </span>
                              </div>
                              <div className="right">
                                <strong>{money.format(service.lineTotal)}</strong>
                                <span>total</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="muted">No service taken on the last visit.</span>
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
                    <button className="ghost-button" onClick={openLedgerModal}>
                      Transaction history
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
        ) : view === 'checkout' ? (
          <section className="workspace checkout-workspace checkout-form-workspace">
            <div className="panel checkout-form-panel">
              <div className="dashboard-panel-head">
                <div>
                  <p className="eyebrow">New sale</p>
                  <h2>Build the bill</h2>
                </div>
                {cart.length > 0 ? (
                  <button className="ghost-button ghost-button-small" onClick={clearCheckout}>
                    Clear
                  </button>
                ) : null}
              </div>

              {/* Customer searchable dropdown */}
              <div className="search-select">
                <label>
                  <span>Customer</span>
                  <input
                    className="field"
                    placeholder="Search customer by name or phone"
                    value={checkoutCustomerQuery}
                    onFocus={() => setCheckoutCustomerOpen(true)}
                    onChange={(event) => {
                      setCheckoutCustomerQuery(event.target.value);
                      setSelectedCheckoutCustomer(null);
                      setCheckoutCustomerOpen(true);
                    }}
                    onBlur={() => window.setTimeout(() => setCheckoutCustomerOpen(false), 150)}
                  />
                </label>
                {checkoutCustomerOpen ? (
                  <div className="search-select-list">
                    {checkoutCustomerSearchStatus === 'loading' ? (
                      <span className="muted search-select-empty">Searching…</span>
                    ) : null}
                    {checkoutCustomerMatches.map((customer) => (
                      <button
                        type="button"
                        className="search-select-item"
                        key={customer.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          updateCheckoutCustomer(customer);
                          setCheckoutCustomerOpen(false);
                        }}
                      >
                        <span>
                          {customer.name}
                          <span className="muted"> · {customer.phone || 'No phone'}</span>
                        </span>
                        <strong>{customer.loyaltyPoints} pts</strong>
                      </button>
                    ))}
                    {checkoutCustomerSearchStatus === 'idle' && checkoutCustomerMatches.length === 0 ? (
                      <span className="muted search-select-empty">No customers found.</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Selected customer auto-filled info */}
              {selectedCheckoutCustomer ? (
                <div className="checkout-customer-card">
                  <div>
                    <strong>{selectedCheckoutCustomer.name}</strong>
                    <span className="muted">{selectedCheckoutCustomer.phone || 'No phone'}</span>
                  </div>
                  <div className="right">
                    <strong>{selectedCheckoutCustomer.loyaltyPoints} pts</strong>
                    <span className="muted">Loyalty balance</span>
                  </div>
                </div>
              ) : (
                <p className="muted checkout-walkin-note">Select a customer to start the sale.</p>
              )}

              {/* Product + service dropdowns (kept separate) */}
              <div className="checkout-pickers">
                <SearchSelect
                  label="Add product"
                  placeholder="Search products…"
                  emptyText="No products found."
                  options={products
                    .filter((product) => product.isActive === 1)
                    .map((product) => ({
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      meta: `${product.stock} in stock`,
                    }))}
                  onPick={(id) => {
                    const product = products.find((item) => item.id === id);
                    if (product) addToCart(product);
                  }}
                />
                <SearchSelect
                  label="Add service"
                  placeholder="Search services…"
                  emptyText="No services found."
                  options={services
                    .filter((service) => service.isActive === 1)
                    .map((service) => ({
                      id: service.id,
                      name: service.name,
                      price: service.price,
                      meta: service.code,
                    }))}
                  onPick={(id) => {
                    const service = services.find((item) => item.id === id);
                    if (service) addServiceToCart(service);
                  }}
                />
              </div>
            </div>

            <aside className="cart checkout-cart">
              <div className="cart-header">
                <div>
                  <p className="eyebrow">Checkout basket</p>
                  <h3>{cart.length} items</h3>
                </div>
                <div className="cart-header-actions">
                  <span className={checkoutStatus === 'saved' ? 'pill pill-online' : 'pill'}>{checkoutStatus}</span>
                </div>
              </div>

              <div className="cart-lines">
                {cart.length === 0 ? (
                  <div className="empty">
                    <strong>No items yet</strong>
                    <span>Scan a barcode, tap a product, or add a service to begin.</span>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div className="cart-line" key={item.id}>
                      <div className="cart-line-main">
                        <div>
                          <strong>{item.name}</strong>
                          <span>
                            {item.type === 'service' ? 'Service' : 'Product'} · {item.qty} x {money.format(item.price)}
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
                      <strong>{money.format(item.price * item.qty)}</strong>
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
                <div className="discount-row">
                  <span>Discount</span>
                  <div className="discount-controls">
                    <div className="discount-toggle">
                      <button
                        type="button"
                        className={checkoutDiscountType === 'pkr' ? 'active' : ''}
                        onClick={() => setCheckoutDiscountType('pkr')}
                      >
                        PKR
                      </button>
                      <button
                        type="button"
                        className={checkoutDiscountType === 'percent' ? 'active' : ''}
                        onClick={() => setCheckoutDiscountType('percent')}
                      >
                        %
                      </button>
                    </div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step={checkoutDiscountType === 'percent' ? '1' : '0.01'}
                      max={checkoutDiscountType === 'percent' ? '100' : undefined}
                      value={checkoutDiscount}
                      onChange={(event) => setCheckoutDiscount(event.target.value)}
                    />
                  </div>
                </div>
                {checkoutDiscountType === 'percent' && discount > 0 ? (
                  <div className="discount-applied">
                    <span>Discount applied</span>
                    <strong>- {money.format(discount)}</strong>
                  </div>
                ) : null}
                <label>
                  <span>Payment method</span>
                  <select
                    className="field"
                    value={checkoutPaymentMethod}
                    onChange={(event) => setCheckoutPaymentMethod(event.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Digital Wallet">Digital Wallet</option>
                  </select>
                </label>
                {pointsToEarn > 0 ? (
                  <div className="points-preview">
                    <span>Points this sale</span>
                    <strong>+{pointsToEarn} pts</strong>
                  </div>
                ) : null}
                <div className="grand">
                  <span>Total</span>
                  <strong>{money.format(total)}</strong>
                </div>
              </div>

              {cart.length > 0 && !selectedCheckoutCustomer ? (
                <p className="muted checkout-require-note">Select a customer above to complete the sale.</p>
              ) : null}
              <button
                className="primary-button"
                onClick={submitCheckout}
                disabled={cart.length === 0 || !selectedCheckoutCustomer}
              >
                Complete &amp; view receipt
              </button>

              <div className="inventory-section inventory-section-muted">
                <div className="inventory-section-head">
                  <div>
                    <h3>Recent transactions</h3>
                    <span className="muted">Latest receipts from the unified table</span>
                  </div>
                  <span className="muted">{recentSales.length} stored</span>
                </div>
                <div className="customer-history-list">
                  {recentSales.length > 0 ? (
                    recentSales.slice(0, 6).map((transaction) => (
                      <div className="customer-history-item" key={transaction.id}>
                        <div>
                          <strong>{transaction.customerName}</strong>
                          <span>
                            {transaction.receiptNo} · {transaction.paymentMethod}
                          </span>
                        </div>
                        <div className="right">
                          <strong>{money.format(transaction.grandTotal)}</strong>
                          <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="muted">No transactions saved yet.</span>
                  )}
                </div>
              </div>
            </aside>
          </section>
        ) : view === 'reports' ? (
          <section className="reports-view">
            <div className="reports-header">
              <div>
                <p className="eyebrow">Reports</p>
                <h2>Business performance at a glance</h2>
              </div>
              <span className="pill pill-online">Top method · {reports?.revenue.topPaymentMethod ?? 'Cash'}</span>
            </div>

            <div className="dashboard-metrics">
              <div className="metric-card">
                <span>Revenue</span>
                <strong>{reports ? money.format(reports.revenue.totalRevenue) : '...'}</strong>
                <small>{reports?.revenue.saleCount ?? 0} transactions</small>
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
              <section className="panel dashboard-panel report-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Revenue</p>
                    <h2>Sales &amp; billing</h2>
                  </div>
                </div>
                <div className="report-stats">
                  <div className="report-stat">
                    <span>Revenue</span>
                    <strong>{reports ? money.format(reports.revenue.totalRevenue) : '...'}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Tax collected</span>
                    <strong>{reports ? money.format(reports.revenue.totalTax) : '...'}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Discounts</span>
                    <strong>{reports ? money.format(reports.revenue.totalDiscount) : '...'}</strong>
                  </div>
                </div>
                <p className="report-list-label">Top products</p>
                <div className="report-list">
                  {reports && reports.revenue.topProducts.length > 0 ? (
                    reports.revenue.topProducts.slice(0, 5).map((product, index) => (
                      <div className="report-row" key={product.productName}>
                        <span className="report-rank">{index + 1}</span>
                        <div className="report-row-main">
                          <strong>{product.productName}</strong>
                          <span>{product.quantitySold} sold</span>
                        </div>
                        <strong className="report-row-value">{money.format(product.totalAmount)}</strong>
                      </div>
                    ))
                  ) : (
                    <span className="report-empty">No product sales yet.</span>
                  )}
                </div>
              </section>

              <section className="panel dashboard-panel report-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Customers</p>
                    <h2>Customer activity</h2>
                  </div>
                </div>
                <div className="report-stats">
                  <div className="report-stat">
                    <span>Total</span>
                    <strong>{reports?.customers.totalCustomers ?? '...'}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Active</span>
                    <strong>{reports?.customers.activeCustomers ?? 0}</strong>
                  </div>
                  <div className="report-stat">
                    <span>New this month</span>
                    <strong>{reports?.customers.newCustomersThisMonth ?? 0}</strong>
                  </div>
                </div>
                <p className="report-list-label">Top customers</p>
                <div className="report-list">
                  {reports && reports.customers.topCustomers.length > 0 ? (
                    reports.customers.topCustomers.slice(0, 5).map((customer, index) => (
                      <div className="report-row" key={customer.id}>
                        <span className="report-rank">{index + 1}</span>
                        <div className="report-row-main">
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.visitsCount} visits · {customer.loyaltyPoints} pts
                          </span>
                        </div>
                        <strong className="report-row-value">{money.format(customer.totalSpent)}</strong>
                      </div>
                    ))
                  ) : (
                    <span className="report-empty">No customers yet.</span>
                  )}
                </div>
              </section>
            </div>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel report-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Visits</p>
                    <h2>Services &amp; attendance</h2>
                  </div>
                </div>
                <div className="report-stats">
                  <div className="report-stat">
                    <span>Total visits</span>
                    <strong>{reports?.visits.totalVisits ?? '...'}</strong>
                  </div>
                  <div className="report-stat">
                    <span>From checkout</span>
                    <strong>{reports?.visits.saleVisits ?? 0}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Today</span>
                    <strong>{reports?.visits.visitsToday ?? 0}</strong>
                  </div>
                </div>
                <p className="report-list-label">Top services</p>
                <div className="report-list">
                  {reports && reports.visits.topServices.length > 0 ? (
                    reports.visits.topServices.slice(0, 5).map((service, index) => (
                      <div className="report-row" key={service.serviceName}>
                        <span className="report-rank">{index + 1}</span>
                        <div className="report-row-main">
                          <strong>{service.serviceName}</strong>
                          <span>{service.visitCount} visits</span>
                        </div>
                        <strong className="report-row-value">{money.format(service.totalAmount)}</strong>
                      </div>
                    ))
                  ) : (
                    <span className="report-empty">No service visits yet.</span>
                  )}
                </div>
              </section>

              <section className="panel dashboard-panel report-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Loyalty</p>
                    <h2>Points movement</h2>
                  </div>
                </div>
                <div className="report-stats">
                  <div className="report-stat">
                    <span>Earned</span>
                    <strong>{reports?.loyalty.totalEarned ?? 0}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Redeemed</span>
                    <strong>{reports?.loyalty.totalRedeemed ?? 0}</strong>
                  </div>
                  <div className="report-stat">
                    <span>Outstanding</span>
                    <strong>{reports?.loyalty.outstandingBalance ?? 0}</strong>
                  </div>
                </div>
                <p className="report-list-label">Top balances</p>
                <div className="report-list">
                  {reports && reports.loyalty.topBalances.length > 0 ? (
                    reports.loyalty.topBalances.slice(0, 5).map((customer, index) => (
                      <div className="report-row" key={customer.id}>
                        <span className="report-rank">{index + 1}</span>
                        <div className="report-row-main">
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.earned} earned · {customer.redeemed} redeemed
                          </span>
                        </div>
                        <strong className="report-row-value">{customer.balance} pts</strong>
                      </div>
                    ))
                  ) : (
                    <span className="report-empty">No loyalty activity yet.</span>
                  )}
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
                <span className="pill pill-offline">{activeServices.length} active services</span>
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
                  <label>
                    <span>Redeem for free at (points)</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="1"
                      value={newService.redeemPoints}
                      onChange={(event) =>
                        setNewService((current) => ({ ...current, redeemPoints: event.target.value }))
                      }
                      placeholder="0 = not redeemable"
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
                  <span className="muted">{activeServices.length} showing</span>
                </div>
                <div className="inventory-table-wrap">
                  <table className="inventory-table">
                    <colgroup>
                      <col className="inventory-col-service" />
                      <col className="inventory-col-stock" />
                      <col className="inventory-col-price" />
                      <col className="inventory-col-stock" />
                      <col className="inventory-col-service" />
                      <col className="inventory-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Code</th>
                        <th>Price</th>
                        <th>Redeem at</th>
                        <th>Description</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeServices.map((service) => (
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
                          <td className="inventory-cell-number">
                            {service.redeemPoints > 0 ? (
                              <strong>{service.redeemPoints} pts</strong>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className="muted">{service.description}</span>
                          </td>
                          <td>
                            <div className="inventory-actions">
                              <button
                                className="danger-button danger-button-small"
                                onClick={() => softDeleteService(service.id, service.name)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {deletedServices.length > 0 ? (
                <div className="inventory-section inventory-section-muted">
                  <div className="inventory-section-head">
                    <div>
                      <h3>Deleted services</h3>
                      <span className="muted">{deletedServices.length} hidden from POS</span>
                    </div>
                    <button
                      className="ghost-button ghost-button-small"
                      onClick={() => setShowDeletedServices((current) => !current)}
                    >
                      {showDeletedServices ? 'Hide deleted' : 'Show deleted'}
                    </button>
                  </div>
                  {showDeletedServices ? (
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
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deletedServices.map((service) => (
                            <tr key={service.id} className="inventory-row-deleted">
                              <td>
                                <div className="inventory-name-cell">
                                  <strong>{service.name}</strong>
                                  <span className="deleted-pill">Deleted</span>
                                </div>
                              </td>
                              <td className="inventory-cell-number">
                                <strong>{service.code}</strong>
                              </td>
                              <td className="inventory-cell-number">{money.format(service.price)}</td>
                              <td>
                                <div className="inventory-actions">
                                  <button
                                    className="ghost-button ghost-button-small"
                                    onClick={() => void restoreServiceItem(service.id)}
                                  >
                                    Restore
                                  </button>
                                  <button
                                    className="danger-button danger-button-small"
                                    onClick={() => hardDeleteService(service.id, service.name)}
                                  >
                                    Delete permanently
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                  {backupStatus === 'saving' ? 'Backing up...' : 'Backup to Excel'}
                </button>
                <button className="ghost-button" onClick={() => void restoreDatabase()} disabled={restoreStatus === 'saving'}>
                  {restoreStatus === 'saving' ? 'Restoring...' : 'Restore from Excel'}
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
                      <span>Rupees per point (earning)</span>
                      <input
                        className="field"
                        type="number"
                        min="1"
                        step="1"
                        value={loyaltyForm.currencyPerPoint}
                        onChange={(event) =>
                          setLoyaltyForm((current) => ({ ...current, currencyPerPoint: event.target.value }))
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
                        Customers earn 1 point for every {loyaltyForm.currencyPerPoint || '15'} PKR spent on services.
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
                      <strong>Backup to Excel</strong>
                      <span>Export all data to a dated .xlsx workbook you can open in Excel.</span>
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
                      <strong>Restore from Excel</strong>
                      <span>Replace the current data with a saved .xlsx backup.</span>
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
                  <label>
                    <span>Redeem for free at (points)</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="1"
                      value={newItem.redeemPoints}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, redeemPoints: event.target.value }))
                      }
                      placeholder="0 = not redeemable"
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
                      <span className="muted">This saves to the local database.</span>
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
                      <col className="inventory-col-stock" />
                      <col className="inventory-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Stock</th>
                        <th>Price</th>
                        <th>Redeem at</th>
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
                          <td className="inventory-cell-number">
                            {item.redeemPoints > 0 ? (
                              <strong>{item.redeemPoints} pts</strong>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
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
                              <button className="ghost-button ghost-button-small" onClick={() => void restoreItem(item.id)}>
                                Restore
                              </button>
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
                        : customerModal === 'bill'
                          ? 'New bill'
                        : customerModal === 'edit'
                          ? 'Edit customer'
                        : customerModal === 'ledger'
                          ? 'Transaction history'
                          : 'Redeem loyalty'}
                  </p>
                  <h2>
                    {customerModal === 'customer'
                      ? 'Create a customer profile'
                      : customerModal === 'visit'
                        ? 'Log a salon visit'
                        : customerModal === 'bill'
                          ? 'Select a customer and service'
                        : customerModal === 'edit'
                          ? customerProfile?.customer.name || 'Update customer'
                        : customerModal === 'ledger'
                          ? `${customerProfile?.customer.name || 'Customer'} — full ledger`
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
              ) : customerModal === 'bill' ? (
                <form className="new-item-form" onSubmit={createNewBill}>
                  <div className="form-grid">
                <div className="customer-results full-width">
                  {selectedBillServices.length > 0 ? (
                    <div className="customer-result customer-result-selected">
                      <div>
                        <strong>
                          {selectedBillServices.length} service{selectedBillServices.length === 1 ? '' : 's'} selected
                        </strong>
                        <span>
                          {selectedBillServices.map((service) => service.name).join(', ')}
                        </span>
                      </div>
                      <div className="right">
                        <strong>{money.format(selectedBillTotal)}</strong>
                        <span>total amount</span>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">
                      <strong>No services selected</strong>
                      <span>Select one or more service cards on the billing screen first.</span>
                    </div>
                  )}
                </div>
                    <label className="full-width">
                      <span>Customer</span>
                      <input
                        className="field"
                        placeholder="Search customer name, phone, or email"
                        value={billCustomerQuery}
                        onChange={(event) => {
                          setBillCustomerQuery(event.target.value);
                          setSelectedBillCustomer(null);
                        }}
                      />
                    </label>
                    <div className="customer-results full-width">
                      {billCustomerSearchStatus === 'loading' ? <span className="muted">Searching customers...</span> : null}
                      {billCustomerMatches.map((customer) => (
                        <button
                          type="button"
                          key={customer.id}
                          className={`customer-result ${
                            selectedBillCustomer?.id === customer.id ? 'customer-result-selected' : ''
                          }`}
                          onClick={() => chooseBillCustomer(customer)}
                        >
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.phone || 'No phone'}
                            {customer.email ? ` · ${customer.email}` : ''}
                          </span>
                        </button>
                      ))}
                      {billCustomerQuery && billCustomerSearchStatus === 'idle' && billCustomerMatches.length === 0 ? (
                        <span className="muted">No matching customers found.</span>
                      ) : null}
                    </div>

                    <label className="full-width">
                      <span>Notes</span>
                      <input
                        className="field"
                        placeholder="Optional bill note"
                        value={billNotes}
                        onChange={(event) => setBillNotes(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={billStatus === 'saving'}>
                      {billStatus === 'saving' ? 'Saving...' : 'Create bill'}
                    </button>
                    <div className="form-message">
                      {billError ? (
                        <span className="error-text">{billError}</span>
                      ) : billStatus === 'saved' ? (
                        <span className="success-text">Bill created successfully.</span>
                      ) : (
                        <span className="muted">Pick a customer to create the bill.</span>
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
              ) : customerModal === 'ledger' ? (
                <div className="customer-ledger">
                  {customerProfile && customerProfile.ledger.length > 0 ? (
                    <div className="customer-history-list customer-ledger-list">
                      {customerProfile.ledger.map((entry) => (
                        <div className="customer-ledger-entry" key={entry.id}>
                          <div className="customer-ledger-entry-head">
                            <div>
                              <strong>{new Date(entry.createdAt).toLocaleString()}</strong>
                              <span className="muted">
                                {entry.receiptNo} · {entry.paymentMethod}
                              </span>
                            </div>
                            <div className="right">
                              <strong>{money.format(entry.grandTotal)}</strong>
                              <span className="muted">
                                {entry.pointsEarned > 0 ? `+${entry.pointsEarned} pts` : 'No points'}
                              </span>
                            </div>
                          </div>
                          <div className="customer-ledger-items">
                            {entry.items.map((item, index) => (
                              <div className="customer-ledger-item" key={`${entry.id}-${index}`}>
                                <span>
                                  <span className={`pill ${item.itemType === 'service' ? 'pill-online' : ''}`}>
                                    {item.itemType}
                                  </span>{' '}
                                  {item.name} · {item.qty} x {money.format(item.price)}
                                </span>
                                <strong>{money.format(item.lineTotal)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">No transactions recorded for this customer yet.</span>
                  )}
                </div>
              ) : (
                <div className="new-item-form">
                  {(() => {
                    const balance = customerProfile?.customer.loyaltyPoints ?? 0;
                    // Only services with an explicit redeem price the customer can afford.
                    const affordable = services.filter(
                      (service) =>
                        service.isActive !== 0 &&
                        service.redeemPoints > 0 &&
                        service.redeemPoints <= balance
                    );
                    return (
                      <div className="redeem-services">
                        <div className="inventory-section-head">
                          <div>
                            <h3>Free services on {balance} points</h3>
                            <span className="muted">Tap a service to redeem it for this customer</span>
                          </div>
                        </div>
                        <div className="customer-summary-list">
                          {affordable.length > 0 ? (
                            affordable.map((service) => (
                              <button
                                type="button"
                                className="customer-summary-item redeem-service-item"
                                key={service.id}
                                disabled={redeemStatus === 'saving'}
                                onClick={() => void redeemService(service)}
                              >
                                <div>
                                  <strong>{service.name}</strong>
                                  <span>{money.format(service.price)}</span>
                                </div>
                                <div className="right">
                                  <strong>{service.redeemPoints} pts</strong>
                                  <span>redeem</span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <span className="muted">No service can be redeemed with these points yet.</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {receiptPreview ? (
          <div className="modal-backdrop" onClick={() => setReceiptPreview(null)} role="presentation">
            <section
              className="modal-card receipt-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="dashboard-panel-head">
                <div>
                  <p className="eyebrow">Receipt</p>
                  <h2>{receiptPreview.receiptNo}</h2>
                </div>
                <button className="ghost-button ghost-button-small" type="button" onClick={() => setReceiptPreview(null)}>
                  Close
                </button>
              </div>

              <div className="receipt-paper">
                <h3 className="receipt-salon">{settings?.salonInfo.name ?? 'Offline POS'}</h3>
                {settings?.salonInfo.tagline ? (
                  <p className="receipt-muted">{settings.salonInfo.tagline}</p>
                ) : null}
                {settings?.salonInfo.phone ? (
                  <p className="receipt-muted">{settings.salonInfo.phone}</p>
                ) : null}
                {settings?.salonInfo.address ? (
                  <p className="receipt-muted">{settings.salonInfo.address}</p>
                ) : null}

                <div className="receipt-divider" />
                <p className="receipt-muted">Receipt: {receiptPreview.receiptNo}</p>
                <p className="receipt-muted">Customer: {receiptPreview.customerName}</p>
                <p className="receipt-muted">
                  {receiptPreview.cashierName} · {new Date(receiptPreview.createdAt).toLocaleString()}
                </p>
                <div className="receipt-divider" />

                <div className="receipt-items">
                  {receiptPreview.detailedItems.map((item) => (
                    <div className="receipt-item" key={item.id}>
                      <div>
                        <span>{item.name}</span>
                        <span className="receipt-muted">
                          {item.qty} x {money.format(item.price)}
                        </span>
                      </div>
                      <strong>{money.format(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>

                <div className="receipt-divider" />
                <div className="receipt-total-row">
                  <span>Subtotal</span>
                  <span>{money.format(receiptPreview.subtotal)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Tax</span>
                  <span>{money.format(receiptPreview.taxTotal)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Discount</span>
                  <span>{money.format(receiptPreview.discountTotal)}</span>
                </div>
                <div className="receipt-total-row receipt-grand">
                  <span>Total</span>
                  <span>{money.format(receiptPreview.grandTotal)}</span>
                </div>
                <div className="receipt-divider" />
                <p className="receipt-muted">Payment: {receiptPreview.paymentMethod}</p>
                {receiptPreview.loyaltyPointsEarned > 0 ? (
                  <p className="receipt-muted">Points earned: +{receiptPreview.loyaltyPointsEarned}</p>
                ) : null}
                <p className="receipt-thanks">Thank you for your visit!</p>
              </div>

              <div className="receipt-actions">
                <button className="primary-button" type="button" onClick={printCurrentReceipt}>
                  Print receipt
                </button>
                <button className="ghost-button" type="button" onClick={() => setReceiptPreview(null)}>
                  Done
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
