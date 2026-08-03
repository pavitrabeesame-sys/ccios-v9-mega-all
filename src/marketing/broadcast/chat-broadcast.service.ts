import { prisma } from '../../../packages/shared/src/database/prisma.client';
import { TenantContext } from '../../core/tenant/tenant.context';
import { EventBus } from '../../core/events/event-bus';

export interface CreateBroadcastCampaignDTO {
  name: string;
  channel: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'WHATSAPP';
  marketplaceAccountId: string;
  targetSegment: 'ALL' | 'REPEAT_BUYERS' | 'HIGH_SPENDERS' | 'INACTIVE_60_DAYS';
  messageTemplate: string;
  scheduledAt?: Date;
}

export class ChatBroadcastService {
  public async createCampaign(dto: CreateBroadcastCampaignDTO) {
    const scope = TenantContext.getScope();
    const recipientCount = await this.calculateSegmentSize(scope.companyId, dto.targetSegment);

    const campaign = await prisma.broadcastCampaign.create({
      data: {
        companyId: scope.companyId,
        marketplaceAccountId: dto.marketplaceAccountId,
        name: dto.name,
        channel: dto.channel,
        targetSegment: dto.targetSegment,
        messageTemplate: dto.messageTemplate,
        recipientCount,
        status: dto.scheduledAt ? 'SCHEDULED' : 'PROCESSING',
        scheduledAt: dto.scheduledAt || new Date(),
      },
    });

    if (!dto.scheduledAt || dto.scheduledAt <= new Date()) {
      await EventBus.getInstance().publish({
        eventType: 'MARKETING_BROADCAST_TRIGGERED',
        entity: 'BROADCAST_CAMPAIGN',
        entityId: campaign.id,
        companyId: scope.companyId,
        payload: { campaignId: campaign.id, channel: dto.channel, recipientCount },
        timestamp: new Date(),
      });
    }

    return campaign;
  }

  private async calculateSegmentSize(companyId: string, segment: string): Promise<number> {
    const now = new Date();

    switch (segment) {
      case 'ALL':
        return await prisma.customer.count({ where: { companyId } });

      case 'REPEAT_BUYERS':
        const repeatCustomers = await prisma.order.groupBy({
          by: ['customerId'],
          where: { companyId },
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } },
        });
        return repeatCustomers.length;

      case 'INACTIVE_60_DAYS':
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(now.getDate() - 60);

        const recentCustomerIds = await prisma.order.findMany({
          where: { companyId, createdAt: { gte: sixtyDaysAgo } },
          select: { customerId: true },
          distinct: ['customerId'],
        });

        const activeIds = recentCustomerIds.map((c) => c.customerId);
        return await prisma.customer.count({
          where: {
            companyId,
            id: { notIn: activeIds },
          },
        });

      default:
        return await prisma.customer.count({ where: { companyId } });
    }
  }
}
