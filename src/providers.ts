import axios, { AxiosInstance } from 'axios';

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'openrouter' | 'huggingface';

export const PROVIDERS: Provider[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'huggingface'];

export const PROVIDER_NAMES: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google AI Studio',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
};

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

interface AnthropicMessage {
  role: string;
  content: string;
}

interface AnthropicResponse {
  content: Array<{ text: string }>;
}

interface ModelListResponse {
  data?: Array<{ id: string }>;
  models?: Array<{ name: string }>;
}

export class ProviderClient {
  private client: AxiosInstance;
  private provider: Provider;
  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model;

    const baseUrl = this.getBaseUrl(config);
    this.client = axios.create({
      baseURL: baseUrl,
      headers: this.getHeaders(config),
    });
  }

  private getBaseUrl(config: ProviderConfig): string {
    switch (config.provider) {
      case 'openai':
        return config.baseUrl || 'https://api.openai.com/v1';
      case 'anthropic':
        return config.baseUrl || 'https://api.anthropic.com/v1';
      case 'gemini':
        return `https://generativelanguage.googleapis.com/v1beta/openai?key=${config.apiKey}`;
      case 'deepseek':
        return config.baseUrl || 'https://api.deepseek.com/v1';
      case 'openrouter':
        return config.baseUrl || 'https://openrouter.ai/api/v1';
      case 'huggingface':
        return config.baseUrl || 'https://api-inference.huggingface.co/v1';
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  private getHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (config.provider) {
      case 'openai':
      case 'deepseek':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'openrouter':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        headers['HTTP-Referer'] = 'https://github.com/codeollie/cli';
        headers['X-Title'] = 'CodeOllie';
        break;
      case 'huggingface':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
    }

    return headers;
  }

  async generateCode(prompt: string, context: string = ''): Promise<string> {
    try {
      const systemPrompt = 'You are CodeOllie, an expert coding assistant. Help users create and edit files. When providing code, wrap it in markdown code blocks with language tags.';
      const userContent = prompt + (context ? `\n\nContext:\n${context}` : '');

      if (this.provider === 'anthropic') {
        return await this.generateAnthropic(systemPrompt, userContent);
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const response = await this.client.post<LLMResponse>('/chat/completions', {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      });

      if (!response.data.choices || !response.data.choices[0]) {
        throw new Error('Invalid API response format');
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('📡 API Error:', error.response?.status, error.response?.data);
      throw new Error(`LLM API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateAnthropic(systemPrompt: string, userContent: string): Promise<string> {
    const messages: AnthropicMessage[] = [
      { role: 'user', content: userContent },
    ];

    const response = await this.client.post<AnthropicResponse>('/messages', {
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    if (!response.data.content || !response.data.content[0]) {
      throw new Error('Invalid Anthropic API response format');
    }

    return response.data.content[0].text;
  }

  static async getAvailableModels(provider: Provider, apiKey: string): Promise<string[]> {
    try {
      switch (provider) {
        case 'openai': {
          const resp = await axios.get<ModelListResponse>('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          return (resp.data.data || []).map((m) => m.id).sort();
        }

        case 'anthropic': {
          const resp = await axios.get<{ data: Array<{ id: string }> }>('https://api.anthropic.com/v1/models', {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          });
          return (resp.data.data || []).map((m) => m.id);
        }

        case 'gemini': {
          const resp = await axios.get<{ models: Array<{ name: string }> }>(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          return (resp.data.models || [])
            .map((m) => m.name.replace('models/', ''))
            .filter((name) => name.startsWith('gemini-'));
        }

        case 'deepseek': {
          const resp = await axios.get<ModelListResponse>('https://api.deepseek.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          return (resp.data.data || []).map((m) => m.id).sort();
        }

        case 'openrouter': {
          const resp = await axios.get<{ data: Array<{ id: string }> }>('https://openrouter.ai/api/v1/models');
          return (resp.data.data || []).map((m) => m.id).sort();
        }

        case 'huggingface': {
          const resp = await axios.get<Array<{ id: string }>>('https://huggingface.co/api/models', {
            params: { filter: 'text-generation', sort: 'downloads', direction: -1, limit: 100 },
          });
          return (resp.data || []).map((m) => m.id);
        }

        default:
          return [];
      }
    } catch (error: any) {
      console.error(`⚠️  Could not fetch models from ${provider} API:`, error.response?.status, error.response?.data);
      return [];
    }
  }
}
