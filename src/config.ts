import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { Provider, ProviderConfig } from './providers.js';

const CONFIG_DIR = path.join(os.homedir(), '.codeollie');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CONFIG_FILE_MODE = 0o600; // Read/write for owner only

export interface CodeOllieConfig {
  activeProvider: ProviderConfig;
  providers: Record<string, ProviderConfig>;
}

export class ConfigManager {
  static async loadConfig(): Promise<CodeOllieConfig | null> {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      
      // Validate that config has required structure
      if (config.activeProvider && config.providers) {
        return config;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  static async saveConfig(config: CodeOllieConfig): Promise<void> {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
      
      // Write config with secure file permissions
      await fs.writeFile(
        CONFIG_FILE,
        JSON.stringify(config, null, 2),
        { encoding: 'utf-8', mode: CONFIG_FILE_MODE }
      );
    } catch (err) {
      console.error('Failed to save config:', err);
      throw err;
    }
  }

  static async initializeConfig(providerName: Provider, apiKey: string, model: string): Promise<CodeOllieConfig> {
    const config: CodeOllieConfig = {
      activeProvider: {
        provider: providerName,
        apiKey,
        model,
      },
      providers: {
        [providerName]: {
          provider: providerName,
          apiKey,
          model,
        },
      },
    };

    await this.saveConfig(config);
    return config;
  }

  static async updateProvider(
    config: CodeOllieConfig,
    providerName: Provider,
    apiKey: string,
    model: string
  ): Promise<CodeOllieConfig> {
    config.providers[providerName] = {
      provider: providerName,
      apiKey,
      model,
    };
    config.activeProvider = config.providers[providerName];
    await this.saveConfig(config);
    return config;
  }

  static async addProvider(
    config: CodeOllieConfig,
    providerName: Provider,
    apiKey: string,
    model: string
  ): Promise<CodeOllieConfig> {
    // Add provider without switching to it
    config.providers[providerName] = {
      provider: providerName,
      apiKey,
      model,
    };
    await this.saveConfig(config);
    return config;
  }

  static async switchProvider(config: CodeOllieConfig, providerName: Provider): Promise<CodeOllieConfig> {
    if (!config.providers[providerName]) {
      throw new Error(`Provider ${providerName} not configured`);
    }
    config.activeProvider = config.providers[providerName];
    await this.saveConfig(config);
    return config;
  }

  static async getProviderConfig(config: CodeOllieConfig, providerName: Provider): Promise<ProviderConfig | null> {
    return config.providers[providerName] || null;
  }

  static async listProviders(config: CodeOllieConfig): Promise<string[]> {
    return Object.keys(config.providers);
  }
}
