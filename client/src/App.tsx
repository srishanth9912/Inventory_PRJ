import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, inr, day, time } from './api';

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  defaultPricePerPiece: number;
  boxSize: number;
  currentStock: number;
  lowStockLimit: number;
};

type SaleItem = {
  productId: string;
  productName: string;
  unit: 'box' | 'piece';
  quantity: number;
  pieces: number;
  pricePerPiece: number;
  lineTotal: number;
};

type Sale = {
  _id: string;
  customerName: string;
  phone?: string | null;
  notes?: string | null;
  items: SaleItem[];
  totalAmount: number;
  soldAt: number;
};

type Stats = {
  products: Product[];
  month: {
    pieces: number;
    revenue: number;
    saleCount: number;
    byProduct: Record<string, { pieces: number; revenue: number }>;
  };
};

type Page =
  | 'home'
  | 'inventory'
  | 'product'
  | 'addstock'
  | 'editproduct'
  | 'sales'
  | 'newsale'
  | 'saledetail'
  | 'more';

function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className} ${
        onClick ? 'cursor-pointer active:scale-[0.98] transition' : ''
      }`}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold text-slate-800 mb-4">{children}</h1>;
}

function Btn({
  children,
  onClick,
  secondary,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full min-h-12 rounded-xl font-semibold text-base active:scale-95 transition disabled:opacity-50 ${
        secondary ? 'bg-slate-100 text-slate-700' : 'bg-teal-700 text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`min-h-12 rounded-xl font-semibold border text-sm ${
            value === k
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function stockStatus(p: Product) {
  if (p.currentStock <= 0)
    return { label: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-50' };
  if (p.currentStock <= p.lowStockLimit)
    return { label: 'Low Stock', color: 'text-amber-600', bg: 'bg-amber-50' };
  return { label: 'In Stock', color: 'text-green-600', bg: 'bg-green-50' };
}

function AddStockScreen({
  product,
  onBack,
  onSaved,
}: {
  product: Product;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [unit, setUnit] = useState<'box' | 'piece'>('box');
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const pieces = unit === 'box' ? qty * product.boxSize : qty;

  const save = async () => {
    if (qty <= 0) {
      setErr('Enter a valid quantity');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api.addStock(product.id, unit, qty);
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={onBack} className="text-teal-700 mb-2 font-medium">
        ← Back
      </button>
      <Title>Add Stock</Title>
      <Card className="space-y-4">
        <div className="font-bold text-lg">{product.name}</div>
        <div>
          <div className="text-sm text-slate-500 mb-1">Unit</div>
          <Toggle
            options={[
              ['box', `Box (${product.boxSize} pcs)`],
              ['piece', 'Piece'],
            ]}
            value={unit}
            onChange={(v) => setUnit(v as 'box' | 'piece')}
          />
        </div>
        <div>
          <div className="text-sm text-slate-500 mb-1">Quantity</div>
          <div className="flex items-center justify-center gap-4">
            <button type="button" className="w-12 h-12 rounded-full bg-slate-100 text-2xl" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <input type="number" min={1} value={qty || ''} onChange={(e) => setQty(Number(e.target.value))} className="w-24 text-center text-3xl font-bold border rounded-xl py-2" />
            <button type="button" className="w-12 h-12 rounded-full bg-slate-100 text-2xl" onClick={() => setQty(qty + 1)}>+</button>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-slate-600">You are adding</div>
          <div className="text-2xl font-bold text-teal-700">{pieces} pieces</div>
          <div className="text-sm text-slate-500 mt-1">Current: {product.currentStock} → After: {product.currentStock + pieces}</div>
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Stock'}</Btn>
      </Card>
    </>
  );
}

function EditProductScreen({
  product,
  onBack,
  onSaved,
}: {
  product: Product;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description);
  const [price, setPrice] = useState(product.defaultPricePerPiece);
  const [boxSize, setBoxSize] = useState(product.boxSize);
  const [stock, setStock] = useState(product.currentStock);
  const [low, setLow] = useState(product.lowStockLimit);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.updateProduct(product.id, {
        name,
        description: desc,
        defaultPricePerPiece: Number(price),
        boxSize: Number(boxSize),
        currentStock: Number(stock),
        lowStockLimit: Number(low),
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={onBack} className="text-teal-700 mb-2 font-medium">← Back</button>
      <Title>Edit Product</Title>
      <Card className="space-y-3">
        <label className="block"><span className="text-sm text-slate-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Description</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Default price per piece (₹)</span>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Pieces in one box</span>
          <input type="number" value={boxSize} onChange={(e) => setBoxSize(Number(e.target.value))} className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Current stock (pieces)</span>
          <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="w-full border rounded-xl p-3 mt-1" />
          <div className="text-xs text-slate-400 mt-1">You can directly correct the stock number here.</div></label>
        <label className="block"><span className="text-sm text-slate-500">Low stock warning at (pieces)</span>
          <input type="number" value={low} onChange={(e) => setLow(Number(e.target.value))} className="w-full border rounded-xl p-3 mt-1" /></label>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
      </Card>
    </>
  );
}

function NewSaleScreen({
  products,
  onBack,
  onSaved,
}: {
  products: Product[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [units, setUnits] = useState<Record<string, 'box' | 'piece'>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number | ''>>({});
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
    if (!units[id]) setUnits((u) => ({ ...u, [id]: 'box' }));
    if (!qtys[id]) setQtys((q) => ({ ...q, [id]: 1 }));
  };

  const items = products
    .filter((p) => selected[p.id])
    .map((p) => {
      const unit = units[p.id] || 'box';
      const qty = qtys[p.id] || 1;
      const pieces = unit === 'box' ? qty * p.boxSize : qty;
      const price = prices[p.id] === '' || prices[p.id] === undefined ? p.defaultPricePerPiece : Number(prices[p.id]);
      return { productId: p.id, unit, quantity: qty, pieces, price, product: p };
    });

  const total = items.reduce((s, i) => s + i.pieces * i.price, 0);

  const save = async () => {
    if (items.length === 0) { setErr('Select at least one product'); return; }
    for (const i of items) {
      if (i.quantity <= 0) { setErr('Quantity must be greater than 0'); return; }
      if (i.pieces > i.product.currentStock) {
        setErr(`Not enough stock for ${i.product.name}. Only ${i.product.currentStock} pieces available.`);
        return;
      }
    }
    setSaving(true);
    setErr('');
    try {
      await api.createSale({
        customerName: customer,
        phone,
        notes,
        items: items.map((i) => ({
          productId: i.productId,
          unit: i.unit,
          quantity: i.quantity,
          pricePerPiece: i.price,
        })),
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={onBack} className="text-teal-700 mb-2 font-medium">← Back</button>
      <Title>New Sale</Title>
      <Card className="mb-3">
        <div className="font-semibold mb-2">Select products</div>
        <div className="space-y-2">
          {products.map((p) => {
            const isOn = !!selected[p.id];
            return (
              <div key={p.id} className={`rounded-xl border p-3 ${isOn ? 'border-teal-600 bg-teal-50' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isOn} onChange={() => toggle(p.id)} className="w-5 h-5 accent-teal-700" />
                  <img src={p.imageUrl} alt="" className="w-12 h-12 object-contain" />
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-slate-500">Stock: {p.currentStock} pcs · Default {inr(p.defaultPricePerPiece)}/pc</div>
                  </div>
                </label>
                {isOn && (
                  <div className="mt-3 pt-3 border-t border-teal-100 space-y-3">
                    <Toggle options={[['box', `Box (${p.boxSize} pcs)`], ['piece', 'Piece']]} value={units[p.id] || 'box'} onChange={(v) => setUnits((u) => ({ ...u, [p.id]: v as 'box' | 'piece' }))} />
                    <div className="flex items-center justify-center gap-4">
                      <button type="button" className="w-10 h-10 rounded-full bg-white border text-xl" onClick={() => setQtys((q) => ({ ...q, [p.id]: Math.max(1, (q[p.id] || 1) - 1) }))}>−</button>
                      <input type="number" min={1} value={qtys[p.id] || 1} onChange={(e) => setQtys((q) => ({ ...q, [p.id]: Number(e.target.value) }))} className="w-20 text-center text-2xl font-bold border rounded-xl py-1" />
                      <button type="button" className="w-10 h-10 rounded-full bg-white border text-xl" onClick={() => setQtys((q) => ({ ...q, [p.id]: (q[p.id] || 1) + 1 }))}>+</button>
                    </div>
                    <label className="block">
                      <span className="text-sm text-slate-500">Price per piece (₹) — leave default or change</span>
                      <input type="number" value={prices[p.id] === undefined ? p.defaultPricePerPiece : prices[p.id]} onChange={(e) => setPrices((pr) => ({ ...pr, [p.id]: e.target.value === '' ? '' : Number(e.target.value) }))} className="w-full border rounded-xl p-2.5 mt-1" />
                    </label>
                    <div className="text-sm text-center text-slate-600">
                      = <b>{(units[p.id] || 'box') === 'box' ? (qtys[p.id] || 1) * p.boxSize : qtys[p.id] || 1} pieces</b> · Line total{' '}
                      <b className="text-teal-700">{inr(((units[p.id] || 'box') === 'box' ? (qtys[p.id] || 1) * p.boxSize : qtys[p.id] || 1) * (prices[p.id] === '' || prices[p.id] === undefined ? p.defaultPricePerPiece : Number(prices[p.id])))}</b>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="space-y-3 mb-3">
        <div className="font-semibold">Customer details</div>
        <label className="block"><span className="text-sm text-slate-500">Customer name</span>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Phone number (optional)</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full border rounded-xl p-3 mt-1" /></label>
        <label className="block"><span className="text-sm text-slate-500">Notes / description (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra detail about this sale" rows={2} className="w-full border rounded-xl p-3 mt-1 resize-none" /></label>
      </Card>
      {items.length > 0 && (
        <Card className="mb-3 bg-teal-50 border-teal-100">
          <div className="text-sm text-teal-800">Bill total</div>
          <div className="text-3xl font-bold text-teal-800">{inr(total)}</div>
          <div className="text-sm text-teal-700 mt-1">{items.length} product{items.length > 1 ? 's' : ''} · {items.reduce((s, i) => s + i.pieces, 0)} pieces</div>
        </Card>
      )}
      {err && <div className="mb-3 text-red-600 font-medium text-sm bg-red-50 p-3 rounded-xl">{err}</div>}
      <div className="mb-24"><Btn onClick={save} disabled={saving || items.length === 0}>{saving ? 'Saving…' : 'Save Sale'}</Btn></div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, list] = await Promise.all([api.getStats(), api.getSales(80)]);
      setStats(s);
      setSales(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cannot connect to server. Check internet & API settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = stats?.products || [];
  const getP = (id: string) => products.find((p) => p.id === id);

  const go = (p: Page, id?: string) => {
    setSelectedId(id || null);
    setSelectedSale(null);
    setPage(p);
  };

  const goSale = (s: Sale) => {
    setSelectedSale(s);
    setPage('saledetail');
  };

  const afterSave = async (next: Page, id?: string) => {
    await load();
    go(next, id);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-sm w-full text-center">
          <div className="text-red-600 font-semibold mb-2">Cannot connect</div>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <p className="text-xs text-slate-400 mb-4">Make sure the server is running and VITE_API_URL / VITE_API_KEY are set correctly in client/.env</p>
          <Btn onClick={() => { setLoading(true); load(); }}>Try again</Btn>
        </Card>
      </div>
    );
  }

  const tab =
    page === 'product' || page === 'addstock' || page === 'editproduct'
      ? 'inventory'
      : page === 'newsale' || page === 'saledetail'
        ? 'sales'
        : page;

  const selectedProduct = selectedId ? getP(selectedId) : null;
  const low = products.filter((p) => p.currentStock <= p.lowStockLimit);
  const recent = sales.slice(0, 5);

  return (
    <div className="max-w-lg mx-auto p-4 pb-28 min-h-screen">
      {page === 'home' && stats && (
        <>
          <Title>Good day</Title>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card>
              <div className="text-slate-500 text-sm">Total Stock</div>
              <div className="text-2xl font-bold mt-0.5">{products.reduce((s, p) => s + p.currentStock, 0)}<span className="text-base font-normal text-slate-500"> pcs</span></div>
            </Card>
            <Card>
              <div className="text-slate-500 text-sm">Sales this month</div>
              <div className="text-2xl font-bold mt-0.5 text-teal-700">{inr(stats.month.revenue)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stats.month.saleCount} bills · {stats.month.pieces} pcs</div>
            </Card>
          </div>
          <div className="space-y-3 mb-3">
            {products.map((p) => {
              const st = stockStatus(p);
              const m = stats.month.byProduct[p.id] || { pieces: 0, revenue: 0 };
              return (
                <Card key={p.id} onClick={() => go('product', p.id)}>
                  <div className="flex gap-3">
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-xl bg-slate-50 object-contain flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{p.name}</div>
                      <div className="text-sm text-slate-500">{p.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold">{p.currentStock} pcs</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">This month: {m.pieces} pcs · {inr(m.revenue)}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {low.length > 0 && (
            <Card className="mb-3 bg-amber-50 border-amber-100">
              <div className="font-semibold text-amber-800 mb-1">Low stock alert</div>
              {low.map((p) => (<div key={p.id} className="text-sm text-amber-900">{p.name} — only {p.currentStock} pieces left</div>))}
            </Card>
          )}
          <Card className="mb-24">
            <div className="font-semibold mb-2">Recent sales</div>
            {recent.length === 0 && <div className="text-slate-500 text-sm">No sales yet. Tap + New Sale below.</div>}
            {recent.map((s) => (
              <div key={s._id} onClick={() => goSale(s)} className="py-3 border-b last:border-0 flex justify-between gap-2 cursor-pointer">
                <div>
                  <div className="font-semibold">{s.customerName}</div>
                  <div className="text-sm text-slate-500">{s.items.map((i) => i.productName.split(' ').slice(-1)[0]).join(' + ')} · {day(s.soldAt)}</div>
                </div>
                <div className="font-bold text-right">{inr(s.totalAmount)}</div>
              </div>
            ))}
          </Card>
          <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto"><Btn onClick={() => go('newsale')}>+ New Sale</Btn></div>
        </>
      )}

      {page === 'inventory' && (
        <>
          <Title>Inventory</Title>
          <div className="space-y-3">
            {products.map((p) => {
              const st = stockStatus(p);
              return (
                <Card key={p.id} onClick={() => go('product', p.id)}>
                  <div className="flex gap-3 items-center">
                    <img src={p.imageUrl} alt="" className="w-20 h-20 rounded-xl bg-slate-50 object-contain" />
                    <div className="flex-1">
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm text-slate-500">{p.description}</div>
                      <div className="text-2xl font-bold mt-1">{p.currentStock} pcs</div>
                      <div className={`text-sm font-medium ${st.color}`}>{st.label}</div>
                    </div>
                    <div className="text-teal-700 text-sm font-semibold">View →</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {page === 'product' && selectedProduct && (() => {
        const p = selectedProduct;
        const st = stockStatus(p);
        const m = stats?.month.byProduct[p.id] || { pieces: 0, revenue: 0 };
        const productSales = sales.filter((s) => s.items.some((i) => i.productId === p.id));
        return (
          <>
            <button onClick={() => go('inventory')} className="text-teal-700 mb-2 font-medium">← Back</button>
            <Title>{p.name}</Title>
            <img src={p.imageUrl} alt="" className="h-36 mx-auto object-contain mb-2" />
            <div className="text-center mb-4">
              <div className="text-3xl font-bold">{p.currentStock} pieces</div>
              <div className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${st.bg} ${st.color}`}>{st.label}</div>
              <div className="text-sm text-slate-500 mt-1">Box size: {p.boxSize} pcs · Default price: {inr(p.defaultPricePerPiece)}/pc</div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Card><div className="text-sm text-slate-500">Sold this month</div><div className="text-xl font-bold">{m.pieces} pcs</div></Card>
              <Card><div className="text-sm text-slate-500">Revenue this month</div><div className="text-xl font-bold text-teal-700">{inr(m.revenue)}</div></Card>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Btn onClick={() => go('addstock', p.id)}>Add Stock</Btn>
              <Btn secondary onClick={() => go('editproduct', p.id)}>Edit Product</Btn>
            </div>
            <Card>
              <div className="font-semibold mb-2">Recent sales of this product</div>
              {productSales.slice(0, 8).map((s) => {
                const item = s.items.find((i) => i.productId === p.id)!;
                return (
                  <div key={s._id} onClick={() => goSale(s)} className="py-2.5 border-b last:border-0 flex justify-between cursor-pointer">
                    <div>
                      <div className="font-medium">{s.customerName}</div>
                      <div className="text-sm text-slate-500">{item.quantity} {item.unit}{item.quantity > 1 ? 's' : ''} ({item.pieces} pcs) · {day(s.soldAt)}</div>
                    </div>
                    <div className="font-semibold">{inr(item.lineTotal)}</div>
                  </div>
                );
              })}
              {productSales.length === 0 && <div className="text-slate-500 text-sm">No sales yet for this product.</div>}
            </Card>
          </>
        );
      })()}

      {page === 'addstock' && selectedProduct && (
        <AddStockScreen product={selectedProduct} onBack={() => go('product', selectedProduct.id)} onSaved={() => afterSave('product', selectedProduct.id)} />
      )}
      {page === 'editproduct' && selectedProduct && (
        <EditProductScreen product={selectedProduct} onBack={() => go('product', selectedProduct.id)} onSaved={() => afterSave('product', selectedProduct.id)} />
      )}

      {page === 'sales' && (
        <>
          <Title>Sales</Title>
          <Card className="mb-20">
            {sales.length === 0 && <div className="text-slate-500">No sales yet.</div>}
            {sales.map((s) => (
              <div key={s._id} onClick={() => goSale(s)} className="py-3 border-b last:border-0 flex justify-between gap-2 cursor-pointer">
                <div>
                  <div className="font-semibold">{s.customerName}</div>
                  <div className="text-sm text-slate-500">{s.items.map((i) => `${i.quantity} ${i.unit}${i.quantity > 1 ? 's' : ''} ${i.productName.split(' ').pop()}`).join(' + ')}</div>
                  <div className="text-xs text-slate-400">{day(s.soldAt)} · {time(s.soldAt)}{s.phone ? ` · ${s.phone}` : ''}</div>
                </div>
                <div className="font-bold">{inr(s.totalAmount)}</div>
              </div>
            ))}
          </Card>
          <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto"><Btn onClick={() => go('newsale')}>+ New Sale</Btn></div>
        </>
      )}

      {page === 'saledetail' && selectedSale && (
        <>
          <button onClick={() => go('sales')} className="text-teal-700 mb-2 font-medium">← Back</button>
          <Title>Sale Detail</Title>
          <Card className="space-y-3 mb-3">
            <div><div className="text-sm text-slate-500">Customer</div><div className="text-lg font-bold">{selectedSale.customerName}</div></div>
            {selectedSale.phone && <div><div className="text-sm text-slate-500">Phone</div><div className="font-medium">{selectedSale.phone}</div></div>}
            {selectedSale.notes && <div><div className="text-sm text-slate-500">Notes</div><div className="font-medium">{selectedSale.notes}</div></div>}
            <div><div className="text-sm text-slate-500">Date & time</div><div>{day(selectedSale.soldAt)} · {time(selectedSale.soldAt)}</div></div>
          </Card>
          <Card className="mb-3">
            <div className="font-semibold mb-2">Items</div>
            {selectedSale.items.map((it, idx) => (
              <div key={idx} className="py-2 border-b last:border-0">
                <div className="font-medium">{it.productName}</div>
                <div className="text-sm text-slate-500">{it.quantity} {it.unit}{it.quantity > 1 ? 's' : ''} = {it.pieces} pcs × {inr(it.pricePerPiece)}</div>
                <div className="font-semibold text-right">{inr(it.lineTotal)}</div>
              </div>
            ))}
            <div className="pt-3 flex justify-between text-lg font-bold"><span>Total</span><span className="text-teal-700">{inr(selectedSale.totalAmount)}</span></div>
          </Card>
        </>
      )}

      {page === 'newsale' && (
        <NewSaleScreen products={products} onBack={() => go('home')} onSaved={() => afterSave('sales')} />
      )}

      {page === 'more' && (
        <>
          <Title>Settings & Info</Title>
          <Card className="mb-3">
            <div className="font-semibold mb-1">About this app</div>
            <p className="text-sm text-slate-600 leading-relaxed">Simple stock and sales tracker for two IFB products. All data is stored safely in the cloud (MongoDB Atlas). Works best on mobile.</p>
          </Card>
          <Card className="mb-3">
            <div className="font-semibold mb-2">How calculations work</div>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
              <li><b>Stock</b> is always counted in <b>pieces</b>.</li>
              <li>1 Box = fixed number of pieces (shown on each product). You can change it in Edit Product.</li>
              <li>When you sell by box, the system multiplies quantity × box size to get pieces and reduces stock accordingly.</li>
              <li>Sale total = pieces × price per piece (for each product, then added).</li>
              <li>You can edit stock number directly if a physical count is different.</li>
            </ul>
          </Card>
          <Card className="mb-3">
            <div className="font-semibold mb-2">This month summary</div>
            {stats && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Total bills</span><span className="font-semibold">{stats.month.saleCount}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Pieces sold</span><span className="font-semibold">{stats.month.pieces}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Revenue</span><span className="font-semibold text-teal-700">{inr(stats.month.revenue)}</span></div>
                {products.map((p) => {
                  const m = stats.month.byProduct[p.id] || { pieces: 0, revenue: 0 };
                  return (
                    <div key={p.id} className="pt-2 border-t flex justify-between">
                      <span className="text-slate-600">{p.name}</span>
                      <span>{m.pieces} pcs · {inr(m.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <div className="font-semibold mb-1">Data</div>
            <p className="text-sm text-slate-600">All sales and stock live in your MongoDB Atlas database. Keep your API key private. To change database connection, update the server <code>.env</code> file.</p>
          </Card>
        </>
      )}

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t grid grid-cols-4 pb-[env(safe-area-inset-bottom)] max-w-lg mx-auto">
        {([['home', '🏠', 'Home'], ['inventory', '📦', 'Stock'], ['sales', '🧾', 'Sales'], ['more', 'ℹ️', 'Info']] as const).map(([k, icon, label]) => (
          <button key={k} type="button" onClick={() => go(k)} className={`py-3 text-sm ${tab === k ? 'text-teal-700 font-bold' : 'text-slate-500'}`}>
            <div className="text-xl">{icon}</div>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
