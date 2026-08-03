import Redis from 'ioredis';
import { InventoryLedgerService } from './inventory-ledger.service';

export interface ReserveStockItem {
  productVariationId: string;
  warehouseId: string;
  quantity: number;
}

export class InventoryReservationService {
  private redis: Redis;
  private ledgerService: InventoryLedgerService;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.ledgerService = new InventoryLedgerService();
  }

  public async reserveStockForOrder(orderId: string, items: ReserveStockItem[], ttlSeconds: number = 900): Promise<boolean> {
    const lockKeys: string[] = [];
    
    try {
      for (const item of items) {
        const lockKey = `lock:stock:${item.productVariationId}:${item.warehouseId}`;
        const acquired = await this.redis.set(lockKey, orderId, 'NX', 'EX', 10);
        
        if (!acquired) {
          throw new Error(`LOCK_ACQUISITION_FAILED: Stock resource currently locked for variant ${item.productVariationId}`);
        }
        lockKeys.push(lockKey);
      }

      for (const item of items) {
        await this.ledgerService.recordTransaction({
          productVariationId: item.productVariationId,
          warehouseId: item.warehouseId,
          type: 'RESERVATION_LOCK',
          quantityChange: item.quantity,
          referenceId: orderId,
          notes: `Reservation lock for order ${orderId}`,
        });
      }

      await this.redis.set(`reservation:order:${orderId}`, JSON.stringify(items), 'EX', ttlSeconds);

      return true;
    } catch (err) {
      console.error(`[InventoryReservationService] Failed reservation for order ${orderId}:`, err);
      throw err;
    } finally {
      for (const lockKey of lockKeys) {
        await this.redis.del(lockKey);
      }
    }
  }

  public async confirmFulfillment(orderId: string, items: ReserveStockItem[]): Promise<void> {
    for (const item of items) {
      await this.ledgerService.recordTransaction({
        productVariationId: item.productVariationId,
        warehouseId: item.warehouseId,
        type: 'SALES_DEDUCTION',
        quantityChange: item.quantity,
        referenceId: orderId,
        notes: `Order fulfilled: ${orderId}`,
      });
    }
    await this.redis.del(`reservation:order:${orderId}`);
  }
}
