import { getCollections } from '../db/connection.js';
import type { DashboardStats } from '../types/index.js';

export async function getDashboardStats(): Promise<DashboardStats> {
  const { products, sales } = getCollections();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const ms = monthStart.getTime();

  const [prods, aggResults] = await Promise.all([
    products.find({}).sort({ id: 1 }).toArray(),
    sales
      .aggregate<{
        totals: Array<{ monthRevenue: number; saleCount: number }>;
        byProduct: Array<{ _id: string; pieces: number; revenue: number }>;
      }>([
        { $match: { soldAt: { $gte: ms } } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  monthRevenue: { $sum: '$totalAmount' },
                  saleCount: { $sum: 1 },
                },
              },
            ],
            byProduct: [
              { $unwind: '$items' },
              {
                $group: {
                  _id: '$items.productId',
                  pieces: { $sum: '$items.pieces' },
                  revenue: { $sum: '$items.lineTotal' },
                },
              },
            ],
          },
        },
      ])
      .toArray(),
  ]);

  const facetData = aggResults[0];
  const totals = facetData?.totals[0];
  const byProductList = facetData?.byProduct || [];

  let monthPieces = 0;
  const byProduct: Record<string, { pieces: number; revenue: number }> = {};

  for (const item of byProductList) {
    if (!item._id) continue;
    monthPieces += item.pieces || 0;
    byProduct[item._id] = {
      pieces: item.pieces || 0,
      revenue: item.revenue || 0,
    };
  }

  return {
    products: prods,
    month: {
      pieces: monthPieces,
      revenue: totals?.monthRevenue || 0,
      saleCount: totals?.saleCount || 0,
      byProduct,
    },
  };
}

