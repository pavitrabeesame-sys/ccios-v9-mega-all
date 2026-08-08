import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../../core/tenant/tenant.context';

export type LedgerEntryType = 'PURCHASE_RECEIPT' | 'SALES_DEDUCTION' | 'RESERVATION_LOCK' | 'RESERVATION_RELEASE' | 'ADJUSTMENT' | 'RETURN_RESTOCK';

export interface LedgerTransactionDTO {
  productVariationId: string;
  warehouseId: string;
  binLocationId?: string;
  type: LedgerEntryType;
  quantityChange: number;
  referenceId: string;
  notes?: string;
}

export class InventoryLedgerService {
  public async recordTransaction(dto: LedgerTransactionDTO) {
    const scope = TenantContext.getScope();

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const snapshot = await tx.inventorySnapshot.findUnique({
        where: {
          productVariationId_warehouseId: {
            productVariationId: dto.productVariationId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      const currentAvailable = snapshot ? snapshot.quantityAvailable : 0;
      const currentReserved = snapshot ? snapshot.quantityReserved : 0;

      let newAvailable = currentAvailable;
      let newReserved = currentReserved;

      switch (dto.type) {
        case 'PURCHASE_RECEIPT':
        case 'RETURN_RESTOCK':
        case 'ADJUSTMENT':
          newAvailable += dto.quantityChange;
          break;
        case 'RESERVATION_LOCK':
          if (currentAvailable < Math.abs(dto.quantityChange)) {
            throw new Error(`INSUFFICIENT_STOCK: Available (${currentAvailable}) is less than requested reservation (${Math.abs(dto.quantityChange)})`);
          }
          newAvailable -= Math.abs(dto.quantityChange);
          newReserved += Math.abs(dto.quantityChange);
          break;
        case 'RESERVATION_RELEASE':
          newReserved -= Math.abs(dto.quantityChange);
          break;
        case 'SALES_DEDUCTION':
          newReserved -= Math.abs(dto.quantityChange);
          break;
      }

      if (newAvailable < 0 || newReserved < 0) {
        throw new Error(`LEDGER_INTEGRITY_VIOLATION: Inventory counts cannot fall below zero. Available: ${newAvailable}, Reserved: ${newReserved}`);
      }

      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          companyId: scope.companyId,
          productVariationId: dto.productVariationId,
          warehouseId: dto.warehouseId,
          binLocationId: dto.binLocationId,
          type: dto.type,
          quantityChange: dto.quantityChange,
          balanceAfterAvailable: newAvailable,
          balanceAfterReserved: newReserved,
          referenceId: dto.referenceId,
          notes: dto.notes || '',
        },
      });

      await tx.inventorySnapshot.upsert({
        where: {
          productVariationId_warehouseId: {
            productVariationId: dto.productVariationId,
            warehouseId: dto.warehouseId,
          },
        },
        update: {
          quantityAvailable: newAvailable,
          quantityReserved: newReserved,
          quantityTotal: newAvailable + newReserved,
          updatedAt: new Date(),
        },
        create: {
          companyId: scope.companyId,
          productVariationId: dto.productVariationId,
          warehouseId: dto.warehouseId,
          quantityAvailable: newAvailable,
          quantityReserved: newReserved,
          quantityTotal: newAvailable + newReserved,
        },
      });

      return ledgerEntry;
    });
  }
}
