import dotenv from 'dotenv';
import axios from 'axios';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import * as readline from 'readline';
import { GitHubAuth } from './auth.js';
import { ProviderClient, PROVIDERS, PROVIDER_NAMES } from './providers.js';
import { FileOperations } from './fileOps.js';
import { CLI } from './cli.js';
import { ConfigManager, CodeOllieConfig } from './config.js';

let keytar: any = null;
try {
  keytar = require('keytar');
} catch (err) {
}

dotenv.config();

const SERVICE_NAME = 'codeollie';
const SERVICE_ACCOUNT = 'github';
const FALLBACK_DIR = path.join(os.homedir(), '.codeollie');
const FALLBACK_TOKEN_FILE = path.join(FALLBACK_DIR, 'token');

async function getStoredToken(): Promise<string | null> {
  // Try keytar first, fall back to file storage
  try {
    if (keytar && typeof (keytar as any).getPassword === 'function') {
      const t = await (keytar as any).getPassword(SERVICE_NAME, SERVICE_ACCOUNT);
      if (t) return t;
    }
  } catch (err) {
    // ignore and fallback
  }

  try {
    const data = await fs.readFile(FALLBACK_TOKEN_FILE, 'utf-8');
    return data.trim() || null;
  } catch (err) {
    return null;
  }
}

async function storeToken(token: string): Promise<void> {
  // Try keytar first, fall back to file storage
  try {
    if (keytar && typeof (keytar as any).setPassword === 'function') {
      await (keytar as any).setPassword(SERVICE_NAME, SERVICE_ACCOUNT, token);
      return;
    }
  } catch (err) {
    // ignore and fallback
  }

  try {
    await fs.mkdir(FALLBACK_DIR, { recursive: true });
    await fs.writeFile(FALLBACK_TOKEN_FILE, token, { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.warn('⚠️ Could not store token to fallback file store:', err);
  }
}

async function deleteToken(): Promise<boolean> {
  let deleted = false;
  try {
    if (keytar && typeof (keytar as any).deletePassword === 'function') {
      const res = await (keytar as any).deletePassword(SERVICE_NAME, SERVICE_ACCOUNT);
      deleted = !!res;
    }
  } catch (err) {
    // ignore
  }

  try {
    await fs.unlink(FALLBACK_TOKEN_FILE);
    deleted = true;
  } catch (err) {
    // ignore
  }

  return deleted;
}

async function getGitHubUsername(token: string): Promise<string | null> {
  try {
    const resp = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    });
    return resp.data && resp.data.login ? resp.data.login : null;
  } catch (err) {
    return null;
  }
}

async function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runOnboarding(): Promise<CodeOllieConfig> {
  console.log('\n\x1b[36m╭─ CodeOllie Setup ────────────────────────────────────╮\x1b[0m');
  console.log('\x1b[36m│ Let\'s configure your AI provider and API key         │\x1b[0m');
  console.log('\x1b[36m╰──────────────────────────────────────────────────────╯\x1b[0m\n');

  // Step 1: Select provider
  console.log('\x1b[2mAvailable Providers:\x1b[0m');
  PROVIDERS.forEach((p, i) => {
    console.log(`  \x1b[36m${i + 1}.\x1b[0m ${PROVIDER_NAMES[p]}`);
  });

  const providerChoice = await promptUser('\n\x1b[2mSelect provider (1-6):\x1b[0m ');
  const selectedProvider = PROVIDERS[parseInt(providerChoice) - 1];

  if (!selectedProvider) {
    console.error('\x1b[31m❌ Invalid selection.\x1b[0m');
    process.exit(1);
  }

  // Step 2: Input API key
  const apiKey = await promptUser(`\nEnter API key for \x1b[36m${PROVIDER_NAMES[selectedProvider]}\x1b[0m: `);

  if (!apiKey.trim()) {
    console.error('\x1b[31m❌ API key cannot be empty.\x1b[0m');
    process.exit(1);
  }

  // Step 3: Select model
  console.log(`\n\x1b[2mFetching models for ${PROVIDER_NAMES[selectedProvider]}...\x1b[0m`);
  const models = await ProviderClient.getAvailableModels(selectedProvider, apiKey);
  
  if (models.length === 0) {
    console.error('\x1b[31m❌ No models available for this provider.\x1b[0m');
    process.exit(1);
  }

  console.log('\x1b[2mAvailable Models:\x1b[0m');
  models.forEach((m, i) => {
    console.log(`  \x1b[36m${i + 1}.\x1b[0m ${m}`);
  });

  const modelChoice = await promptUser('\n\x1b[2mSelect model (1-' + models.length + '):\x1b[0m ');
  const selectedModel = models[parseInt(modelChoice) - 1];

  if (!selectedModel) {
    console.error('\x1b[31m❌ Invalid selection.\x1b[0m');
    process.exit(1);
  }

  // Save config
  const config = await ConfigManager.initializeConfig(selectedProvider, apiKey, selectedModel);
  console.log(`\n\x1b[32m✅ Configuration saved! Ready to go.\x1b[0m\n`);

  return config;
}

async function main() {
  const clientId = process.env.GITHUB_CLIENT_ID;

  const args = process.argv.slice(2);
  const forceAuth = args.includes('auth');
  const doLogout = args.includes('logout');
  const noAuth = args.includes('--no-auth');
  const tokenArgIndex = args.indexOf('--token');
  const tokenArg = tokenArgIndex !== -1 && args.length > tokenArgIndex + 1 ? args[tokenArgIndex + 1] : undefined;

  if (!noAuth && !clientId) {
    console.error('\x1b[31m❌ Missing GitHub Client ID. Please set GITHUB_CLIENT_ID in .env or run with --no-auth\x1b[0m');
    process.exit(1);
  }

  if (doLogout) {
    const deleted = await deleteToken();
    if (deleted) console.log('\x1b[32m✅ Logged out and removed stored token.\x1b[0m');
    else console.log('\x1b[33m⚠️ No stored token found.\x1b[0m');
    process.exit(0);
  }

  try {
    let token: string | null = null;

    if (tokenArg) {
      token = tokenArg;
      // store for future use
      await storeToken(token);
      console.log('\x1b[32m✅ Token provided and stored.\x1b[0m');
    }

    if (!token && !forceAuth && !noAuth) {
      token = await getStoredToken();
      if (token) {
        console.log('\x1b[2m🔒 Using stored GitHub token.\x1b[0m');
      }
    }

    if (!token && !noAuth) {
      // Run device flow to get token
      const auth = new GitHubAuth(clientId as string);
      console.log('\x1b[2m🔐 Authenticating with GitHub... (Device Flow)\x1b[0m');
      token = await auth.authenticate();
      await storeToken(token);
    }

    if (noAuth) {
      console.log('\x1b[33m⚠️ Running without GitHub authentication (--no-auth). Some features may be limited.\x1b[0m');
    }

    // Optionally show username
    if (token) {
      const username = await getGitHubUsername(token as string);
      if (username) console.log(`\x1b[32m✅ Signed in as ${username}\x1b[0m\n`);
    }

    // Load or create config
    let config = await ConfigManager.loadConfig();
    if (!config) {
      config = await runOnboarding();
    }

    // Initialize ProviderClient and File Operations
    const providerClient = new ProviderClient(config.activeProvider);
    const fileOps = new FileOperations();

    // Start CLI
    const cli = new CLI(config, providerClient, fileOps);
    await cli.start();
  } catch (error) {
    console.error('\x1b[31m❌ Error:\x1b[0m', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
