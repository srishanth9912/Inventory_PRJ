import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('ERROR: MONGODB_URI is not set in .env');
  process.exit(1);
}

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const client = await new MongoClient(uri).connect();
const db = client.db();
const products = db.collection('products');
const sales = db.collection('sales');
const stockLog = db.collection('stock_log');

// Ensure seed products exist
const SEED = [
  {
    id: 'detergent',
    name: 'IFB Liquid Detergent',
    description: '945 ml',
    imageUrl: '/products/detergent.svg',
    defaultPricePerPiece: 40,
    boxSize: 10,
    currentStock: 0,
    lowStockLimit: 20,
    updatedAt: Date.now(),
  },
  {
    id: 'descal',
    name: 'IFB Descal',
    description: '100 g',
    imageUrl: '/products/descal.svg',
    defaultPricePerPiece: 200,
    boxSize: 10,
    currentStock: 0,
    lowStockLimit: 20,
    updatedAt: Date.now(),
  },
];

for (const p of SEED) {
  await products.updateOne({ id: p.id }, { $setOnInsert: p }, { upsert: true });
}

// Auth
app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'OPTIONS') return;
  if (req.url === '/health') return;
  const key = process.env.API_KEY;
  if (key && req.headers['x-api-key'] !== key) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

function bad(reply: any, msg: string, code = 400) {
  return reply.code(code).send({ error: msg });
}

// ---------- Products ----------
app.get('/products', async () => {
  return products.find({}).sort({ id: 1 }).toArray();
});

app.patch('/products/:id', async (req: any, reply) => {
  const { id } = req.params;
  const body = req.body || {};
  const current = await products.findOne({ id });
  if (!current) return bad(reply, 'Product not found', 404);

  const allowed = [
    'name',
    'description',
    'defaultPricePerPiece',
    'boxSize',
    'currentStock',
    'lowStockLimit',
    'imageUrl',
  ];
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  if (body.currentStock !== undefined && body.currentStock !== current.currentStock) {
    await stockLog.insertOne({
      productId: id,
      type: 'manual_edit',
      pieces: body.currentStock - current.currentStock,
      oldStock: current.currentStock,
      newStock: body.currentStock,
      at: Date.now(),
    });
  }

  await products.updateOne({ id }, { $set: update });
  return products.findOne({ id });
});

// ---------- Stock ----------
app.get('/stock/log', async (req: any) => {
  const limit = Math.min(+(req.query.limit || 30), 100);
  return stockLog.find({}).sort({ at: -1 }).limit(limit).toArray();
});

app.post('/stock/add', async (req: any, reply) => {
  const { productId, unit, quantity } = req.body || {};
  if (!productId || !quantity || quantity <= 0) {
    return bad(reply, 'Invalid quantity');
  }
  const p = await products.findOne({ id: productId });
  if (!p) return bad(reply, 'Product not found', 404);

  const pieces = unit === 'box' ? quantity * p.boxSize : quantity;
  const now = Date.now();

  await products.updateOne(
    { id: productId },
    { $inc: { currentStock: pieces }, $set: { updatedAt: now } }
  );
  await stockLog.insertOne({
    productId,
    type: 'add',
    unit,
    quantity,
    pieces,
    at: now,
  });

  return products.findOne({ id: productId });
});

// ---------- Sales ----------
app.get('/sales', async (req: any) => {
  const limit = Math.min(+(req.query.limit || 100), 500);
  return sales.find({}).sort({ soldAt: -1 }).limit(limit).toArray();
});

app.post('/sales', async (req: any, reply) => {
  const { customerName, phone, notes, items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return bad(reply, 'Add at least one product');
  }

  const now = Date.now();
  const lineItems: any[] = [];
  let totalAmount = 0;

  // Validate & calculate everything on server
  for (const item of items) {
    const p = await products.findOne({ id: item.productId });
    if (!p) return bad(reply, `Product ${item.productId} not found`, 404);

    const qty = +item.quantity;
    if (!qty || qty <= 0) return bad(reply, 'Invalid quantity');

    const unit = item.unit === 'box' ? 'box' : 'piece';
    const pieces = unit === 'box' ? qty * p.boxSize : qty;
    const price =
      item.pricePerPiece != null ? +item.pricePerPiece : p.defaultPricePerPiece;
    if (Number.isNaN(price) || price < 0) {
      return bad(reply, 'Price cannot be negative');
    }

    if (p.currentStock < pieces) {
      return bad(
        reply,
        `Not enough stock for ${p.name}. Available: ${p.currentStock} pieces`
      );
    }

    const lineTotal = pieces * price;
    totalAmount += lineTotal;

    lineItems.push({
      productId: p.id,
      productName: p.name,
      unit,
      quantity: qty,
      pieces,
      pricePerPiece: price,
      lineTotal,
    });
  }

  // Deduct stock + create sale
  for (const li of lineItems) {
    await products.updateOne(
      { id: li.productId },
      { $inc: { currentStock: -li.pieces }, $set: { updatedAt: now } }
    );
    await stockLog.insertOne({
      productId: li.productId,
      type: 'sale',
      unit: li.unit,
      quantity: li.quantity,
      pieces: -li.pieces,
      at: now,
    });
  }

  const sale = {
    _id: new ObjectId(),
    customerName: (customerName || '').trim() || 'Walk-in',
    phone: (phone || '').trim() || null,
    notes: (notes || '').trim() || null,
    items: lineItems,
    totalAmount,
    soldAt: now,
    createdAt: now,
  };

  await sales.insertOne(sale);
  return sale;
});

// ---------- Dashboard ----------
app.get('/stats', async () => {
  const prods = await products.find({}).toArray();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const ms = monthStart.getTime();

  const monthSales = await sales.find({ soldAt: { $gte: ms } }).toArray();

  let monthPieces = 0;
  let monthRevenue = 0;
  const byProduct: Record<string, { pieces: number; revenue: number }> = {};

  for (const s of monthSales) {
    monthRevenue += s.totalAmount || 0;
    for (const it of s.items || []) {
      monthPieces += it.pieces || 0;
      if (!byProduct[it.productId]) {
        byProduct[it.productId] = { pieces: 0, revenue: 0 };
      }
      byProduct[it.productId].pieces += it.pieces || 0;
      byProduct[it.productId].revenue += it.lineTotal || 0;
    }
  }

  return {
    products: prods,
    month: {
      pieces: monthPieces,
      revenue: monthRevenue,
      saleCount: monthSales.length,
      byProduct,
    },
  };
});

// Health check (no auth)
app.get('/health', async () => ({ ok: true }));

const port = +(process.env.PORT || 8787);
await app.listen({ port, host: '0.0.0.0' });
console.log(`IFB server running on http://0.0.0.0:${port}`);
