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
    // Accept structured JSON actions or xml-like tags in addition to markdown code blocks.
    const trimmed = response.trim();

    // 1) JSON action support: { "action": "create_file", "path": "...", "content": "..." }
    if (trimmed.startsWith('{')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj && obj.action === 'create_file' && obj.path && obj.content) {
          try {
            await this.fileOps.createFile(obj.path, obj.content);
            console.log('\x1b[32m✅ Created from JSON action: ' + obj.path + '\x1b[0m');
            return;
          } catch (e) {
            console.error('\x1b[31m❌ Failed to create file from JSON action:\x1b[0m', e instanceof Error ? e.message : e);
            return;
          }
        }
        if (obj && obj.action === 'edit_file' && obj.path && obj.content) {
          try {
            await this.fileOps.editFile(obj.path, obj.content);
            console.log('\x1b[32m✅ Updated from JSON action: ' + obj.path + '\x1b[0m');
            return;
          } catch (e) {
            console.error('\x1b[31m❌ Failed to update file from JSON action:\x1b[0m', e instanceof Error ? e.message : e);
            return;
          }
        }
      } catch (e) {
        // not JSON or parse error - fall through to markdown parsing
      }
    }

    // 2) Simple XML-like tag support: <write_to_file><path>...</path><content>...</content></write_to_file>
    if (trimmed.includes('<write_to_file>')) {
      try {
        const pathMatch = trimmed.match(/<path>([\s\S]*?)<\/path>/i);
        const contentMatch = trimmed.match(/<content>([\s\S]*?)<\/content>/i);
        if (pathMatch && contentMatch) {
          const p = pathMatch[1].trim();
          const c = contentMatch[1];
          try {
            await this.fileOps.createFile(p, c);
            console.log('\x1b[32m✅ Created from tag: ' + p + '\x1b[0m');
            return;
          } catch (e) {
            console.error('\x1b[31m❌ Failed to create file from tag:\x1b[0m', e instanceof Error ? e.message : e);
            return;
          }
        }
      } catch (e) {
        // ignore and fall through
      }
    }

    // 3) Fallback: extract markdown code blocks as before
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'txt';
      const code = match[2];

      const action = await this.prompt('\n📝 Create this file? (y/n/cancel): ');
      if (action.toLowerCase() === 'y') {
        let filePath = (await this.prompt('📂 File path: ')).trim();
        // Normalize common user inputs
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }
        if (filePath.startsWith("'") && filePath.endsWith("'")) {
          filePath = filePath.slice(1, -1);
        }
        // Expand ~ to home
        if (filePath.startsWith('~')) {
          filePath = filePath.replace('~', require('os').homedir());
        }

        const path = require('path');
        const fs = require('fs');

        let targetIsDir = false;
        try {
          // Resolve relative paths against cwd so existence checks are accurate
          const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
          // If user entered an existing directory, treat as directory
          if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
            targetIsDir = true;
          }
          // If user input ends with path separator, treat as directory
          if (filePath.endsWith(path.sep) || filePath.endsWith('/') || filePath.endsWith('\\')) {
            targetIsDir = true;
          }
        } catch (e) {
          // ignore
        }

        // If it looks like a directory (user provided folder), ask for filename or infer
        if (targetIsDir) {
          let filename = await this.prompt('📄 Filename to create inside the directory (leave empty to infer): ');
          filename = filename.trim();
          if (!filename) {
            // Try to infer filename from code comments or language
            const inferFromCode = (code.match(/^[#\/\*\s-]*([\w\-._]+\.(py|js|ts|txt|md|json|html|css))/mi) || [])[1];
            const extMap: any = { python: 'py', py: 'py', javascript: 'js', typescript: 'ts', txt: 'txt' };
            const inferredExt = extMap[language] || language || 'txt';
            const inferredName = inferFromCode || `untitled.${inferredExt}`;
            filename = inferredName;
            console.log(`ℹ️  Inferred filename: ${filename}`);
          }
          // Join directory and filename
          filePath = path.join(filePath, filename);
        }

        try {
          // Defensive check: if given path is a directory (or looks like one), ensure a filename is appended
          const pathLib = require('path');
          try {
            if ((fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) || filePath.endsWith(pathLib.sep) || filePath.endsWith('/') || filePath.endsWith('\\') || pathLib.basename(filePath) === '') {
              let filename = await this.prompt('📄 Filename to create inside the directory (leave empty to infer): ');
              filename = filename.trim();
              if (!filename) {
                const inferFromCode = (code.match(/^[#\/\*\s-]*([\w\-._]+\.(py|js|ts|txt|md|json|html|css))/mi) || [])[1];
                const extMap: any = { python: 'py', py: 'py', javascript: 'js', typescript: 'ts', txt: 'txt' };
                const inferredExt = extMap[language] || language || 'txt';
                const inferredName = inferFromCode || `untitled.${inferredExt}`;
                filename = inferredName;
                console.log(`ℹ️  Inferred filename: ${filename}`);
              }
              filePath = pathLib.join(filePath, filename);
            }
          } catch (e) {
            // ignore detection errors and proceed
          }

          await this.fileOps.createFile(filePath, code);
        } catch (err) {
          console.error('\x1b[31m❌ Error: Could not create the file.\x1b[0m', err instanceof Error ? err.message : err);
        }
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
