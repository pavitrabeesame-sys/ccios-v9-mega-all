export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'local';

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
        console.warn(`[AIRouter] Provider '${providerName}' failed. Falling back. Error: ${err.message}`);
        lastError = err;
      }
    }

    throw new Error(`AI_ROUTER_FAILURE: All configured providers failed. Last error: ${lastError?.message}`);
  }
}
