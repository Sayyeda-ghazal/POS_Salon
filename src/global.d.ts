interface Window {
  pos: {
    getDashboard: () => Promise<{
      salesToday: number;
      receiptCount: number;
      productCount: number;
      pendingSync: number;
      online: boolean;
      registerName: string;
    }>;
    listProducts: () => Promise<import('../electron/schema').Product[]>;
    getRecentSales: () => Promise<Array<{
      id: string;
      receiptNo: string;
      cashierName: string;
      subtotal: number;
      taxTotal: number;
      discountTotal: number;
      grandTotal: number;
      paymentMethod: string;
      itemCount: number;
      createdAt: string;
    }>>;
    createSale: (payload: {
      cashierName: string;
      paymentMethod: string;
      discountTotal?: number;
      items: Array<{ productId: string; quantity: number }>;
    }) => Promise<{
      id: string;
      receiptNo: string;
      subtotal: number;
      taxTotal: number;
      discountTotal: number;
      grandTotal: number;
      createdAt: string;
      itemCount: number;
    }>;
  };
}
