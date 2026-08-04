import * as readline from 'readline';
import { ProviderClient, Provider, PROVIDERS, PROVIDER_NAMES } from './providers.js';
import { FileOperations } from './fileOps.js';
import { ConfigManager, CodeOllieConfig } from './config.js';

export class CLI {
  private providerClient: ProviderClient;
  private fileOps: FileOperations;
  private rl: readline.Interface;
  private config: CodeOllieConfig;
  private context: string = '';

  constructor(config: CodeOllieConfig, providerClient: ProviderClient, fileOps: FileOperations) {
    this.config = config;
    this.providerClient = providerClient;
    this.fileOps = fileOps;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  private printHeader(): void {
    const width = 75;
    const title = ' CodeOllie CLI v1.0.0 ';
    const padding = '─'.repeat((width - title.length) / 2);
    
    console.log(`\x1b[2m╭${padding}${title}${padding}╮\x1b[0m`);
    const statusLine = ` Active Model: \x1b[36m${this.config.activeProvider.model}\x1b[2m | Provider: ${PROVIDER_NAMES[this.config.activeProvider.provider]} `;
    const spacer = ' '.repeat(Math.max(0, width - statusLine.replace(/\x1b\[[0-9;]*m/g, '').length));
    console.log(`\x1b[2m│${statusLine}${spacer}│\x1b[0m`);
    console.log(`\x1b[2m╰${'─'.repeat(width)}╯\x1b[0m\n`);
  }

  async handleModelCommand(): Promise<void> {
    console.log('\n\x1b[2m╭─ Model Selection Menu ──────────────────────────────╮\x1b[0m');
    console.log('\x1b[2m│ Press Ctrl+D at any time to exit                   │\x1b[0m');
    console.log('\x1b[2m╰──────────────────────────────────────────────────────╯\x1b[0m\n');

    // Step 1: Select provider
    console.log('\x1b[36mAvailable Providers:\x1b[0m');
    PROVIDERS.forEach((p, i) => {
      const marker = p === this.config.activeProvider.provider ? '\x1b[36m✓\x1b[0m' : ' ';
      console.log(`  ${marker} ${i + 1}. ${PROVIDER_NAMES[p]}`);
    });

    const providerChoice = await this.prompt('\n\x1b[2mSelect provider (1-6):\x1b[0m ');
    if (!providerChoice.trim()) return; // Handle Ctrl+D
    const selectedProvider = PROVIDERS[parseInt(providerChoice) - 1];

    if (!selectedProvider) {
      console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
      return;
    }

    // Step 2: Input API key
    const apiKey = await this.prompt(`\nEnter API key for \x1b[36m${PROVIDER_NAMES[selectedProvider]}\x1b[0m: `);
    if (!apiKey.trim()) return; // Handle Ctrl+D

    // Step 3: Select model
    console.log(`\n\x1b[2mFetching models for ${PROVIDER_NAMES[selectedProvider]}...\x1b[0m`);
    try {
      const models = await ProviderClient.getAvailableModels(selectedProvider, apiKey);
      
      if (models.length === 0) {
        console.log('\x1b[33m⚠️  No models available for this provider.\x1b[0m');
        return;
      }

      console.log('\x1b[36mAvailable Models:\x1b[0m');
      models.forEach((m, i) => {
        const isCurrent = m === this.config.activeProvider.model && selectedProvider === this.config.activeProvider.provider;
        const marker = isCurrent ? '\x1b[36m✓\x1b[0m' : ' ';
        console.log(`  ${marker} ${i + 1}. ${m}`);
      });

      const modelChoice = await this.prompt('\n\x1b[2mSelect model (1-' + models.length + '):\x1b[0m ');
      if (!modelChoice.trim()) return; // Handle Ctrl+D
      
      const selectedModel = models[parseInt(modelChoice) - 1];

      if (!selectedModel) {
        console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
        return;
      }

      // Save config
      await ConfigManager.updateProvider(this.config, selectedProvider, apiKey, selectedModel);
      this.config = (await ConfigManager.loadConfig()) || this.config;

      // Reinitialize provider client
      this.providerClient = new ProviderClient(this.config.activeProvider);

      console.log(`\n\x1b[32m✅ Switched to ${PROVIDER_NAMES[selectedProvider]} / ${selectedModel}\x1b[0m\n`);
    } catch (error) {
      console.log(`\x1b[31m❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch models'}\x1b[0m\n`);
    }
  }

  private async parseAndExecuteCommand(response: string): Promise<void> {
    // Extract code blocks from response
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'txt';
      const code = match[2];

      const action = await this.prompt('\n📝 Create this file? (y/n/cancel): ');
      if (action.toLowerCase() === 'y') {
        const filePath = await this.prompt('📂 File path: ');
        await this.fileOps.createFile(filePath, code);
      } else if (action.toLowerCase() === 'cancel') {
        break;
      }
    }
  }

  async start(): Promise<void> {
    this.printHeader();
    
    console.log('Welcome to CodeOllie!');
    console.log('');
    console.log('Run /model to choose your model compatible with your API Key and CodeOllie.');
    console.log('');
    console.log('Note: You are paying for using CodeOllie. The money will be charged to your API key provider\'s account (paid via your account on their website) unless you are using a free model on your account.\n');

    while (true) {
      const userInput = await this.prompt(`\x1b[36mCodeOllie [\x1b[0m${this.config.activeProvider.model}\x1b[36m] ❯\x1b[0m `);

      if (userInput.toLowerCase() === 'exit') {
        console.log('👋 Goodbye!');
        this.rl.close();
        break;
      }

      if (userInput.startsWith('/')) {
        const command = userInput.substring(1).trim();
        if (command === 'model') {
          await this.handleModelCommand();
        } else {
          console.log(`\x1b[31m❌ Unknown command: /${command}\x1b[0m`);
        }
        continue;
      }

      if (!userInput.trim()) {
        continue;
      }

      try {
        console.log('\n\x1b[2m🤖 CodeOllie is thinking...\x1b[0m\n');
        const response = await this.providerClient.generateCode(userInput, this.context);
        console.log(`\x1b[36mCodeOllie:\x1b[0m ${response}\n`);

        await this.parseAndExecuteCommand(response);

        this.context += `\nUser: ${userInput}\nAssistant: ${response}`;
      } catch (error) {
        console.error('\x1b[31m❌ Error:\x1b[0m', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
}
