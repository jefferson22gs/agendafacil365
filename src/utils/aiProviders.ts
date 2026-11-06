import { useAIConfig } from '@/hooks/useAIConfig';

interface AIProvider {
  provider: string;
  apiKey: string;
}

export const useAIProviders = (): {
  getAIProvider: () => AIProvider | null;
  getAIClient: (provider?: string) => any | null;
  createChatCompletion: (messages: any[], options?: { provider?: string; model?: string }) => Promise<any>;
  createTextCompletion: (prompt: string, options?: { provider?: string; model?: string }) => Promise<any>;
} => {
  const { aiConfig } = useAIConfig();

  const getAIProvider = (): AIProvider | null => {
    if (!aiConfig || !aiConfig.isActive) {
      return null;
    }
    return {
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
    };
  };

  const getAIClient = (provider?: string): any => {
    const config = getAIProvider();
    if (!config) return null;

    const selectedProvider = provider || config.provider;
    const apiKey = config.apiKey;

    try {
      switch (selectedProvider) {
        case 'openai':
          const OpenAI = require('openai');
          return new OpenAI.default({ apiKey });

        case 'gemini':
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          return new GoogleGenerativeAI(apiKey);

        case 'anthropic':
          const Anthropic = require('@anthropic-ai/sdk');
          return new Anthropic.default({ apiKey });

        case 'groq':
          const Groq = require('groq-sdk');
          return new Groq.default({ apiKey });

        case 'openrouter':
          // For OpenRouter, we can use the OpenAI-compatible API
          const OpenAIOR = require('openai');
          return new OpenAIOR.default({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey,
            defaultHeaders: {
              'HTTP-Referer': 'https://agendafacil365.com.br',
              'X-Title': 'Agenda Fácil 365'
            }
          });

        default:
          console.warn(`Provider ${selectedProvider} not configured`);
          return null;
      }
    } catch (error) {
      console.error('Error initializing AI provider:', error);
      return null;
    }
  };

  const createChatCompletion = async (messages: any[], options: { provider?: string; model?: string } = {}): Promise<any> => {
    const provider = options.provider || 'openai';
    const model = options.model || getDefaultModel(provider);
    const client = getAIClient(provider);

    if (!client) {
      throw new Error('AI client not available');
    }

    try {
      switch (provider) {
        case 'openai':
          return await client.chat.completions.create({
            model: model,
            messages
          });

        case 'gemini':
          const geminiModel = client.getGenerativeModel({ model: model });
          const result = await geminiModel.generateContent(
            messages.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
            }))
          );
          return result.response;

        case 'anthropic':
          return await client.messages.create({
            model: model,
            messages,
            max_tokens: 1024
          });

        case 'groq':
          return await client.chat.completions.create({
            model: model,
            messages
          });

        case 'openrouter':
          return await client.chat.completions.create({
            model: model,
            messages
          });

        default:
          throw new Error(`Provider ${provider} not implemented`);
      }
    } catch (error) {
      console.error('Error in createChatCompletion:', error);
      throw error;
    }
  };

  const createTextCompletion = async (prompt: string, options: { provider?: string; model?: string } = {}): Promise<any> => {
    const provider = options.provider || 'openai';
    const model = options.model || getDefaultModel(provider);
    const client = getAIClient(provider);

    if (!client) {
      throw new Error('AI client not available');
    }

    try {
      switch (provider) {
        case 'openai':
          return await client.completions.create({
            model: model,
            prompt
          });

        default:
          // For other providers, use chat completion with the prompt as a user message
          return await createChatCompletion([{ role: 'user', content: prompt }], options);
      }
    } catch (error) {
      console.error('Error in createTextCompletion:', error);
      throw error;
    }
  };

  const getDefaultModel = (provider: string): string => {
    switch (provider) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'gemini':
        return 'gemini-pro';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'groq':
        return 'llama3-8b-8192';
      case 'openrouter':
        return 'openai/gpt-3.5-turbo';
      default:
        return 'gpt-3.5-turbo';
    }
  };

  return {
    getAIProvider,
    getAIClient,
    createChatCompletion,
    createTextCompletion,
  };
};