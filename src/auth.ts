import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import { createServer } from 'http';
import { spawn } from 'child_process';

// Implements GitHub OAuth Device Flow for CLI-friendly authentication
// Docs: https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow
export class GitHubAuth {
  private clientId: string;
  private scope: string;

  constructor(clientId: string, scope: string = 'repo user:email') {
    this.clientId = clientId;
    this.scope = scope;
  }

  async authenticate(): Promise<string> {
    // Step 1: Request a device and user code
    const deviceResp = await axios.post(
      'https://github.com/login/device/code',
      new URLSearchParams({
        client_id: this.clientId,
        scope: this.scope,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
    );

    const { device_code, user_code, verification_uri, expires_in, interval } = deviceResp.data;

    console.log('\n\x1b[36m╭─ GitHub Device Authorization ───────────────────────╮\x1b[0m');
    console.log(`\x1b[36m│ Open in browser: ${verification_uri.padEnd(33)}\x1b[36m│\x1b[0m`);
    console.log(`\x1b[36m│ Code: ${user_code.padEnd(55)}\x1b[36m│\x1b[0m`);
    console.log('\x1b[36m│ A browser window will open. If not, visit URL above. │\x1b[0m');
    console.log('\x1b[36m╰──────────────────────────────────────────────────────╯\x1b[0m\n');

    try {
      const cp = await import('child_process');
      const spawn = (cp as any).spawn || (cp as any).default?.spawn;
      if (process.platform === 'win32') {
        // Use cmd start to open default browser on Windows
        spawn('cmd', ['/c', 'start', '', verification_uri], { detached: true, stdio: 'ignore' }).unref?.();
      } else if (process.platform === 'darwin') {
        spawn('open', [verification_uri], { detached: true, stdio: 'ignore' }).unref?.();
      } else {
        spawn('xdg-open', [verification_uri], { detached: true, stdio: 'ignore' }).unref?.();
      }
    } catch (err) {
      // ignore - user can open manually
    }

    // Step 2: Poll for the token
    const pollInterval = (interval && Number(interval) > 0) ? Number(interval) * 1000 : 5000;
    const expiresAt = Date.now() + (Number(expires_in) * 1000);

    while (Date.now() < expiresAt) {
      try {
        const tokenResp = await axios.post(
          'https://github.com/login/oauth/access_token',
          new URLSearchParams({
            client_id: this.clientId,
            device_code: device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
        );

        const data = tokenResp.data;

        if (data.error) {
          if (data.error === 'authorization_pending') {
            // Not ready yet; wait and continue polling
            await this.sleep(pollInterval);
            continue;
          }

          if (data.error === 'slow_down') {
            // Increase poll interval
            await this.sleep(pollInterval + 5000);
            continue;
          }

          if (data.error === 'expired_token') {
            throw new Error('Device code expired. Please retry authentication.');
          }

          throw new Error(`Authentication error: ${data.error}`);
        }

        if (data.access_token) {
          console.log('\x1b[32m✅ Authentication successful!\x1b[0m\n');
          return data.access_token as string;
        }

        // otherwise wait and retry
        await this.sleep(pollInterval);
      } catch (err: any) {
        // network or other unexpected error: retry until expiry
        if (Date.now() + pollInterval >= expiresAt) {
          throw err;
        }
        await this.sleep(pollInterval);
      }
    }

    throw new Error('Authentication timed out. Please retry.');
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class GoogleAuth {
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async authenticate(): Promise<string> {
    const state = randomBytes(32).toString('hex');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const server = createServer();

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Could not start local server for Google sign-in.');
    }

    const redirectUri = `http://127.0.0.1:${address.port}/`;
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();

    console.log('\n\x1b[36m╭─ Google Sign-In ─────────────────────────────────────╮\x1b[0m');
    console.log('\x1b[36m│ Complete sign-in in the browser window that opens.   │\x1b[0m');
    console.log(`\x1b[36m│ If it does not open, visit:\n│ ${authorizationUrl.toString()}\x1b[0m`);
    console.log('\x1b[36m╰──────────────────────────────────────────────────────╯\x1b[0m\n');
    this.openBrowser(authorizationUrl.toString());

    const authorizationCode = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Google sign-in timed out. Please retry.'));
      }, 5 * 60 * 1000);

      const finish = (error?: Error, code?: string) => {
        clearTimeout(timeout);
        server.close();
        if (error) reject(error);
        else if (code) resolve(code);
        else reject(new Error('Google sign-in did not return an authorization code.'));
      };

      server.on('request', (request, response) => {
        const callbackUrl = new URL(request.url || '/', redirectUri);
        if (callbackUrl.pathname !== '/') {
          response.writeHead(404).end('Not found');
          return;
        }

        if (callbackUrl.searchParams.get('state') !== state) {
          response.writeHead(400).end('Invalid sign-in state. You can close this page.');
          return;
        }

        const authorizationError = callbackUrl.searchParams.get('error');
        if (authorizationError) {
          response.writeHead(400).end('Google sign-in was not completed. You can close this page.');
          finish(new Error(`Google sign-in failed: ${authorizationError}`));
          return;
        }

        const code = callbackUrl.searchParams.get('code');
        if (!code) {
          response.writeHead(400).end('Google did not return an authorization code. You can close this page.');
          finish(new Error('Google sign-in did not return an authorization code.'));
          return;
        }

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><title>Google sign-in complete</title><p>Sign-in complete. You can close this window.</p>');
        finish(undefined, code);
      });
    });

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: this.clientId,
        code: authorizationCode,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (typeof tokenResponse.data.access_token !== 'string' || !tokenResponse.data.access_token) {
      throw new Error('Google sign-in did not return an access token.');
    }

    console.log('\x1b[32m✅ Google sign-in successful!\x1b[0m\n');
    return tokenResponse.data.access_token;
  }

  private openBrowser(url: string): void {
    try {
      let command: string;
      let args: string[];
      if (process.platform === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', '', url];
      } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
      } else {
        command = 'xdg-open';
        args = [url];
      }

      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.on('error', () => {
        console.log('Could not open a browser automatically. Open the URL printed above to continue.');
      });
      child.unref();
    } catch {
      console.log('Could not open a browser automatically. Open the URL printed above to continue.');
    }
  }
}
