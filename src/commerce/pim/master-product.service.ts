import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../../core/tenant/tenant.context';

export interface CreateMasterProductDTO {
  sku: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId: string;
  basePrice: number;
  costPrice?: number;
  attributes?: Record<string, unknown>;
  variations?: Array<{
    sku: string;
    name: string;
    price: number;
    costPrice?: number;
    attributes?: Record<string, unknown>;
  }>;
}

export class MasterProductService {
  public async createMasterProduct(dto: CreateMasterProductDTO) {
    const scope = TenantContext.getScope();

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.product.findFirst({
        where: { companyId: scope.companyId, sku: dto.sku },
      });

      if (existing) {
        throw new Error(`PIM_SKU_CONFLICT: Master SKU '${dto.sku}' already exists in this tenant.`);
      }

      const product = await tx.product.create({
        data: {
          companyId: scope.companyId,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description || '',
          price: dto.basePrice,
          costPrice: dto.costPrice || 0,
          attributes: (dto.attributes as any) || {},
          status: 'ACTIVE',
        },
      });

      if (dto.variations && dto.variations.length > 0) {
        await tx.productVariation.createMany({
          data: dto.variations.map((v) => ({
            productId: product.id,
            sku: v.sku,
            name: v.name,
            price: v.price,
            costPrice: v.costPrice || dto.costPrice || 0,
            attributes: (v.attributes as any) || {},
            status: 'ACTIVE',
          })),
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { productVariations: true, category: true, brand: true },
      });
    });
  }

  public async linkChannelListing(
    masterVariationId: string,
    marketplaceAccountId: string,
    channelSku: string,
    externalProductId: string,
    externalVariationId?: string
  ) {
    return await prisma.marketplaceListing.upsert({
      where: {
        marketplaceAccountId_channelSku: {
          marketplaceAccountId,
          channelSku,
        },
      },
      update: {
        productVariationId: masterVariationId,
        externalProductId,
        externalVariationId: externalVariationId || null,
        status: 'LINKED',
        updatedAt: new Date(),
      },
      create: {
        productVariationId: masterVariationId,
        marketplaceAccountId,
        channelSku,
        externalProductId,
        externalVariationId: externalVariationId || null,
        status: 'LINKED',
      },
    });
  }
}
