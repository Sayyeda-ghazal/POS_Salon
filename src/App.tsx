import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Product } from '../electron/schema';

type CartLine = Product & { quantity: number };
type InventoryRow = Product;
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
  serviceName: string;
  amount: number;
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
};
type ViewMode = 'dashboard' | 'customers' | 'pos' | 'inventory';
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

const money = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
});

const CASHIER_NAME = 'Amina Khan';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [recentSales, setRecentSales] = useState<Array<any>>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
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
    serviceName: '',
    amount: '0.00',
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
  const [customerFormMode, setCustomerFormMode] = useState<'create' | 'edit'>('create');
  const [customerFormStatus, setCustomerFormStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [customerFormError, setCustomerFormError] = useState('');
  const scanBuffer = useRef('');
  const scanTimer = useRef<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const [dash, list, sales, sync, stock] = await Promise.all([
        window.pos.getDashboard(),
        window.pos.listProducts(),
        window.pos.getRecentSales(),
        window.pos.getSyncStatus(),
        window.pos.listInventory(),
      ]);
      setDashboard(dash);
      setProducts(list);
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
      if (view !== 'pos') return;
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
    const [dash, list, sales, sync, stock] = await Promise.all([
      window.pos.getDashboard(),
      window.pos.listProducts(),
      window.pos.getRecentSales(),
      window.pos.getSyncStatus(),
      window.pos.listInventory(),
    ]);
    setDashboard(dash);
    setProducts(list);
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
    alert(`Sale saved locally as ${result.receiptNo}`);
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

      await window.pos.createVisit({
        customerId: selectedCustomerId,
        customerName: selectedCustomer?.name,
        serviceName: newVisit.serviceName,
        amount: Number(newVisit.amount),
        notes: newVisit.notes || undefined,
      });
      setNewVisit({
        customerId: 'walk-in',
        serviceName: '',
        amount: '0.00',
        notes: '',
      });
      setCustomerSearch('');
      setCustomerMatches([]);
      setSelectedVisitCustomer(null);
      setNewVisitStatus('saved');
      await refreshData();
    } catch (error) {
      setNewVisitStatus('error');
      setNewVisitError(error instanceof Error ? error.message : 'Could not create visit');
    }
  };

  const openCustomerForm = () => {
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
      await refreshData();
    } catch (error) {
      setCustomerFormStatus('error');
      setCustomerFormError(error instanceof Error ? error.message : 'Could not save customer');
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
      openCustomerForm();
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
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OP</div>
          <div>
            <p className="eyebrow">Offline POS</p>
            <h1>Front Counter</h1>
          </div>
        </div>

        <div className="status-card">
          <div className="status-row">
            <span className={`pill ${dashboard?.online ? 'pill-online' : 'pill-offline'}`}>
              {dashboard?.online ? 'Online' : 'Offline-first'}
            </span>
            <span className="muted">{dashboard?.registerName ?? 'Loading...'}</span>
          </div>
          <div className="status-grid">
            <div>
              <strong>{dashboard ? money.format(dashboard.revenueToday) : '...'}</strong>
              <span>Revenue today</span>
            </div>
            <div>
              <strong>{dashboard?.visitsToday ?? '...'}</strong>
              <span>Visits</span>
            </div>
            <div>
              <strong>{dashboard?.customerCount ?? '...'}</strong>
              <span>Customers</span>
            </div>
            <div>
              <strong>{dashboard?.pendingSync ?? '...'}</strong>
              <span>Sync queue</span>
            </div>
          </div>
          <div className="sync-box">
            <div className="status-row">
              <strong>Neon sync</strong>
              <span className={`pill ${syncStatus?.enabled ? 'pill-online' : 'pill-offline'}`}>
                {syncStatus?.enabled ? (syncStatus.syncing ? 'Syncing' : 'Enabled') : 'Disabled'}
              </span>
            </div>
            <p className="muted">
              {syncStatus?.lastError
                ? syncStatus.lastError
                : syncStatus?.lastSuccessAt
                  ? `Last sync ${new Date(syncStatus.lastSuccessAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Connect NEON_DATABASE_URL to enable cloud sync.'}
            </p>
            <div className="sync-actions">
              <button className="ghost-button" onClick={() => window.pos.syncNow().then(setSyncStatus)}>
                Sync now
              </button>
              <span className="muted">{syncStatus?.pendingCount ?? 0} pending</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Recent Visits</h2>
          <div className="list">
            {dashboard?.recentVisits.slice(0, 5).map((visit) => (
              <div className="list-item" key={visit.id}>
                <div>
                  <strong>{visit.customerName}</strong>
                  <span>{visit.serviceName}</span>
                </div>
                <div className="right">
                  <strong>{money.format(visit.amount)}</strong>
                  <span>{new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{view === 'dashboard' ? 'Front desk' : view === 'customers' ? 'Reception' : 'Cashier station'}</p>
            <h2>
              {view === 'dashboard'
                ? 'Parlor dashboard for customers, visits, and loyalty.'
                : view === 'customers'
                  ? 'Manage customer profiles, history, and favorite services.'
                : 'Fast checkout, built to feel calm and premium.'}
            </h2>
          </div>
          <div className="toolbar">
            <button className={`ghost-button ${view === 'dashboard' ? 'ghost-active' : ''}`} onClick={() => setView('dashboard')}>
              Dashboard
            </button>
            <button className={`ghost-button ${view === 'customers' ? 'ghost-active' : ''}`} onClick={() => setView('customers')}>
              Customers
            </button>
            <button className={`ghost-button ${view === 'pos' ? 'ghost-active' : ''}`} onClick={() => setView('pos')}>
              POS
            </button>
            <button
              className={`ghost-button ${view === 'inventory' ? 'ghost-active' : ''}`}
              onClick={() => setView('inventory')}
            >
              Services
            </button>
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
                <button className="ghost-button" onClick={() => setView('pos')}>
                  New Sale
                </button>
                <button className="ghost-button" onClick={() => setView('inventory')}>
                  Services
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
                    <h2>Add Customer / New Visit</h2>
                  </div>
                  <span className="pill pill-offline">Local first</span>
                </div>

                <div className="quick-actions-grid">
                  <form className="mini-form" onSubmit={createNewCustomer}>
                    <h3>Add Customer</h3>
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
                        {newCustomerStatus === 'saving' ? 'Saving...' : 'Add Customer'}
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

                  <form className="mini-form" onSubmit={createNewVisit}>
                    <h3>New Visit</h3>
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
                            className={`customer-result ${
                              newVisit.customerId === customer.id ? 'customer-result-selected' : ''
                            }`}
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
                      <label>
                        <span>Amount</span>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1500"
                          value={newVisit.amount}
                          onChange={(event) => setNewVisit((current) => ({ ...current, amount: event.target.value }))}
                          required
                        />
                      </label>
                      <label className="full-width">
                        <span>Service</span>
                        <input
                          className="field"
                          placeholder="Hair color / Facial / Manicure"
                          value={newVisit.serviceName}
                          onChange={(event) =>
                            setNewVisit((current) => ({ ...current, serviceName: event.target.value }))
                          }
                          required
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
                        {newVisitStatus === 'saving' ? 'Saving...' : 'New Visit'}
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
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">Recent visits</p>
                    <h2>Today and latest</h2>
                  </div>
                  <span className="pill pill-online">{dashboard?.recentVisits.length ?? 0} logged</span>
                </div>
                <div className="list dashboard-visit-list">
                  {(dashboard?.recentVisits ?? []).map((visit) => (
                    <div className="list-item" key={visit.id}>
                      <div>
                        <strong>{visit.customerName}</strong>
                        <span>
                          {visit.serviceName}
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
            <div className="customer-management-layout">
              <aside className="panel customer-directory">
                <div className="customer-directory-head">
                  <div>
                    <p className="eyebrow">Customer management</p>
                    <h2>Search by name or phone</h2>
                  </div>
                  <button className="ghost-button ghost-button-small" onClick={openCustomerForm}>
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

              <section className="panel customer-profile-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="eyebrow">{customerFormMode === 'edit' ? 'Edit customer' : 'Add customer'}</p>
                    <h2>
                      {customerFormMode === 'create'
                        ? 'New customer'
                        : customerProfile?.customer.name || 'Customer profile'}
                    </h2>
                  </div>
                  <span className={`pill ${customerProfile?.customer.isActive === 0 ? 'pill-offline' : 'pill-online'}`}>
                    {customerProfile?.customer.isActive === 0 ? 'Deleted' : customerProfile ? 'Active' : 'Ready'}
                  </span>
                </div>

                <form className="customer-profile-form" onSubmit={saveCustomer}>
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

                  <div className="customer-profile-stats">
                    <div className="metric-card">
                      <span>Visits</span>
                      <strong>{customerProfile?.customer.visitsCount ?? '...'}</strong>
                      <small>Total salon visits</small>
                    </div>
                    <div className="metric-card">
                      <span>Loyalty points</span>
                      <strong>{customerProfile?.customer.loyaltyPoints ?? '...'}</strong>
                      <small>Available points</small>
                    </div>
                    <div className="metric-card">
                      <span>Last visit</span>
                      <strong>
                        {customerProfile?.customer.lastVisitAt
                          ? new Date(customerProfile.customer.lastVisitAt).toLocaleDateString()
                          : '—'}
                      </strong>
                      <small>Most recent session</small>
                    </div>
                  </div>

                  <div className="form-footer">
                    <button className="primary-button" type="submit" disabled={customerFormStatus === 'saving'}>
                      {customerFormStatus === 'saving'
                        ? 'Saving...'
                        : customerFormMode === 'edit'
                          ? 'Save changes'
                          : 'Add customer'}
                    </button>
                    <div className="form-message">
                      {customerFormError ? (
                        <span className="error-text">{customerFormError}</span>
                      ) : customerFormStatus === 'saved' ? (
                        <span className="success-text">Customer saved.</span>
                      ) : (
                        <span className="muted">
                          {customerFormMode === 'edit' ? 'Update profile details and notes.' : 'Create a new customer profile.'}
                        </span>
                      )}
                    </div>
                  </div>
                </form>

                <div className="customer-profile-grid">
                  <section className="customer-profile-card">
                    <div className="inventory-section-head">
                      <div>
                        <h3>Favorite services</h3>
                        <span className="muted">Most requested treatments</span>
                      </div>
                    </div>
                    <div className="customer-summary-list">
                      {(customerProfile?.favoriteServices ?? []).length > 0 ? (
                        customerProfile!.favoriteServices.map((service) => (
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
                        <h3>Visit history</h3>
                        <span className="muted">Latest salon visits</span>
                      </div>
                    </div>
                    <div className="customer-history-list">
                      {(customerProfile?.recentVisits ?? []).length > 0 ? (
                        customerProfile!.recentVisits.map((visit) => (
                          <div className="customer-history-item" key={visit.id}>
                            <div>
                              <strong>{visit.serviceName}</strong>
                              <span>{visit.notes || 'No notes'}</span>
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
                </div>

                <div className="customer-profile-actions">
                  <button className="danger-button" onClick={removeCustomer} disabled={!customerProfile || customerProfile.customer.isActive === 0}>
                    Delete customer
                  </button>
                  <button className="ghost-button" onClick={openCustomerForm}>
                    Clear selection
                  </button>
                </div>
              </section>
            </div>
          </section>
        ) : view === 'pos' ? (
          <section className="workspace">
          <div className="catalog">
            <div className="search-wrap">
                <input
                  autoFocus
                  className="search"
                  placeholder="Search service, code, or category"
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
              Complete sale
            </button>
          </aside>
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
      </main>
    </div>
  );
}

export default App;
