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

type StockLogItem = {
  _id: string;
  productId: string;
  type: 'add' | 'sale' | 'manual_edit';
  unit?: string;
  quantity?: number;
  pieces: number;
  oldStock?: number;
  newStock?: number;
  at: number;
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
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition' : ''
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
      className={`w-full min-h-12 rounded-xl font-semibold text-base active:scale-95 transition disabled:opacity-50 ${secondary ? 'bg-slate-100 text-slate-700' : 'bg-teal-700 text-white'
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
          className={`min-h-12 rounded-xl font-semibold border text-sm ${value === k
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
  const [qty, setQty] = useState<number | string>(1);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const numQty = qty === '' ? 1 : Number(qty);
  const pieces = unit === 'box' ? numQty * product.boxSize : numQty;

  const save = async () => {
    const parsed = Number(qty);
    if (!parsed || parsed <= 0) {
      setErr('Enter a valid quantity');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api.addStock(product.id, unit, parsed);
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
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-slate-100 text-2xl"
              onClick={() => setQty(Math.max(1, (Number(qty) || 1) - 1))}
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={() => {
                if (qty === '' || Number(qty) < 1) setQty(1);
              }}
              className="w-24 text-center text-3xl font-bold border rounded-xl py-2"
            />
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-slate-100 text-2xl"
              onClick={() => setQty((Number(qty) || 0) + 1)}
            >
              +
            </button>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-slate-600">You are adding</div>
          <div className="text-2xl font-bold text-teal-700">{pieces} pieces</div>
          <div className="text-sm text-slate-500 mt-1">
            Current: {product.currentStock} → After: {product.currentStock + pieces}
          </div>
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <Btn onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Add Stock'}
        </Btn>
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
  const [price, setPrice] = useState<number | string>(product.defaultPricePerPiece);
  const [boxSize, setBoxSize] = useState<number | string>(product.boxSize);
  const [stock, setStock] = useState<number | string>(product.currentStock);
  const [low, setLow] = useState<number | string>(product.lowStockLimit);
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
      <button onClick={onBack} className="text-teal-700 mb-2 font-medium">
        ← Back
      </button>
      <Title>Edit Product</Title>
      <Card className="space-y-3">
        <label className="block">
          <span className="text-sm text-slate-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Description</span>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Default price per piece (₹)</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Pieces in one box</span>
          <input
            type="number"
            value={boxSize}
            onChange={(e) => setBoxSize(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Current stock (pieces)</span>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
          <div className="text-xs text-slate-400 mt-1">
            You can directly correct the stock number here.
          </div>
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Low stock warning at (pieces)</span>
          <input
            type="number"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <Btn onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Btn>
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
  const [qtys, setQtys] = useState<Record<string, number | string>>({});
  const [prices, setPrices] = useState<Record<string, number | string>>({});
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
    if (!units[id]) setUnits((u) => ({ ...u, [id]: 'box' }));
    if (qtys[id] === undefined) setQtys((q) => ({ ...q, [id]: 1 }));
  };

  const items = products
    .filter((p) => selected[p.id])
    .map((p) => {
      const unit = units[p.id] || 'box';
      const rawQty = qtys[p.id];
      const qty = rawQty === '' || rawQty === undefined ? 1 : Number(rawQty);
      const pieces = unit === 'box' ? qty * p.boxSize : qty;
      const rawPrice = prices[p.id];
      const price =
        rawPrice === '' || rawPrice === undefined
          ? p.defaultPricePerPiece
          : Number(rawPrice);
      return { productId: p.id, unit, quantity: qty, pieces, price, product: p };
    });

  const total = items.reduce((s, i) => s + i.pieces * i.price, 0);

  const save = async () => {
    if (items.length === 0) {
      setErr('Select at least one product');
      return;
    }
    for (const i of items) {
      if (i.quantity <= 0) {
        setErr('Quantity must be greater than 0');
        return;
      }
      if (i.pieces > i.product.currentStock) {
        setErr(
          `Not enough stock for ${i.product.name}. Only ${i.product.currentStock} pieces available.`
        );
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
      <button onClick={onBack} className="text-teal-700 mb-2 font-medium">
        ← Back
      </button>
      <Title>New Sale</Title>
      <Card className="mb-3">
        <div className="font-semibold mb-2">Select products</div>
        <div className="space-y-2">
          {products.map((p) => {
            const isOn = !!selected[p.id];
            const currentQty = qtys[p.id] !== undefined ? qtys[p.id] : 1;
            const currentUnit = units[p.id] || 'box';
            const numQty = currentQty === '' ? 1 : Number(currentQty);
            const calculatedPieces = currentUnit === 'box' ? numQty * p.boxSize : numQty;
            const rawPrice = prices[p.id];
            const activePrice =
              rawPrice === '' || rawPrice === undefined
                ? p.defaultPricePerPiece
                : Number(rawPrice);

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${isOn ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                  }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(p.id)}
                    className="w-5 h-5 accent-teal-700"
                  />
                  <img src={p.imageUrl} alt="" className="w-12 h-12 object-contain" />
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-slate-500">
                      Stock: {p.currentStock} pcs · Default {inr(p.defaultPricePerPiece)}/pc
                    </div>
                  </div>
                </label>
                {isOn && (
                  <div className="mt-3 pt-3 border-t border-teal-100 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <div className="text-xs text-slate-500 mb-1 font-medium">Unit</div>
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white h-10 p-0.5">
                          <button
                            type="button"
                            onClick={() => setUnits((u) => ({ ...u, [p.id]: 'box' }))}
                            className={`flex-1 rounded-md text-xs font-semibold transition ${currentUnit === 'box'
                                ? 'bg-teal-700 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            Box ({p.boxSize})
                          </button>
                          <button
                            type="button"
                            onClick={() => setUnits((u) => ({ ...u, [p.id]: 'piece' }))}
                            className={`flex-1 rounded-md text-xs font-semibold transition ${currentUnit === 'piece'
                                ? 'bg-teal-700 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            Piece
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 mb-1 font-medium">Quantity</div>
                        <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-white h-10 px-1">
                          <button
                            type="button"
                            className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 font-bold text-lg active:scale-95 flex items-center justify-center"
                            onClick={() => {
                              const cur = Number(qtys[p.id]) || 1;
                              if (cur <= 1) {
                                setSelected((s) => ({ ...s, [p.id]: false }));
                                setQtys((q) => ({ ...q, [p.id]: 1 }));
                              } else {
                                setQtys((q) => ({ ...q, [p.id]: cur - 1 }));
                              }
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentQty}
                            onChange={(e) =>
                              setQtys((q) => ({
                                ...q,
                                [p.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              if (currentQty === '' || Number(currentQty) <= 0) {
                                setSelected((s) => ({ ...s, [p.id]: false }));
                                setQtys((q) => ({ ...q, [p.id]: 1 }));
                              }
                            }}
                            className="w-12 text-center font-bold text-base bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 font-bold text-lg active:scale-95 flex items-center justify-center"
                            onClick={() =>
                              setQtys((q) => ({
                                ...q,
                                [p.id]: (Number(q[p.id]) || 0) + 1,
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <div className="text-xs text-slate-500 mb-1 font-medium">Rate (₹ / piece)</div>
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white h-10 px-2.5 focus-within:ring-2 focus-within:ring-teal-600 focus-within:border-teal-600 shadow-sm transition">
                          <span className="text-slate-400 font-semibold text-sm mr-1">₹</span>
                          <input
                            type="number"
                            value={rawPrice !== undefined ? rawPrice : p.defaultPricePerPiece}
                            onChange={(e) =>
                              setPrices((pr) => ({ ...pr, [p.id]: e.target.value }))
                            }
                            className="w-full font-bold text-slate-800 text-sm bg-transparent focus:outline-none"
                            placeholder={`${p.defaultPricePerPiece}`}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 mb-1 font-medium">Item Total</div>
                        <div className="flex items-center justify-between border border-teal-200 bg-teal-50/80 rounded-lg h-10 px-3">
                          <span className="text-xs text-slate-500 font-medium">
                            {calculatedPieces} pcs
                          </span>
                          <span className="text-sm font-bold text-teal-800">
                            {inr(calculatedPieces * activePrice)}
                          </span>
                        </div>
                      </div>
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
        <label className="block">
          <span className="text-sm text-slate-500">Customer name</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Walk-in"
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Phone number (optional)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            className="w-full border rounded-xl p-3 mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-500">Notes / description (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra detail about this sale"
            rows={2}
            className="w-full border rounded-xl p-3 mt-1 resize-none"
          />
        </label>
      </Card>
      {items.length > 0 && (
        <Card className="mb-3 bg-teal-50 border-teal-100">
          <div className="text-sm text-teal-800">Bill total</div>
          <div className="text-3xl font-bold text-teal-800">{inr(total)}</div>
          <div className="text-sm text-teal-700 mt-1">
            {items.length} product{items.length > 1 ? 's' : ''} ·{' '}
            {items.reduce((s, i) => s + i.pieces, 0)} pieces
          </div>
        </Card>
      )}
      {err && (
        <div className="mb-3 text-red-600 font-medium text-sm bg-red-50 p-3 rounded-xl">
          {err}
        </div>
      )}
      <div className="mb-24">
        <Btn onClick={save} disabled={saving || items.length === 0}>
          {saving ? 'Saving…' : 'Save Sale'}
        </Btn>
      </div>
    </>
  );
}

function AnalyticsScreen({
  sales,
  products,
  stats,
}: {
  sales: Sale[];
  products: Product[];
  stats: Stats | null;
}) {
  const [scale, setScale] = useState<'month' | 'week' | 'all'>('month');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sevenDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6
  ).setHours(0, 0, 0, 0);

  const filteredSales = sales.filter((s) => {
    if (scale === 'month') return s.soldAt >= startOfMonth;
    if (scale === 'week') return s.soldAt >= sevenDaysAgo;
    return true;
  });

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalBills = filteredSales.length;
  const avgBill = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;
  const totalPieces = filteredSales.reduce(
    (acc, s) => acc + s.items.reduce((sum, it) => sum + it.pieces, 0),
    0
  );

  type Bucket = {
    key: string;
    label: string;
    shortLabel: string;
    sublabel: string;
    revenue: number;
    count: number;
    pieces: number;
  };

  let buckets: Bucket[] = [];

  if (scale === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toDateString();
      const daySales = filteredSales.filter(
        (s) => new Date(s.soldAt).toDateString() === dateStr
      );
      const rev = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      const pcs = daySales.reduce(
        (acc, s) => acc + s.items.reduce((pAcc, it) => pAcc + it.pieces, 0),
        0
      );
      buckets.push({
        key: dateStr,
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        shortLabel: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        sublabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue: rev,
        count: daySales.length,
        pieces: pcs,
      });
    }
  } else if (scale === 'month') {
    const totalDaysToShow = Math.max(7, now.getDate());
    const startDay = Math.max(1, now.getDate() - 6);
    const endDay = Math.max(startDay + 6, now.getDate());

    for (let d = startDay; d <= endDay; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      const dateStr = dt.toDateString();
      const daySales = filteredSales.filter(
        (s) => new Date(s.soldAt).toDateString() === dateStr
      );
      const rev = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      const pcs = daySales.reduce(
        (acc, s) => acc + s.items.reduce((pAcc, it) => pAcc + it.pieces, 0),
        0
      );
      buckets.push({
        key: dateStr,
        label: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        shortLabel: `${d} ${dt.toLocaleDateString('en-IN', { month: 'short' })}`,
        sublabel: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
        revenue: rev,
        count: daySales.length,
        pieces: pcs,
      });
    }
  } else {
    const monthMap = new Map<
      string,
      { label: string; shortLabel: string; sublabel: string; rev: number; count: number; pcs: number; ts: number }
    >();

    for (let m = 5; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      monthMap.set(key, {
        label: dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        shortLabel: dt.toLocaleDateString('en-IN', { month: 'short' }),
        sublabel: String(dt.getFullYear()),
        rev: 0,
        count: 0,
        pcs: 0,
        ts: dt.getTime(),
      });
    }

    for (const s of filteredSales) {
      const dt = new Date(s.soldAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          label: dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          shortLabel: dt.toLocaleDateString('en-IN', { month: 'short' }),
          sublabel: String(dt.getFullYear()),
          rev: 0,
          count: 0,
          pcs: 0,
          ts: new Date(dt.getFullYear(), dt.getMonth(), 1).getTime(),
        });
      }
      const entry = monthMap.get(key)!;
      entry.rev += s.totalAmount;
      entry.count += 1;
      entry.pcs += s.items.reduce((acc, it) => acc + it.pieces, 0);
    }

    const sorted = Array.from(monthMap.values()).sort((a, b) => a.ts - b.ts);
    buckets = sorted.map((m) => ({
      key: `${m.ts}`,
      label: m.label,
      shortLabel: m.shortLabel,
      sublabel: m.sublabel,
      revenue: m.rev,
      count: m.count,
      pieces: m.pcs,
    }));
  }

  const rawMax = Math.max(...buckets.map((b) => b.revenue), 0);
  const niceScale = (() => {
    const safeMax = Math.max(rawMax, 1000);
    const magnitude = Math.pow(10, Math.floor(Math.log10(safeMax)));
    const factor = safeMax / magnitude;
    let niceFactor = 10;
    if (factor <= 1) niceFactor = 1;
    else if (factor <= 1.5) niceFactor = 1.5;
    else if (factor <= 2) niceFactor = 2;
    else if (factor <= 3) niceFactor = 3;
    else if (factor <= 4) niceFactor = 4;
    else if (factor <= 5) niceFactor = 5;
    else if (factor <= 6) niceFactor = 6;
    else if (factor <= 8) niceFactor = 8;
    const niceMax = niceFactor * magnitude;
    const steps = [
      niceMax,
      niceMax * 0.75,
      niceMax * 0.5,
      niceMax * 0.25,
      0,
    ];
    return { max: niceMax, steps };
  })();

  const svgW = 500;
  const svgH = 200;
  const padL = 56;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const baseY = padT + chartH;

  const points = buckets.map((b, i) => {
    const x = padL + (i / Math.max(1, buckets.length - 1)) * chartW;
    const y = baseY - (b.revenue / niceScale.max) * chartH;
    return { x, y, bucket: b, index: i };
  });

  const pathStrings = (() => {
    if (points.length === 0) return { line: '', area: '' };
    if (points.length === 1) {
      const pt = points[0];
      return {
        line: `M ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y}`,
        area: `M ${pt.x - 20} ${baseY} L ${pt.x - 20} ${pt.y} L ${pt.x + 20} ${pt.y} L ${pt.x + 20} ${baseY} Z`,
      };
    }
    let line = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    const first = points[0];
    const area = `${line} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    return { line, area };
  })();

  const activeIndex =
    selectedIndex !== null
      ? selectedIndex
      : points.slice().reverse().find((p) => p.bucket.revenue > 0)?.index ?? (points.length - 1);

  const activePoint = points[activeIndex];

  const productStats = products.map((p) => {
    let pieces = 0;
    let revenue = 0;
    for (const s of filteredSales) {
      for (const it of s.items) {
        if (it.productId === p.id) {
          pieces += it.pieces;
          revenue += it.lineTotal;
        }
      }
    }
    const pct = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
    return { product: p, pieces, revenue, pct };
  });

  return (
    <>
      <Title>Sales Analytics</Title>

      <div className="flex rounded-xl border border-slate-200 bg-white p-1 mb-3 shadow-sm">
        {(
          [
            ['month', 'This Month'],
            ['week', 'Last 7 Days'],
            ['all', 'All Time'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setScale(k);
              setSelectedIndex(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              scale === k
                ? 'bg-teal-700 text-white shadow'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Card className="bg-teal-50/70 border-teal-100">
          <div className="text-xs text-teal-800 font-medium">Revenue</div>
          <div className="text-2xl font-bold text-teal-900 mt-0.5">
            {inr(totalRevenue)}
          </div>
          <div className="text-[11px] text-teal-700 mt-1">
            {totalBills} sale{totalBills === 1 ? '' : 's'} recorded
          </div>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Avg Bill / Sale</div>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">
            {inr(avgBill)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalPieces} total pieces sold
          </div>
        </Card>
      </div>

      <Card className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-semibold text-slate-800">Revenue Trend</div>
            <div className="text-xs text-slate-500">
              {scale === 'week'
                ? 'Daily performance (Last 7 days)'
                : scale === 'month'
                ? 'Daily performance this month'
                : 'Monthly performance overview'}
            </div>
          </div>
          {rawMax > 0 && (
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
              Peak: {inr(rawMax)}
            </span>
          )}
        </div>

        <div className="w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-auto overflow-visible"
            style={{ maxHeight: '230px' }}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0f766e" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {niceScale.steps.map((val, idx) => {
              const y = padT + (idx / 4) * chartH;
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={idx === 4 ? '' : '3 3'}
                    strokeWidth={idx === 4 ? '1.5' : '1'}
                  />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                    fontWeight="500"
                  >
                    {val >= 1000 ? `₹${val / 1000}k` : `₹${val}`}
                  </text>
                </g>
              );
            })}

            {pathStrings.area && (
              <path d={pathStrings.area} fill="url(#chartGradient)" />
            )}

            {pathStrings.line && (
              <path
                d={pathStrings.line}
                fill="none"
                stroke="#0f766e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {activePoint && (
              <line
                x1={activePoint.x}
                y1={padT}
                x2={activePoint.x}
                y2={baseY}
                stroke="#0f766e"
                strokeDasharray="2 2"
                strokeWidth="1.5"
                opacity="0.6"
              />
            )}

            {points.map((pt) => {
              const isSelected = activeIndex === pt.index;
              return (
                <g
                  key={pt.index}
                  className="cursor-pointer"
                  onClick={() => setSelectedIndex(pt.index)}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 10 : 8}
                    fill="transparent"
                  />
                  {isSelected && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="7"
                      fill="#0f766e"
                      fillOpacity="0.25"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 4.5 : 3.5}
                    fill={pt.bucket.revenue > 0 ? '#0f766e' : '#94a3b8'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  <text
                    x={pt.x}
                    y={svgH - 12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill={isSelected ? '#0f766e' : '#64748b'}
                    fontWeight={isSelected ? '700' : '500'}
                  >
                    {pt.bucket.shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {activePoint && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/90 rounded-xl p-2.5">
            <div>
              <div className="font-bold text-slate-800">
                {activePoint.bucket.label}
              </div>
              <div className="text-slate-500 text-[11px]">
                {activePoint.bucket.count} bill{activePoint.bucket.count === 1 ? '' : 's'} · {activePoint.bucket.pieces} pcs sold
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-teal-800">
                {inr(activePoint.bucket.revenue)}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-3">
        <div className="font-semibold mb-1">Product Breakdown</div>
        <div className="text-xs text-slate-500 mb-3">
          Sales volume & revenue share for the selected period
        </div>

        <div className="space-y-3">
          {productStats.map(({ product: p, pieces, revenue, pct }) => (
            <div key={p.id} className="p-2.5 border border-slate-200 rounded-xl bg-white">
              <div className="flex items-center gap-2.5 mb-2">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-10 h-10 object-contain rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {pieces} pcs sold · Default {inr(p.defaultPricePerPiece)}/pc
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-teal-800">{inr(revenue)}</div>
                  <div className="text-[11px] font-semibold text-teal-600">{pct}% share</div>
                </div>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-24">
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          className="w-full flex items-center justify-between text-left font-medium text-slate-600 text-sm"
        >
          <span>ℹ️ App & Database Settings</span>
          <span className="text-slate-400 text-xs">{showSettings ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showSettings && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div>
              <b>Database:</b> Stored in MongoDB Atlas. Keep API key secure.
            </div>
            <div>
              <b>Calculation:</b> Stock is tracked in pieces. 1 Box = {products[0]?.boxSize || 10} pieces.
            </div>
            <div>
              <b>Current Stock in Inventory:</b>{' '}
              {products.map((p) => `${p.name}: ${p.currentStock} pcs`).join(' · ')}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, list, logs] = await Promise.all([
        api.getStats(),
        api.getSales(150),
        api.getStockLog(30),
      ]);
      setStats(s);
      setSales(list);
      setStockLogs(logs);
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
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-800">Inventory Manager</h1>
            <p className="text-sm text-slate-500">Good day</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card className="flex flex-col justify-between">
              <div>
                <div className="text-slate-500 text-sm">Total Stock</div>
                <div className="text-2xl font-bold mt-0.5">{products.reduce((s, p) => s + p.currentStock, 0)}<span className="text-base font-normal text-slate-500"> pcs</span></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
                {products.map((p) => (
                  <div key={p.id} className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium truncate">
                      {p.id === 'detergent' ? 'Detergent' : p.id === 'descal' ? 'Descal' : p.name}
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {p.currentStock} <span className="text-[10px] font-normal text-slate-500">pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col justify-between">
              <div>
                <div className="text-slate-500 text-sm">Sales this month</div>
                <div className="text-2xl font-bold mt-0.5 text-teal-700">{inr(stats.month.revenue)}</div>
              </div>
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">{stats.month.saleCount} bills · {stats.month.pieces} pcs</div>
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
          <div className="space-y-3 mb-4">
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

          <Card className="mb-20">
            <div className="font-semibold text-slate-800 mb-2">Stock Activity Log</div>
            {stockLogs.length === 0 && (
              <div className="text-sm text-slate-500 py-2">No stock updates yet.</div>
            )}
            <div className="divide-y divide-slate-100">
              {stockLogs.map((log) => {
                const prod = getP(log.productId);
                const prodName = prod ? prod.name : log.productId;
                return (
                  <div key={log._id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-slate-800">{prodName}</div>
                      <div className="text-xs text-slate-400">
                        {day(log.at)} · {time(log.at)}
                      </div>
                    </div>
                    <div className="text-right">
                      {log.type === 'add' && (
                        <div>
                          <span className="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            +{log.pieces} pcs added
                          </span>
                          {log.unit === 'box' && (
                            <div className="text-[11px] text-slate-400">
                              {log.quantity} {log.quantity > 1 ? 'boxes' : 'box'}
                            </div>
                          )}
                        </div>
                      )}
                      {log.type === 'sale' && (
                        <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {log.pieces} pcs sold
                        </span>
                      )}
                      {log.type === 'manual_edit' && (
                        <div>
                          <span className="inline-block text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            {log.pieces > 0 ? `+${log.pieces}` : log.pieces} pcs adjusted
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {log.oldStock} → {log.newStock} pcs
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
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
        <AnalyticsScreen sales={sales} products={products} stats={stats} />
      )}

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t grid grid-cols-4 pb-[env(safe-area-inset-bottom)] max-w-lg mx-auto">
        {([['home', '🏠', 'Home'], ['inventory', '📦', 'Stock'], ['sales', '🧾', 'Sales'], ['more', '📊', 'Analytics']] as const).map(([k, icon, label]) => (
          <button key={k} type="button" onClick={() => go(k)} className={`py-3 text-sm ${tab === k ? 'text-teal-700 font-bold' : 'text-slate-500'}`}>
            <div className="text-xl">{icon}</div>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
