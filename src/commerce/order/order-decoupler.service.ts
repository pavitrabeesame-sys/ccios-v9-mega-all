import { prisma } from '../../../packages/shared/src/database/prisma.client';
import { SyncOrderDTO } from '../../plugins/core/base-adapter.interface';
import { InventoryReservationService } from '../wms/inventory-reservation.service';
import { EventBus } from '../../core/events/event-bus';

export class OrderDecouplerService {
  private reservationService: InventoryReservationService;

  constructor(reservationService: InventoryReservationService) {
    this.reservationService = reservationService;
  }

  public async ingestOrder(marketplaceAccountId: string, rawOrder: SyncOrderDTO): Promise<string> {
    const account = await prisma.marketplaceAccount.findUnique({
      where: { id: marketplaceAccountId },
      include: { store: true },
    });

    if (!account) {
      throw new Error(`ORDER_INGEST_ERROR: Marketplace Account ${marketplaceAccountId} not found.`);
    }

    const companyId = account.store.companyId;

    const existingOrder = await prisma.order.findFirst({
      where: {
        companyId,
        marketplaceAccountId,
        externalOrderId: rawOrder.externalOrderId,
      },
    });

    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: { status: rawOrder.orderStatus, updatedAt: new Date() },
      });
      return existingOrder.id;
    }

    const lineItemsToCreate = [];
    const reservationItems = [];

    for (const item of rawOrder.items) {
      const listing = await prisma.marketplaceListing.findFirst({
        where: {
          marketplaceAccountId,
          channelSku: item.sku,
        },
        include: { productVariation: true },
      });

      const productVariationId = listing?.productVariationId || null;

      lineItemsToCreate.push({
        externalItemId: item.externalItemId,
        channelSku: item.sku,
        productVariationId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });

      if (productVariationId) {
        reservationItems.push({
          productVariationId,
          warehouseId: process.env.DEFAULT_WAREHOUSE_ID || 'WH-MAIN-01',
          quantity: item.quantity,
        });
      }
    }

    const newOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          companyId_email: {
            companyId,
            email: rawOrder.buyerEmail || `${rawOrder.buyerName.replace(/\s+/g, '').toLowerCase()}@marketplace.user`,
          },
        },
        update: { name: rawOrder.buyerName },
        create: {
          companyId,
          name: rawOrder.buyerName,
          email: rawOrder.buyerEmail || `${rawOrder.buyerName.replace(/\s+/g, '').toLowerCase()}@marketplace.user`,
        },
      });

      return tx.order.create({
        data: {
          companyId,
          storeId: account.storeId,
          marketplaceAccountId,
          customerId: customer.id,
          externalOrderId: rawOrder.externalOrderId,
          status: rawOrder.orderStatus,
          totalAmount: rawOrder.totalAmount,
          currency: rawOrder.currency,
          shippingAddress: rawOrder.shippingAddress as any,
          items: {
            create: lineItemsToCreate,
          },
        },
      });
    });

    if (reservationItems.length > 0 && rawOrder.orderStatus === 'PAID') {
      try {
        await this.reservationService.reserveStockForOrder(newOrder.id, reservationItems);
      } catch (err) {
        console.error(`[OrderDecouplerService] Stock reservation warning for order ${newOrder.id}:`, err);
      }
    }

    await EventBus.getInstance().publish({
      eventType: 'ORDER_CREATED',
      entity: 'ORDER',
      entityId: newOrder.id,
      companyId,
      brandId: account.store.brandId,
      payload: { externalOrderId: rawOrder.externalOrderId, status: newOrder.status },
      timestamp: new Date(),
    });

    return newOrder.id;
  }
}
