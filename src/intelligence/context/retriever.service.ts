import { prisma } from '../../../packages/shared/src/database/prisma.client';
import { TenantContext } from '../../core/tenant/tenant.context';

export interface RetrievalContext {
  topProducts: Array<{ sku: string; name: string; price: number }>;
  recentOrdersCount: number;
  topChannels: string[];
  brandName?: string;
}

export class ContextRetrieverService {
  public async buildTenantContext(): Promise<RetrievalContext> {
    const scope = TenantContext.getScope();

    const company = await prisma.company.findUnique({
      where: { id: scope.companyId },
    });

    const products = await prisma.masterProduct.findMany({
      where: { companyId: scope.companyId, status: 'ACTIVE' },
      take: 5,
      select: { sku: true, name: true, basePrice: true },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrdersCount = await prisma.order.count({
      where: {
        companyId: scope.companyId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const channels = await prisma.marketplaceAccount.findMany({
      where: { store: { companyId: scope.companyId } },
      select: { channel: true },
    });

    const uniqueChannels = Array.from(new Set(channels.map((c) => c.channel)));

    return {
      brandName: company?.name || 'Retail Brand',
      topProducts: products.map((p) => ({ sku: p.sku, name: p.name, price: Number(p.basePrice) })),
      recentOrdersCount,
      topChannels: uniqueChannels,
    };
  }
}
