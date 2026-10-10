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

  if (items.length > 100) {
    throw new Error('Cannot add more than 100 items per sale');
  }

  const now = Date.now();
  let saleTimestamp = now;
  if (soldAt !== undefined && soldAt !== null) {
    const ts = Number(soldAt);
    if (!Number.isFinite(ts) || ts < 946684800000 || ts > now + 365 * 24 * 60 * 60 * 1000) {
      throw new Error('Invalid sale date');
    }
    saleTimestamp = ts;
  }

  // Sanitize customer strings
  const cleanCustomerName = String(customerName || '').trim().slice(0, 100);
  const cleanPhone = String(phone || '').trim().slice(0, 25);
  const cleanNotes = String(notes || '').trim().slice(0, 500);

  if (cleanPhone && !/^[+0-9()\-\s]{7,25}$/.test(cleanPhone)) {
    throw new Error('Enter a valid phone number');
  }

  // Pre-validate line item types and values
  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string' || item.productId.length > 100) {
      throw new Error('Invalid product ID');
    }

    if (item.unit !== 'box' && item.unit !== 'piece') {
      throw new Error(`Invalid unit "${item.unit}". Supported units are "box" and "piece".`);
    }

    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || !Number.isFinite(qty) || qty <= 0 || qty > 100000) {
      throw new Error('Invalid quantity. Quantity must be a positive integer.');
    }

    if (item.pricePerPiece != null) {
      const price = Number(item.pricePerPiece);
      if (!Number.isFinite(price) || price < 0 || price > 10000000) {
        throw new Error('Price cannot be negative or invalid');
      }
    }
  }

  const { products, sales, stockLog, customers } = getCollections();

  // Validate customer existence if customerId is provided
  if (customerId) {
    const filter = ObjectId.isValid(customerId)
      ? { _id: new ObjectId(customerId) }
      : { _id: customerId };
    const existingCust = await customers.findOne(filter as any);
    if (!existingCust) {
      throw new Error(`Customer with ID "${customerId}" not found`);
    }
  }

  const lineItems: SaleItem[] = [];
  const neededPerProduct: Record<string, number> = {};
  let rawTotalAmount = 0;

  // 1. Validate line items against DB products and calculate pieces & totals
  for (const item of items) {
    const p = await products.findOne({ id: item.productId });
    if (!p) throw new Error(`Product "${item.productId}" not found`);

    const qty = Number(item.quantity);
    const unit: UnitType = item.unit;
    const pieces = unit === 'box' ? qty * p.boxSize : qty;
    const price =
      item.pricePerPiece != null ? Number(item.pricePerPiece) : p.defaultPricePerPiece;

    const lineTotal = Math.round(pieces * price * 100) / 100;
    rawTotalAmount += lineTotal;
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

  const totalAmount = Math.round(rawTotalAmount * 100) / 100;

  // 2. Prepare the Sale document
  const sale: Sale = {
    _id: new ObjectId(),
    customerId: customerId || null,
    customerName: cleanCustomerName || 'Walk-in',
    phone: cleanPhone || null,
    notes: cleanNotes || null,
    items: lineItems,
    totalAmount,
    soldAt: saleTimestamp,
    createdAt: now,
  };

  // 3. Execute with MongoDB Multi-Document ACID Transaction (or safe fallback)
  const client = getMongoClient();
  const session = client.startSession();

  try {
    const executeInSession = async (sess?: any) => {
      const options = sess ? { session: sess } : {};
      const deductedStock: Array<{ prodId: string; pieces: number }> = [];

      try {
        // A. Verify and deduct stock atomically
        for (const [prodId, requiredPieces] of Object.entries(neededPerProduct)) {
          const updateRes = await products.updateOne(
            { id: prodId, currentStock: { $gte: requiredPieces } },
            { $inc: { currentStock: -requiredPieces }, $set: { updatedAt: now } },
            options
          );

          if (updateRes.modifiedCount === 0) {
            const prodDoc = await products.findOne({ id: prodId }, options);
            const available = prodDoc ? prodDoc.currentStock : 0;
            throw new Error(
              `Not enough stock for ${prodDoc?.name || prodId}. Available: ${available} pieces.`
            );
          }
          deductedStock.push({ prodId, pieces: requiredPieces });
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
        await stockLog.insertMany(logEntries, options);

        // C. Insert the sale record
        await sales.insertOne(sale, options);

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
            options
          );
        } else if (sale.customerName !== 'Walk-in' || sale.phone) {
          const existingCust = sale.phone
            ? await customers.findOne({ phone: sale.phone }, options)
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
              options
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
              options
            );
          }
        }
      } catch (opErr) {
        // In standalone mode without transactions, compensate by rolling back deducted stock
        if (!sess && deductedStock.length > 0) {
          for (const deduction of deductedStock) {
            try {
              await products.updateOne(
                { id: deduction.prodId },
                { $inc: { currentStock: deduction.pieces } }
              );
            } catch {
              // ignore compensation error and continue rolling back
            }
          }
        }
        throw opErr;
      }
    };

    try {
      await session.withTransaction(async () => {
        await executeInSession(session);
      });
    } catch (txErr: any) {
      if (
        txErr?.message?.includes('Transaction numbers are only allowed') ||
        txErr?.message?.includes('replica set')
      ) {
        await executeInSession();
      } else {
        throw txErr;
      }
    }
  } finally {
    await session.endSession();
  }

  return sale;
}

