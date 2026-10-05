import { ObjectId } from 'mongodb';
import { getCollections } from '../db/connection.js';
import type { Customer } from '../types/index.js';

export async function getCustomers(limit = 200): Promise<Customer[]> {
  const { customers } = getCollections();
  const boundedLimit = Math.min(Math.max(limit, 1), 500);
  return customers.find({}).sort({ updatedAt: -1 }).limit(boundedLimit).toArray();
}

export async function createOrUpdateCustomer(input: {
  name: string;
  phone?: string;
  notes?: string;
}): Promise<Customer> {
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim();
  const notes = String(input.notes || '').trim();

  if (!name) throw new Error('Customer name is required');
  if (phone && !/^[+0-9()\-\s]{7,20}$/.test(phone)) {
    throw new Error('Enter a valid phone number');
  }

  const { customers } = getCollections();
  const now = Date.now();
  const existing = phone ? await customers.findOne({ phone }) : null;

  if (existing) {
    await customers.updateOne(
      { _id: existing._id },
      { $set: { name, notes: notes || existing.notes || null, updatedAt: now } }
    );
    const updated = await customers.findOne({ _id: existing._id });
    if (!updated) throw new Error('Customer update failed');
    return updated;
  }

  const newCustomer: Customer = {
    _id: new ObjectId(),
    name,
    phone: phone || null,
    notes: notes || null,
    totalOrders: 0,
    totalSpend: 0,
    createdAt: now,
    updatedAt: now,
  };

  await customers.insertOne(newCustomer);
  return newCustomer;
}

export async function updateCustomerById(
  id: string,
  data: { name?: string; phone?: string; notes?: string }
): Promise<Customer> {
  const { customers } = getCollections();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
  const current = await customers.findOne(filter as any);
  if (!current) throw new Error('Customer not found');

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (!name) throw new Error('Customer name cannot be empty');
    updates.name = name;
  }
  if (data.phone !== undefined) {
    const phone = String(data.phone).trim();
    if (phone && !/^[+0-9()\-\s]{7,20}$/.test(phone)) {
      throw new Error('Enter a valid phone number');
    }
    updates.phone = phone || null;
  }
  if (data.notes !== undefined) {
    updates.notes = String(data.notes).trim() || null;
  }

  await customers.updateOne(filter as any, { $set: updates });
  const updated = await customers.findOne(filter as any);
  if (!updated) throw new Error('Customer update failed');
  return updated;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const { customers } = getCollections();
  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
  const res = await customers.deleteOne(filter as any);
  return res.deletedCount > 0;
}
