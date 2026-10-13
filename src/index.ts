import dotenv from 'dotenv';
import axios from 'axios';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import * as readline from 'readline';
import { GitHubAuth, GoogleAuth } from './auth.js';
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
const FALLBACK_DIR = path.join(os.homedir(), '.codeollie');
type AuthProvider = 'github' | 'google';

function getFallbackTokenFile(provider: AuthProvider): string {
  return path.join(FALLBACK_DIR, provider === 'github' ? 'token' : 'google-token');
}

async function getStoredToken(provider: AuthProvider): Promise<string | null> {
  // Try keytar first, fall back to file storage
  try {
    if (keytar && typeof (keytar as any).getPassword === 'function') {
      const t = await (keytar as any).getPassword(SERVICE_NAME, provider);
      if (t) return t;
    }
  } catch (err) {
    // ignore and fallback
  }

  try {
    const data = await fs.readFile(getFallbackTokenFile(provider), 'utf-8');
    return data.trim() || null;
  } catch (err) {
    return null;
  }
}

async function storeToken(provider: AuthProvider, token: string): Promise<void> {
  // Try keytar first, fall back to file storage
  try {
    if (keytar && typeof (keytar as any).setPassword === 'function') {
      await (keytar as any).setPassword(SERVICE_NAME, provider, token);
      return;
    }
  } catch (err) {
    // ignore and fallback
  }

  try {
    await fs.mkdir(FALLBACK_DIR, { recursive: true });
    await fs.writeFile(getFallbackTokenFile(provider), token, { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.warn('⚠️ Could not store token to fallback file store:', err);
  }
}

async function deleteToken(provider: AuthProvider): Promise<boolean> {
  let deleted = false;
  try {
    if (keytar && typeof (keytar as any).deletePassword === 'function') {
      const res = await (keytar as any).deletePassword(SERVICE_NAME, provider);
      deleted = !!res;
    }
  } catch (err) {
    // ignore
  }

  try {
    await fs.unlink(getFallbackTokenFile(provider));
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

async function getGoogleUserEmail(token: string): Promise<string | null> {
  try {
    const response = await axios.get<{ email?: string }>(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.email || null;
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

async function promptAuthProvider(): Promise<AuthProvider> {
  console.log('\n\x1b[36m╭─ Sign In ────────────────────────────────────────────╮\x1b[0m');
  console.log('\x1b[36m│ 1. Sign in with Google                              │\x1b[0m');
  console.log('\x1b[36m│ 2. Sign in with GitHub                              │\x1b[0m');
  console.log('\x1b[36m╰──────────────────────────────────────────────────────╯\x1b[0m');

  while (true) {
    const choice = await promptUser('\nSelect option (1-2): ');
    if (choice.trim() === '1') return 'google';
    if (choice.trim() === '2') return 'github';
    console.error('\x1b[31m❌ Select 1 for Google or 2 for GitHub.\x1b[0m');
  }
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
  const args = process.argv.slice(2);
  const forceAuth = args.includes('auth');
  const doLogout = args.includes('logout');
  const noAuth = args.includes('--no-auth');
  const authProviderArg = args.find((arg) => arg.startsWith('--auth-provider='));
  const authProviderIndex = args.indexOf('--auth-provider');
  const requestedAuthProvider = authProviderArg?.slice('--auth-provider='.length)
    || (authProviderIndex !== -1 ? args[authProviderIndex + 1] : undefined);
  const authProviderValue = requestedAuthProvider
    || (!noAuth && !doLogout ? await promptAuthProvider() : 'github');
  if (authProviderValue !== 'github' && authProviderValue !== 'google') {
    console.error('\x1b[31m❌ Auth provider must be either "github" or "google".\x1b[0m');
    process.exit(1);
  }
  const authProvider: AuthProvider = authProviderValue;
  const tokenArgIndex = args.indexOf('--token');
  const tokenArg = tokenArgIndex !== -1 && args.length > tokenArgIndex + 1 ? args[tokenArgIndex + 1] : undefined;

  if (doLogout) {
    const deleted = await deleteToken(authProvider);
    if (deleted) console.log(`\x1b[32m✅ Logged out of ${authProvider} and removed its stored token.\x1b[0m`);
    else console.log('\x1b[33m⚠️ No stored token found.\x1b[0m');
    process.exit(0);
  }

  try {
    const clientId = authProvider === 'google'
      ? process.env.GOOGLE_CLIENT_ID
      : process.env.GITHUB_CLIENT_ID;
    let token: string | null = null;

    if (tokenArg) {
      token = tokenArg;
      // store for future use
      await storeToken(authProvider, token);
      console.log('\x1b[32m✅ Token provided and stored.\x1b[0m');
    }

    if (!token && !forceAuth && !noAuth) {
      token = await getStoredToken(authProvider);
      if (token) {
        console.log(`\x1b[2m🔒 Using stored ${authProvider} token.\x1b[0m`);
      }
    }

    if (!token && !noAuth) {
      if (!clientId) {
        const variable = authProvider === 'google' ? 'GOOGLE_CLIENT_ID' : 'GITHUB_CLIENT_ID';
        throw new Error(`Missing ${variable}. Set it in .env or run with --no-auth.`);
      }

      if (authProvider === 'google') {
        const auth = new GoogleAuth(clientId);
        token = await auth.authenticate();
      } else {
        const auth = new GitHubAuth(clientId);
        console.log('\x1b[2m🔐 Authenticating with GitHub... (Device Flow)\x1b[0m');
        token = await auth.authenticate();
      }
      await storeToken(authProvider, token);
    }

    if (noAuth) {
      console.log(`\x1b[33m⚠️ Running without ${authProvider} authentication (--no-auth). Some features may be limited.\x1b[0m`);
    }

    // Optionally show username
    if (token) {
      const identity = authProvider === 'google'
        ? await getGoogleUserEmail(token)
        : await getGitHubUsername(token);
      if (identity) console.log(`\x1b[32m✅ Signed in to ${authProvider} as ${identity}\x1b[0m\n`);
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
