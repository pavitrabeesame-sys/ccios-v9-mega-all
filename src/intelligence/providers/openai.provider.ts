import { IAIProvider, AIProviderName, PromptMessage, AICompletionOptions, AICompletionResult } from './ai-router.service';

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
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Http Error ${response.status}: ${errText}`);
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
