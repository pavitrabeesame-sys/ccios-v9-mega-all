import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../../core/tenant/tenant.context';
import { randomUUID } from 'crypto';

export type LedgerEntryType =
  | 'PURCHASE_RECEIPT'
  | 'SALES_DEDUCTION'
  | 'RESERVATION_LOCK'
  | 'RESERVATION_RELEASE'
  | 'ADJUSTMENT'
  | 'RETURN_RESTOCK';

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

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const snapshot = await tx.inventorySnapshot.findUnique({
        where: {
          productVariationId_warehouseId: {
            productVariationId: dto.productVariationId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      const currentAvailable = snapshot?.quantityAvailable ?? 0;
      const currentReserved = snapshot?.quantityReserved ?? 0;

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
            throw new Error(
              `INSUFFICIENT_STOCK: Available (${currentAvailable}) is less than requested reservation (${Math.abs(dto.quantityChange)})`
            );
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
        throw new Error(
          `LEDGER_INTEGRITY_VIOLATION: Inventory counts cannot fall below zero.`
        );
      }

      const ledgerEntry = await tx.inventoryLedger.create({
        data: {
          id: randomUUID(),

          companyId: scope.companyId,

          ProductVariation: {
            connect: {
              id: dto.productVariationId,
            },
          },

          warehouseId: dto.warehouseId,
          binLocationId: dto.binLocationId ?? null,
          type: dto.type,
          quantityChange: dto.quantityChange,
          balanceAfterAvailable: newAvailable,
          balanceAfterReserved: newReserved,
          referenceId: dto.referenceId,
          notes: dto.notes ?? null,
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
          id: randomUUID(),
          companyId: scope.companyId,

          ProductVariation: {
            connect: {
              id: dto.productVariationId,
            },
          },

          warehouseId: dto.warehouseId,
          quantityAvailable: newAvailable,
          quantityReserved: newReserved,
          quantityTotal: newAvailable + newReserved,
          updatedAt: new Date(),
        },
      });

      return ledgerEntry;
    });
  }
}