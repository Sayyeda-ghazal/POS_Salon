export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  taxRate: number;
  // Loyalty points required to redeem this product for free (0 = not redeemable with points).
  redeemPoints: number;
  isActive: number;
};

export type TransactionItemType = 'product' | 'service';

export type CheckoutCartItem = {
  id: string;
  type: TransactionItemType;
  itemId: string | null;
  name: string;
  price: number;
  qty: number;
  taxRate: number;
  lineTotal: number;
};

export type ServicePackage = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  // Loyalty points required to redeem this service for free (0 = not redeemable with points).
  redeemPoints: number;
  isActive: number;
};

export type TransactionRecord = {
  id: string;
  receiptNo: string;
  customerId: string | null;
  customerName: string;
  cashierName: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string;
  loyaltyPointsEarned: number;
  itemCount: number;
  createdAt: string;
  originType: string | null;
  originId: string | null;
  detailedItems?: Array<{
    id: string;
    itemType: TransactionItemType;
    itemId: string | null;
    name: string;
    price: number;
    qty: number;
    taxRate: number;
    lineTotal: number;
  }>;
};

export type SaleSummary = {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
};
