import { IAIProvider, AIProviderName, PromptMessage, AICompletionOptions, AICompletionResult } from './ai-router.service';

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
      throw new Error(`Anthropic API Http Error ${response.status}: ${errText}`);
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
