export interface SyncOrderDTO {
  externalOrderId: string;
  orderStatus: string;
  buyerName: string;
  buyerEmail?: string;
  totalAmount: number;
  currency: string;
  shippingAddress: unknown;
  items: {
    externalItemId: string;
    sku: string;
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}
