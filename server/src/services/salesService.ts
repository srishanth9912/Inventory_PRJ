import { ObjectId } from 'mongodb';
import { getCollections, getMongoClient } from '../db/connection.js';
import type { Sale, SaleItem, UnitType } from '../types/index.js';

export interface CreateSaleParams {
  customerId?: string | null;
  customerName?: string;
  phone?: string | null;
  notes?: string | null;
  soldAt?: number | null;
  items: Array<{
    productId: string;
    unit: UnitType;
    quantity: number;
    pricePerPiece?: number;
  }>;
}

export async function getSales(limit = 25, customerId?: string, skip = 0): Promise<Sale[]> {
  const { sales } = getCollections();
  const boundedLimit = Math.min(Math.max(limit, 1), 1000);
  const safeSkip = Math.max(0, skip);
  const filter: Record<string, unknown> = {};
  if (customerId) {
    const validOid = ObjectId.isValid(customerId);
    filter.$or = [
      { customerId: customerId },
      ...(validOid ? [{ customerId: new ObjectId(customerId) }] : []),
    ];
  }
  return sales.find(filter).sort({ soldAt: -1 }).skip(safeSkip).limit(boundedLimit).toArray();
}

export async function createSale(params: CreateSaleParams): Promise<Sale> {
  const { customerId, customerName, phone, notes, items, soldAt } = params;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Add at least one product');
  }

  const { products, sales, stockLog, customers } = getCollections();
  const client = getMongoClient();

  const now = Date.now();
  const saleTimestamp = soldAt && !Number.isNaN(+soldAt) && +soldAt > 0 ? +soldAt : now;
  const lineItems: SaleItem[] = [];
  const neededPerProduct: Record<string, number> = {};
  let totalAmount = 0;

  // 1. Validate line items and calculate pieces & totals
  for (const item of items) {
    const p = await products.findOne({ id: item.productId });
    if (!p) throw new Error(`Product "${item.productId}" not found`);

    const qty = +item.quantity;
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      throw new Error(`Invalid quantity for ${p.name}`);
    }

    const unit: UnitType = item.unit === 'box' ? 'box' : 'piece';
    const pieces = unit === 'box' ? qty * p.boxSize : qty;
    const price =
      item.pricePerPiece != null ? +item.pricePerPiece : p.defaultPricePerPiece;
    if (Number.isNaN(price) || price < 0) {
      throw new Error('Price cannot be negative');
    }

    const lineTotal = pieces * price;
    totalAmount += lineTotal;
    neededPerProduct[p.id] = (neededPerProduct[p.id] || 0) + pieces;

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

  // 2. Prepare the Sale document
  const sale: Sale = {
    _id: new ObjectId(),
    customerId: customerId || null,
    customerName: (customerName || '').trim() || 'Walk-in',
    phone: (phone || '').trim() || null,
    notes: (notes || '').trim() || null,
    items: lineItems,
    totalAmount,
    soldAt: saleTimestamp,
    createdAt: now,
  };

  // 3. Execute with MongoDB Multi-Document ACID Transaction
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // A. Verify and deduct stock atomically
      for (const [prodId, requiredPieces] of Object.entries(neededPerProduct)) {
        const updateRes = await products.updateOne(
          { id: prodId, currentStock: { $gte: requiredPieces } },
          { $inc: { currentStock: -requiredPieces }, $set: { updatedAt: now } },
          { session }
        );

        if (updateRes.modifiedCount === 0) {
          const prodDoc = await products.findOne({ id: prodId }, { session });
          const available = prodDoc ? prodDoc.currentStock : 0;
          throw new Error(
            `Not enough stock for ${prodDoc?.name || prodId}. Available: ${available} pieces.`
          );
        }
      }

      // B. Insert stock movement audit logs
      const logEntries = lineItems.map((li) => ({
        productId: li.productId,
        type: 'sale' as const,
        unit: li.unit,
        quantity: li.quantity,
        pieces: -li.pieces,
        at: saleTimestamp,
      }));
      await stockLog.insertMany(logEntries, { session });

      // C. Insert the sale record
      await sales.insertOne(sale, { session });

      // D. Update or register customer metrics
      if (customerId) {
        const filter = ObjectId.isValid(customerId)
          ? { _id: new ObjectId(customerId) }
          : { _id: customerId };
        await customers.updateOne(
          filter as any,
          {
            $inc: { totalOrders: 1, totalSpend: totalAmount },
            $set: { updatedAt: now },
          },
          { session }
        );
      } else if (sale.customerName !== 'Walk-in' || sale.phone) {
        const existingCust = sale.phone
          ? await customers.findOne({ phone: sale.phone }, { session })
          : null;

        if (existingCust) {
          await customers.updateOne(
            { _id: existingCust._id },
            {
              $set: {
                name: sale.customerName || existingCust.name,
                phone: sale.phone || existingCust.phone,
                updatedAt: now,
              },
              $inc: { totalOrders: 1, totalSpend: totalAmount },
            },
            { session }
          );
        } else {
          await customers.insertOne(
            {
              _id: new ObjectId(),
              name: sale.customerName,
              phone: sale.phone,
              notes: null,
              totalOrders: 1,
              totalSpend: totalAmount,
              createdAt: now,
              updatedAt: now,
            },
            { session }
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return sale;
}
