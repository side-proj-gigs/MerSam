import 'dotenv/config';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

/**
 * The one-time consent that produces a Gmail refresh token.
 *
 * Gmail will not send on the strength of an API key. Google's documentation
 * is explicit that an API key is for "public data", and a mailbox is not
 * that. Sending needs an OAuth 2.0 access token, and an access token lasts an
 * hour, which is no use to a server that has to keep sending. A refresh token
 * is the durable half: granted once by a person in a browser, exchanged for
 * access tokens thereafter without anybody present.
 *
 * Run this once on your own machine. It prints the three values to put in the
 * environment. Nothing is written to the repository.
 *
 *   npm run gmail:authorise
 */

const PORT = Number(process.env.GMAIL_OAUTH_PORT ?? 5410);
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    fail(
      [
        'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first.',
        '',
        'To get them, in the Google Cloud console:',
        '  1. Create or pick a project, then enable the Gmail API.',
        '  2. Configure the OAuth consent screen. External is fine. Add',
        '     yourself as a test user.',
        '  3. Credentials, Create credentials, OAuth client ID, type',
        '     "Web application".',
        `  4. Add this exact authorised redirect URI: ${REDIRECT}`,
        '  5. Copy the client ID and client secret into .env.',
        '',
        'An API key is not one of these and will not work: Gmail needs OAuth.',
      ].join('\n'),
    );
  }

  const state = randomBytes(16).toString('hex');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  // Required to be given a refresh token at all, and `consent` forces one
  // even if this account has authorised the app before.
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log('\nOpen this in a browser and approve the request:\n');
  console.log(`  ${authUrl.toString()}\n`);
  console.log(`Waiting for the redirect back to ${REDIRECT} ...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
      if (url.pathname !== '/callback') {
        response.writeHead(404).end('Not here');
        return;
      }

      const error = url.searchParams.get('error');
      const returned = url.searchParams.get('code');

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        `<!doctype html><meta charset="utf-8"><title>MerSam</title>
         <body style="font:16px system-ui;padding:3rem;max-width:34rem;margin:auto">
         <h1 style="font-size:1.25rem">${error ? 'Authorisation refused' : 'Authorised'}</h1>
         <p>${error ? `Google said: ${error}` : 'You can close this tab and go back to the terminal.'}</p>`,
      );

      server.close();
      if (error || !returned) reject(new Error(error ?? 'No authorisation code came back'));
      else if (url.searchParams.get('state') !== state) reject(new Error('State did not match'));
      else resolve(returned);
    });

    server.listen(PORT);
    server.on('error', reject);
    // Nobody is going to sit there for an hour.
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out after five minutes'));
    }, 5 * 60_000).unref();
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });

  const payload = (await tokenResponse.json()) as {
    refresh_token?: string;
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !payload.refresh_token) {
    fail(
      `Google did not return a refresh token: ${
        payload.error_description ?? payload.error ?? `HTTP ${tokenResponse.status}`
      }`,
    );
  }

  // Ask Gmail which mailbox just granted this, so the sender address is
  // right rather than guessed.
  let address = process.env.GMAIL_SENDER ?? '';
  if (payload.access_token) {
    const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${payload.access_token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (profile && typeof profile.emailAddress === 'string') address = profile.emailAddress;
  }

  console.log('\nDone. Put these in .env locally, and in the Vercel project settings:\n');
  console.log(`GMAIL_SENDER="${address}"`);
  console.log(`GMAIL_REFRESH_TOKEN="${payload.refresh_token}"`);
  console.log('EMAIL_PROVIDER="gmail"\n');
  console.log('Treat the refresh token like a password: it can send mail as that account');
  console.log('until it is revoked at https://myaccount.google.com/permissions\n');
}

main().catch((error: Error) => fail(error.message));
