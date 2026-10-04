import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProviderClient, PROVIDERS, PROVIDER_NAMES } from './providers.js';
import { FileOperations } from './fileOps.js';
import { ConfigManager, CodeOllieConfig } from './config.js';

type StructuredAction = {
  action: 'create_file' | 'edit_file';
  path: string;
  content: string;
};

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

  private getChoice(input: string, max: number): number | null {
    const value = Number.parseInt(input.trim(), 10);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      return null;
    }
    return value;
  }

  private normalizeFilePath(filePath: string): string {
    let normalized = filePath.trim();

    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
      normalized = normalized.slice(1, -1);
    }

    if (normalized.startsWith('~')) {
      normalized = path.join(os.homedir(), normalized.slice(1));
    }

    return normalized;
  }

  private inferFilenameFromCode(code: string, language: string): string {
    const inferredFromComment = (code.match(/^[#\/\*\s-]*([\w\-._]+\.(py|js|ts|tsx|jsx|txt|md|json|html|css|yaml|yml))/mi) || [])[1];
    const extMap: Record<string, string> = {
      python: 'py',
      py: 'py',
      javascript: 'js',
      js: 'js',
      typescript: 'ts',
      ts: 'ts',
      jsx: 'jsx',
      tsx: 'tsx',
      txt: 'txt',
      text: 'txt',
      markdown: 'md',
      md: 'md',
      json: 'json',
      html: 'html',
      css: 'css',
      yaml: 'yaml',
      yml: 'yml',
    };

    const inferredExt = extMap[(language || '').toLowerCase()] || language || 'txt';
    return inferredFromComment || `untitled.${inferredExt}`;
  }

  private async resolveTargetFilePath(rawPath: string, code: string, language: string): Promise<string> {
    let targetPath = this.normalizeFilePath(rawPath);

    if (!targetPath) {
      throw new Error('A file path is required.');
    }

    const resolvedPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(targetPath);

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      const filename = (await this.prompt('📄 Filename to create inside the directory (leave empty to infer): ')).trim();
      const chosenName = filename || this.inferFilenameFromCode(code, language);
      if (!filename) {
        console.log(`ℹ️  Inferred filename: ${chosenName}`);
      }
      return path.join(targetPath, chosenName);
    }

    if (targetPath.endsWith(path.sep) || targetPath.endsWith('/') || targetPath.endsWith('\\')) {
      const filename = (await this.prompt('📄 Filename to create inside the directory (leave empty to infer): ')).trim();
      const chosenName = filename || this.inferFilenameFromCode(code, language);
      if (!filename) {
        console.log(`ℹ️  Inferred filename: ${chosenName}`);
      }
      return path.join(targetPath, chosenName);
    }

    return targetPath;
  }

  private extractJsonAction(response: string): StructuredAction | null {
    const trimmed = response.trim();
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return null;
    }

    const candidate = trimmed.slice(firstBrace, lastBrace + 1);

    try {
      const obj = JSON.parse(candidate);
      if (
        obj &&
        (obj.action === 'create_file' || obj.action === 'edit_file') &&
        typeof obj.path === 'string' &&
        typeof obj.content === 'string'
      ) {
        return {
          action: obj.action,
          path: obj.path,
          content: obj.content,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private async executeStructuredAction(action: StructuredAction): Promise<boolean> {
    const actionLabel = action.action === 'create_file' ? 'Create file' : 'Update file';
    console.log(`\nDetected action: ${actionLabel}`);
    console.log(`Path: ${action.path}\n`);

    const confirm = (await this.prompt('\n📝 Execute this action? (y/n/cancel): ')).trim().toLowerCase();
    if (confirm !== 'y') {
      console.log('\x1b[33m⚠️  Action cancelled by user.\x1b[0m');
      return true;
    }

    let targetPath = (await this.prompt(`📂 File path [${action.path}]: `)).trim();
    if (!targetPath) targetPath = action.path;
    targetPath = this.normalizeFilePath(targetPath);

    try {
      if (action.action === 'create_file') {
        await this.fileOps.createFile(targetPath, action.content);
        console.log('\x1b[32m✅ Created from structured action: ' + targetPath + '\x1b[0m');
      } else {
        await this.fileOps.editFile(targetPath, action.content);
        console.log('\x1b[32m✅ Updated from structured action: ' + targetPath + '\x1b[0m');
      }
      return true;
    } catch (e) {
      console.error('\x1b[31m❌ Failed to perform structured action:\x1b[0m', e instanceof Error ? e.message : e);
      return true;
    }
  }

  private async executeWriteTagAction(response: string): Promise<boolean> {
    const pathMatch = response.match(/<path>([\s\S]*?)<\/path>/i);
    const contentMatch = response.match(/<content>([\s\S]*?)<\/content>/i);

    if (!pathMatch || !contentMatch) {
      return false;
    }

    const rawPath = pathMatch[1].trim();
    const content = contentMatch[1];

    console.log(`\nDetected write_to_file tag\nPath: ${rawPath}\n`);
    const confirm = (await this.prompt('\n📝 Execute this action? (y/n/cancel): ')).trim().toLowerCase();
    if (confirm !== 'y') {
      console.log('\x1b[33m⚠️  Action cancelled by user.\x1b[0m');
      return true;
    }

    let targetPath = (await this.prompt(`📂 File path [${rawPath}]: `)).trim();
    if (!targetPath) targetPath = rawPath;
    targetPath = this.normalizeFilePath(targetPath);

    try {
      await this.fileOps.createFile(targetPath, content);
      console.log('\x1b[32m✅ Created from tag: ' + targetPath + '\x1b[0m');
      return true;
    } catch (e) {
      console.error('\x1b[31m❌ Failed to create file from tag:\x1b[0m', e instanceof Error ? e.message : e);
      return true;
    }
  }

  private async parseAndExecuteCommand(response: string): Promise<void> {
    const trimmed = response.trim();

    const jsonAction = this.extractJsonAction(response);
    if (jsonAction) {
      const handled = await this.executeStructuredAction(jsonAction);
      if (handled) {
        return;
      }
    }

    if (trimmed.includes('<write_to_file>')) {
      const handled = await this.executeWriteTagAction(response);
      if (handled) {
        return;
      }
    }

    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'txt';
      const code = match[2];
      const action = (await this.prompt('\n📝 Create this file? (y/n/cancel): ')).trim().toLowerCase();

      if (action === 'y') {
        try {
          let filePath = (await this.prompt('📂 File path: ')).trim();
          filePath = await this.resolveTargetFilePath(filePath, code, language);
          await this.fileOps.createFile(filePath, code);
        } catch (err) {
          console.error('\x1b[31m❌ Error: Could not create the file.\x1b[0m', err instanceof Error ? err.message : err);
        }
      } else if (action === 'cancel') {
        break;
      }
    }
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
    if (!providerChoice.trim()) return;

    const providerIndex = this.getChoice(providerChoice, PROVIDERS.length);
    if (providerIndex === null) {
      console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
      return;
    }

    const selectedProvider = PROVIDERS[providerIndex - 1];

    if (!selectedProvider) {
      console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
      return;
    }

    const apiKey = await this.prompt(`\nEnter API key for \x1b[36m${PROVIDER_NAMES[selectedProvider]}\x1b[0m: `);
    if (!apiKey.trim()) return;

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
      if (!modelChoice.trim()) return;

      const modelIndex = this.getChoice(modelChoice, models.length);
      if (modelIndex === null) {
        console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
        return;
      }

      const selectedModel = models[modelIndex - 1];
      if (!selectedModel) {
        console.log('\x1b[31m❌ Invalid selection.\x1b[0m');
        return;
      }

      await ConfigManager.updateProvider(this.config, selectedProvider, apiKey, selectedModel);
      this.config = (await ConfigManager.loadConfig()) || this.config;
      this.providerClient = new ProviderClient(this.config.activeProvider);

      console.log(`\n\x1b[32m✅ Switched to ${PROVIDER_NAMES[selectedProvider]} / ${selectedModel}\x1b[0m\n`);
    } catch (error) {
      console.log(`\x1b[31m❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch models'}\x1b[0m\n`);
    }
  }

  async start(): Promise<void> {
    this.printHeader();

    console.log('Welcome to CodeOllie!');
    console.log('');
    console.log('Run /model to choose your model compatible with your API Key and CodeOllie.');
    console.log('');
    console.log('Note: You are paying for using CodeOllie. The money will be charged to your API key provider\'s account (paid via your account on their website) unless you are using a free model on your provider.');
    console.log('');

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
