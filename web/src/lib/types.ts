export type Method = 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto';

export interface Store {
  id: number;
  slug: string;
  name: string;
  kind: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  color: string;
  receipt_note: string | null;
  is_demo: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'cajero';
}

export interface Category {
  id: number;
  name: string;
  color: string;
  products?: number;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: number | null;
  unit: 'und' | 'kg' | 'lt' | 'lb' | 'm';
  cost: number;
  price: number;
  margin: number;
  stock: number;
  min_stock: number;
  low: boolean;
  image_url: string | null;
  emoji: string | null;
  active: boolean;
  in_catalog: boolean;
  updated_at: string;
}

export interface Move {
  id: number;
  kind: 'entrada' | 'ajuste' | 'merma' | 'venta' | 'anulacion';
  qty: number;
  stock_after: number;
  unit_cost: number | null;
  note: string | null;
  sale_id: number | null;
  created_at: string;
  user: string | null;
  product: { id: number; name: string; unit: string; emoji: string | null };
}

export interface SaleItem {
  product_id: number | null;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface Sale {
  id: number;
  number: number;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  profit: number;
  method: Method;
  paid_cash: number;
  paid_transfer: number;
  paid_card: number;
  cash_received: number;
  change: number;
  customer: string | null;
  status: 'completada' | 'anulada';
  void_reason: string | null;
  cashier: string | null;
  session_id: number | null;
  units: number;
  items?: SaleItem[];
}

export interface CashSummary {
  sales_count: number;
  voided: number;
  total: number;
  profit: number;
  cash: number;
  transfer: number;
  card: number;
  discounts: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  moves: { id: number; kind: 'ingreso' | 'egreso'; amount: number; reason: string; created_at: string }[];
}

export interface CashSession {
  id: number;
  opened_at: string;
  opening_amount: number;
  opened_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  notes: string | null;
  open: boolean;
  summary?: CashSummary;
  sales_total?: number;
}

export interface Session {
  token: string;
  user: User;
  store: Store;
}

export const METHOD_LABEL: Record<Method, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  mixto: 'Mixto',
};

export const MOVE_LABEL: Record<Move['kind'], string> = {
  entrada: 'Entrada',
  ajuste: 'Ajuste',
  merma: 'Merma',
  venta: 'Venta',
  anulacion: 'Anulación',
};
