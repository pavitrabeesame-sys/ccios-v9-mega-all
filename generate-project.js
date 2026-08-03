const fs = require('fs');
const path = require('path');

// Define all files and their contents
const files = {
  // PHASE 3: COMMERCE MODULE
  'src/commerce/pim/master-product.service.ts': `import { prisma } from '../../../packages/shared/src/database/prisma.client';
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

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProduct.findFirst({
        where: { companyId: scope.companyId, sku: dto.sku },
      });

      if (existing) {
        throw new Error(\`PIM_SKU_CONFLICT: Master SKU '\${dto.sku}' already exists in this tenant.\`);
      }

      const product = await tx.masterProduct.create({
        data: {
          companyId: scope.companyId,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description || '',
          basePrice: dto.basePrice,
          costPrice: dto.costPrice || 0,
          attributes: (dto.attributes as any) || {},
          status: 'ACTIVE',
        },
      });

      if (dto.variations && dto.variations.length > 0) {
        await tx.productVariation.createMany({
          data: dto.variations.map((v) => ({
            masterProductId: product.id,
            sku: v.sku,
            name: v.name,
            price: v.price,
            costPrice: v.costPrice || dto.costPrice || 0,
            attributes: (v.attributes as any) || {},
            status: 'ACTIVE',
          })),
        });
      }

      return tx.masterProduct.findUnique({
        where: { id: product.id },
        include: { variations: true, category: true, brand: true },
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
`,

  'src/commerce/wms/inventory-ledger.service.ts': `import { prisma } from '../../../packages/shared/src/database/prisma.client';
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

    return await prisma.$transaction(async (tx) => {
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
            throw new Error(\`INSUFFICIENT_STOCK: Available (\${currentAvailable}) is less than requested reservation (\${Math.abs(dto.quantityChange)})\`);
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
        throw new Error(\`LEDGER_INTEGRITY_VIOLATION: Inventory counts cannot fall below zero. Available: \${newAvailable}, Reserved: \${newReserved}\`);
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
`,

  'src/commerce/wms/inventory-reservation.service.ts': `import Redis from 'ioredis';
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
        const lockKey = \`lock:stock:\${item.productVariationId}:\${item.warehouseId}\`;
        const acquired = await this.redis.set(lockKey, orderId, 'NX', 'EX', 10);
        
        if (!acquired) {
          throw new Error(\`LOCK_ACQUISITION_FAILED: Stock resource currently locked for variant \${item.productVariationId}\`);
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
          notes: \`Reservation lock for order \${orderId}\`,
        });
      }

      await this.redis.set(\`reservation:order:\${orderId}\`, JSON.stringify(items), 'EX', ttlSeconds);

      return true;
    } catch (err) {
      console.error(\`[InventoryReservationService] Failed reservation for order \${orderId}:\`, err);
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
        notes: \`Order fulfilled: \${orderId}\`,
      });
    }
    await this.redis.del(\`reservation:order:\${orderId}\`);
  }
}
`,

  'src/commerce/order/order-decoupler.service.ts': `import { prisma } from '../../../packages/shared/src/database/prisma.client';
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
      throw new Error(\`ORDER_INGEST_ERROR: Marketplace Account \${marketplaceAccountId} not found.\`);
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
            email: rawOrder.buyerEmail || \`\${rawOrder.buyerName.replace(/\\s+/g, '').toLowerCase()}@marketplace.user\`,
          },
        },
        update: { name: rawOrder.buyerName },
        create: {
          companyId,
          name: rawOrder.buyerName,
          email: rawOrder.buyerEmail || \`\${rawOrder.buyerName.replace(/\\s+/g, '').toLowerCase()}@marketplace.user\`,
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
        console.error(\`[OrderDecouplerService] Stock reservation warning for order \${newOrder.id}:\`, err);
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
`,

  // PHASE 4: INTELLIGENCE MODULE
  'src/intelligence/providers/ai-router.service.ts': `export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'local';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  responseFormat?: 'json' | 'text';
}

export interface AICompletionResult {
  text: string;
  provider: AIProviderName;
  model: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface IAIProvider {
  name: AIProviderName;
  generateCompletion(
    messages: PromptMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResult>;
}

export class AIRouterService {
  private providers: Map<AIProviderName, IAIProvider> = new Map();
  private primaryProvider: AIProviderName = 'anthropic';
  private fallbackChain: AIProviderName[] = ['openai', 'gemini', 'local'];

  public registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.name, provider);
  }

  public async executeCompletion(
    messages: PromptMessage[],
    options?: AICompletionOptions,
    preferredProvider?: AIProviderName
  ): Promise<AICompletionResult> {
    const chain = preferredProvider
      ? [preferredProvider, ...this.fallbackChain.filter((p) => p !== preferredProvider)]
      : [this.primaryProvider, ...this.fallbackChain];

    let lastError: Error | null = null;

    for (const providerName of chain) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        return await provider.generateCompletion(messages, options);
      } catch (err: any) {
        console.warn(\`[AIRouter] Provider '\${providerName}' failed. Falling back. Error: \${err.message}\`);
        lastError = err;
      }
    }

    throw new Error(\`AI_ROUTER_FAILURE: All configured providers failed. Last error: \${lastError?.message}\`);
  }
}
`,

  'src/intelligence/providers/anthropic.provider.ts': `import { IAIProvider, AIProviderName, PromptMessage, AICompletionOptions, AICompletionResult } from './ai-router.service';

export class AnthropicProvider implements IAIProvider {
  public name: AIProviderName = 'anthropic';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.defaultModel = defaultModel;
  }

  public async generateCompletion(
    messages: PromptMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_KEY_MISSING: Anthropic API key is not configured.');
    }

    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        system: systemMessage,
        messages: conversationMessages,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(\`Anthropic API Http Error \${response.status}: \${errText}\`);
    }

    const data = await response.json();
    const textOutput = data.content?.[0]?.text || '';

    return {
      text: textOutput,
      provider: this.name,
      model: this.defaultModel,
      tokensUsed: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }
}
`,

  'src/intelligence/providers/openai.provider.ts': `import { IAIProvider, AIProviderName, PromptMessage, AICompletionOptions, AICompletionResult } from './ai-router.service';

export class OpenAIProvider implements IAIProvider {
  public name: AIProviderName = 'openai';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = 'gpt-4o') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = defaultModel;
  }

  public async generateCompletion(
    messages: PromptMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_KEY_MISSING: OpenAI API key is not configured.');
    }

    const payload: Record<string, any> = {
      model: this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens || 1024,
    };

    if (options?.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${this.apiKey}\`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(\`OpenAI API Http Error \${response.status}: \${errText}\`);
    }

    const data = await response.json();
    const textOutput = data.choices?.[0]?.message?.content || '';

    return {
      text: textOutput,
      provider: this.name,
      model: this.defaultModel,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
    };
  }
}
`,

  'src/intelligence/context/retriever.service.ts': `import { prisma } from '../../../packages/shared/src/database/prisma.client';
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
`,

  'src/intelligence/copilot/campaign-copilot.service.ts': `import { AIRouterService, PromptMessage } from '../providers/ai-router.service';
import { ContextRetrieverService } from '../context/retriever.service';

export interface CampaignGenerationRequest {
  channel: 'TIKTOK' | 'SHOPEE' | 'LAZADA' | 'FACEBOOK';
  targetAudience: string;
  promotionalGoal: string;
  featuredSku?: string;
}

export interface CampaignOutput {
  headline: string;
  adCopy: string;
  callToAction: string;
  suggestedHashtags: string[];
  recommendedStrategy: string;
}

export class CampaignCopilotService {
  private aiRouter: AIRouterService;
  private contextRetriever: ContextRetrieverService;

  constructor(aiRouter: AIRouterService) {
    this.aiRouter = aiRouter;
    this.contextRetriever = new ContextRetrieverService();
  }

  public async generateCampaign(request: CampaignGenerationRequest): Promise<CampaignOutput> {
    const context = await this.contextRetriever.buildTenantContext();

    const systemPrompt = \`
You are CCIOS Campaign Copilot, an elite e-commerce performance marketing strategist.
Brand Name: \${context.brandName}
Connected Channels: \${context.topChannels.join(', ')}
Top Catalog Samples: \${JSON.stringify(context.topProducts)}

Generate high-converting e-commerce ad copy optimized specifically for \${request.channel}.
Respond STRICTLY in valid JSON format with the following keys:
"headline", "adCopy", "callToAction", "suggestedHashtags", "recommendedStrategy".
\`;

    const userPrompt = \`
Target Audience: \${request.targetAudience}
Promotional Goal: \${request.promotionalGoal}
Featured SKU: \${request.featuredSku || 'General Catalog Promotion'}
\`;

    const messages: PromptMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await this.aiRouter.executeCompletion(messages, {
      temperature: 0.7,
      responseFormat: 'json',
    });

    try {
      const parsed: CampaignOutput = JSON.parse(result.text);
      return parsed;
    } catch (err) {
      throw new Error(\`AI_COPILOT_PARSE_ERROR: Failed to parse generated JSON response. Raw text: \${result.text}\`);
    }
  }
}
`,

  // PHASE 5: MARKETING MODULE & FRONTEND
  'src/marketing/broadcast/chat-broadcast.service.ts': `import { prisma } from '../../../packages/shared/src/database/prisma.client';
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
`,

  'src/marketing/visuals/banner-asset.service.ts': `export interface BannerSpecDTO {
  brandName: string;
  campaignEvent: string;
  discountText: string;
  targetRatio: '1:1' | '16:9' | '9:16';
  primaryProductImageUrls: string[];
}

export interface BannerAssetResult {
  assetId: string;
  renderConfig: {
    dimensions: { width: number; height: number };
    layers: Array<{
      type: 'text' | 'image' | 'shape';
      content?: string;
      position: { x: number; y: number; zIndex: number };
      style?: Record<string, any>;
    }>;
  };
}

export class BannerAssetService {
  public generateBannerConfig(spec: BannerSpecDTO): BannerAssetResult {
    const dimensions = this.resolveDimensions(spec.targetRatio);

    return {
      assetId: \`asset_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`,
      renderConfig: {
        dimensions,
        layers: [
          {
            type: 'shape',
            position: { x: 0, y: 0, zIndex: 0 },
            style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', width: '100%', height: '100%' },
          },
          {
            type: 'text',
            content: spec.brandName.toUpperCase(),
            position: { x: 40, y: 40, zIndex: 10 },
            style: { fontSize: 24, fontWeight: 'bold', color: '#94a3b8' },
          },
          {
            type: 'text',
            content: spec.campaignEvent,
            position: { x: 40, y: 80, zIndex: 10 },
            style: { fontSize: 48, fontWeight: '900', color: '#ffffff' },
          },
          {
            type: 'text',
            content: spec.discountText,
            position: { x: 40, y: 140, zIndex: 10 },
            style: { fontSize: 32, fontWeight: 'bold', color: '#ef4444' },
          },
          ...(spec.primaryProductImageUrls[0]
            ? [
                {
                  type: 'image' as const,
                  content: spec.primaryProductImageUrls[0],
                  position: { x: dimensions.width - 300, y: 50, zIndex: 5 },
                  style: { width: 250, height: 250, objectFit: 'contain' },
                },
              ]
            : []),
        ],
      },
    };
  }

  private resolveDimensions(ratio: '1:1' | '16:9' | '9:16'): { width: number; height: number } {
    switch (ratio) {
      case '1:1':
        return { width: 1080, height: 1080 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '9:16':
        return { width: 1080, height: 1920 };
    }
  }
}
`,

  'apps/web/app/layout.tsx': `import React from 'react';

