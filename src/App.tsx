import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Product } from '../electron/schema';

type CartLine = Product & { quantity: number };
type InventoryRow = Product;
type ViewMode = 'pos' | 'inventory';
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

const money = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
});

const CASHIER_NAME = 'Amina Khan';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [recentSales, setRecentSales] = useState<Array<any>>([]);
  const [dashboard, setDashboard] = useState<{
    salesToday: number;
    receiptCount: number;
    productCount: number;
    pendingSync: number;
    online: boolean;
    registerName: string;
  } | null>(null);
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
  const [view, setView] = useState<ViewMode>('pos');
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
              <strong>{dashboard ? money.format(dashboard.salesToday) : '...'}</strong>
              <span>Sales today</span>
            </div>
            <div>
              <strong>{dashboard?.receiptCount ?? '...'}</strong>
              <span>Receipts</span>
            </div>
            <div>
              <strong>{dashboard?.productCount ?? '...'}</strong>
              <span>Products</span>
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
          <h2>Recent Sales</h2>
          <div className="list">
            {recentSales.map((sale) => (
              <div className="list-item" key={sale.id}>
                <div>
                  <strong>{sale.receiptNo}</strong>
                  <span>{sale.cashierName}</span>
                </div>
                <div className="right">
                  <strong>{money.format(sale.grandTotal)}</strong>
                  <span>{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cashier station</p>
            <h2>Fast checkout, built to feel calm and premium.</h2>
          </div>
          <div className="toolbar">
            <button className={`ghost-button ${view === 'pos' ? 'ghost-active' : ''}`} onClick={() => setView('pos')}>
              POS
            </button>
            <button
              className={`ghost-button ${view === 'inventory' ? 'ghost-active' : ''}`}
              onClick={() => setView('inventory')}
            >
              Inventory
            </button>
          </div>
        </header>

        {view === 'pos' ? (
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
