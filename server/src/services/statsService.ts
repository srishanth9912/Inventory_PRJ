import { getCollections } from '../db/connection.js';
import type { DashboardStats } from '../types/index.js';

export async function getDashboardStats(): Promise<DashboardStats> {
  const { products, sales } = getCollections();

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
      byProduct[it.productId]!.pieces += it.pieces || 0;
      byProduct[it.productId]!.revenue += it.lineTotal || 0;
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
}
