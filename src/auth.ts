import axios from 'axios';

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
