import { ObjectId } from 'mongodb';

export type ProductId = 'detergent' | 'descal' | string;
export type UnitType = 'box' | 'piece';
export type StockLogType = 'add' | 'sale' | 'manual_edit';

export interface Product {
  _id?: ObjectId | string;
  id: ProductId;
  name: string;
  description: string;
  imageUrl: string;
  defaultPricePerPiece: number;
  boxSize: number;
  currentStock: number;
  lowStockLimit: number;
  updatedAt: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  defaultPricePerPiece?: number | string;
  boxSize?: number | string;
  currentStock?: number | string;
  lowStockLimit?: number | string;
  imageUrl?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  unit: UnitType;
  quantity: number;
  pieces: number;
  pricePerPiece: number;
  lineTotal: number;
}

export interface Sale {
  _id: ObjectId | string;
  customerId?: string | ObjectId | null;
  customerName: string;
  phone?: string | null;
  notes?: string | null;
  items: SaleItem[];
  totalAmount: number;
  soldAt: number;
  createdAt: number;
}

export interface Customer {
  _id: ObjectId | string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  totalOrders: number;
  totalSpend: number;
  createdAt: number;
  updatedAt: number;
}

export interface StockLog {
  _id?: ObjectId | string;
  productId: string;
  type: StockLogType;
  unit?: UnitType | string | null;
  quantity?: number | null;
  pieces: number;
  oldStock?: number | null;
  newStock?: number | null;
  at: number;
}

export interface MonthlyStats {
  pieces: number;
  revenue: number;
  saleCount: number;
  byProduct: Record<string, { pieces: number; revenue: number }>;
}

export interface DashboardStats {
  products: Product[];
  month: MonthlyStats;
}

export interface HealthResponse {
  ok: boolean;
  database: 'connected' | 'disconnected';
  target: string;
  dbName: string;
  counts: {
    products: number;
    sales: number;
    stockLogs: number;
    customers: number;
  };
  latencyMs: number;
  timestamp: number;
}

export interface DbStatusResponse {
  database: string;
  dbName: string;
  isCloud: boolean;
  collections: {
    products: { count: number; data: Product[] };
    sales: { count: number };
    stockLog: { count: number };
    customers: { count: number };
  };
  status: 'healthy' | 'degraded';
}
