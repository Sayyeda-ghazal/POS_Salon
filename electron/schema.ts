export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  taxRate: number;
  isActive: number;
};

export type CartItem = Product & {
  quantity: number;
  lineTotal: number;
};

export type ServicePackage = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  isActive: number;
};

export type SaleSummary = {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
};
