import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../electron/schema';

type CartLine = Product & { quantity: number };

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const CASHIER_NAME = 'Amina Khan';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Array<any>>([]);
  const [dashboard, setDashboard] = useState<{
    salesToday: number;
    receiptCount: number;
    productCount: number;
    pendingSync: number;
    online: boolean;
    registerName: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<'ready' | 'saved'>('ready');

  useEffect(() => {
    window.pos.getDashboard().then(setDashboard);
    window.pos.listProducts().then(setProducts);
    window.pos.getRecentSales().then(setRecentSales);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = `${product.name} ${product.sku} ${product.barcode} ${product.category}`.toLowerCase();
      return q.length === 0 || haystack.includes(q);
    });
  }, [products, query]);

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

  const submitSale = async () => {
    if (cart.length === 0) return;
    const result = await window.pos.createSale({
      cashierName: CASHIER_NAME,
      paymentMethod: 'Cash',
      items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
    });
    setCart([]);
    setStatus('saved');
    const nextDashboard = await window.pos.getDashboard();
    const nextSales = await window.pos.getRecentSales();
    const nextProducts = await window.pos.listProducts();
    setDashboard(nextDashboard);
    setRecentSales(nextSales);
    setProducts(nextProducts);
    alert(`Sale saved locally as ${result.receiptNo}`);
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
          <button className="ghost-button">Keyboard shortcuts</button>
        </header>

        <section className="workspace">
          <div className="catalog">
            <div className="search-wrap">
              <input
                autoFocus
                className="search"
                placeholder="Search item, SKU, or barcode"
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
              <span className={status === 'saved' ? 'pill pill-online' : 'pill'}>{status}</span>
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
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} x {money.format(item.price)}
                      </span>
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
      </main>
    </div>
  );
}

export default App;
