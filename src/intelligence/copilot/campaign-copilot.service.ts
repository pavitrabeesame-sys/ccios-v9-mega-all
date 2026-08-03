import { AIRouterService, PromptMessage } from '../providers/ai-router.service';
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

    const systemPrompt = `
You are CCIOS Campaign Copilot, an elite e-commerce performance marketing strategist.
Brand Name: ${context.brandName}
Connected Channels: ${context.topChannels.join(', ')}
Top Catalog Samples: ${JSON.stringify(context.topProducts)}

Generate high-converting e-commerce ad copy optimized specifically for ${request.channel}.
Respond STRICTLY in valid JSON format with the following keys:
"headline", "adCopy", "callToAction", "suggestedHashtags", "recommendedStrategy".
`;

    const userPrompt = `
Target Audience: ${request.targetAudience}
Promotional Goal: ${request.promotionalGoal}
Featured SKU: ${request.featuredSku || 'General Catalog Promotion'}
`;

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
      throw new Error(`AI_COPILOT_PARSE_ERROR: Failed to parse generated JSON response. Raw text: ${result.text}`);
    }
  }
}