export const metadata = {
  title: 'CCIOS Enterprise Operating System',
  description: 'AI-Powered E-Commerce Multi-Channel Execution Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <style>{\`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #090d16; color: #f8fafc; }
          .app-container { display: flex; min-height: 100vh; }
          .sidebar { width: 260px; background: #0f172a; border-right: 1px solid #1e293b; padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem; }
          .nav-item { color: #94a3b8; text-decoration: none; font-size: 0.95rem; font-weight: 500; display: block; padding: 0.6rem 0.8rem; border-radius: 6px; }
          .nav-item:hover, .nav-item.active { background: #1e293b; color: #38bdf8; }
          .main-content { flex: 1; padding: 2rem; }
        \`}</style>
      </head>
      <body>
        <div className="app-container">
          <aside className="sidebar">
            <div>
              <h2 style={{ color: '#38bdf8', fontSize: '1.2rem', letterSpacing: '0.05em' }}>CCIOS v10</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Enterprise Suite</p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a href="/dashboard" className="nav-item active">Dashboard</a>
              <a href="/pim" className="nav-item">PIM Catalog</a>
              <a href="/wms" className="nav-item">WMS Inventory</a>
              <a href="/orders" className="nav-item">Orders</a>
              <a href="/marketing" className="nav-item">Campaigns</a>
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
`,

  'apps/web/app/dashboard/page.tsx': `import React from 'react';

export default async function DashboardPage() {
  const metrics = [
    { label: '30-Day GMV', value: '$128,450.00', change: '+14.2%' },
    { label: 'Total Orders', value: '1,842', change: '+8.1%' },
    { label: 'Active Channels', value: '3 (Shopee, Lazada, TikTok)', change: 'Synced' },
    { label: 'Low Stock Alerts', value: '4 SKUs', change: 'Requires Action' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Executive Overview</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Real-time aggregated channel metrics and system alerts.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        {metrics.map((m, idx) => (
          <div key={idx} style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{m.label}</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#f8fafc' }}>{m.value}</div>
            <span style={{ fontSize: '0.8rem', color: m.change.includes('+') ? '#4ade80' : '#f87171' }}>{m.change}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Active Sync Jobs</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b' }}>
              <th style={{ padding: '0.75rem' }}>Channel</th>
              <th style={{ padding: '0.75rem' }}>Job Type</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Last Run</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '0.75rem' }}>Shopee Official</td>
              <td style={{ padding: '0.75rem' }}>INVENTORY_SYNC</td>
              <td style={{ padding: '0.75rem', color: '#4ade80' }}>COMPLETED</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>2 mins ago</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '0.75rem' }}>TikTok Shop</td>
              <td style={{ padding: '0.75rem' }}>ORDER_INGEST</td>
              <td style={{ padding: '0.75rem', color: '#4ade80' }}>COMPLETED</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>1 min ago</td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem' }}>Lazada Store</td>
              <td style={{ padding: '0.75rem' }}>PRICING_PUSH</td>
              <td style={{ padding: '0.75rem', color: '#f59e0b' }}>PROCESSING</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>Just now</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,

  'apps/web/app/pim/page.tsx': `import React from 'react';

export default function PIMPage() {
  const sampleProducts = [
    { sku: 'M-WLT-001', name: 'Classic Leather Tri-Fold Wallet', category: 'Accessories', price: '$49.00', status: 'ACTIVE' },
    { sku: 'M-DRS-002', name: 'Slim-Fit Oxford Cotton Shirt', category: 'Apparel', price: '$79.00', status: 'ACTIVE' },
    { sku: 'W-BAG-003', name: 'Structured Crossbody Handbag', category: 'Bags', price: '$129.00', status: 'ACTIVE' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>PIM Master Catalog</h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Manage master SKUs and sync mapped listings across channels.</p>
        </div>
        <button style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          + Add Master Product
        </button>
      </div>

      <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b' }}>
              <th style={{ padding: '0.75rem' }}>Master SKU</th>
              <th style={{ padding: '0.75rem' }}>Product Name</th>
              <th style={{ padding: '0.75rem' }}>Category</th>
              <th style={{ padding: '0.75rem' }}>Base Price</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sampleProducts.map((p, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '0.75rem', fontWeight: '600', color: '#38bdf8' }}>{p.sku}</td>
                <td style={{ padding: '0.75rem' }}>{p.name}</td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{p.category}</td>
                <td style={{ padding: '0.75rem' }}>{p.price}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ background: '#166534', color: '#86efac', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`
};

// Create folders and write files
Object.entries(files).forEach(([filePath, content]) => {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write content to file
  fs.writeFileSync(absolutePath, content, 'utf8');
  console.log(`✅ Created: ${filePath}`);
});

console.log('\n🎉 ALL FOLDERS AND FILES CREATED SUCCESSFULLY WITH ZERO ERRORS!');