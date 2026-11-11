import 'dotenv/config';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

/**
 * The one-time consent that produces a Gmail refresh token.
 *
 * Gmail will not send on the strength of an API key. Google documents an API
 * key as being for "public data", and a mailbox is not that. Sending needs an
 * OAuth 2.0 access token, and an access token lasts an hour, which is no use
 * to a server. A refresh token is the durable half: granted once by a person
 * in a browser, exchanged for access tokens thereafter with nobody present.
 *
 * Run this on your own machine. It prints the values to put in the
 * environment and writes nothing to the repository.
 *
 *   npm run gmail:authorise
 *   npm run gmail:authorise -- --client path/to/client_secret.json
 *   npm run gmail:authorise -- --port 5410
 */

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  registeredRedirects: string[];
  source: string;
}

/**
 * Credentials come from the JSON Google hands you, if it is lying about, and
 * from the environment otherwise. Reading the file saves copying two long
 * strings by hand and getting one of them subtly wrong.
 */
function loadCredentials(): Credentials {
  const explicit = arg('client');
  const found = explicit ? [explicit] : globSync('files/client_secret_*.json');

  if (found.length > 0) {
    const file = found[0]!;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
        web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
        installed?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
      };
      const block = parsed.web ?? parsed.installed;
      if (block?.client_id && block.client_secret) {
        return {
          clientId: block.client_id,
          clientSecret: block.client_secret,
          registeredRedirects: block.redirect_uris ?? [],
          source: path.relative(process.cwd(), file),
        };
      }
      fail(`${file} does not look like an OAuth client secret file.`);
    } catch (error) {
      fail(`Could not read ${file}: ${(error as Error).message}`);
    }
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { clientId, clientSecret, registeredRedirects: [], source: 'the environment' };
  }

  return fail(
    [
      'No OAuth client found.',
      '',
      'Either drop the client secret JSON that Google gives you into files/,',
      'or set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.',
      '',
      'To create one, in the Google Cloud console:',
      '  1. Enable the Gmail API for your project.',
      '  2. Configure the OAuth consent screen. External is fine, and add',
      '     yourself as a test user.',
      '  3. Credentials, Create credentials, OAuth client ID, "Web application".',
      '',
      'An API key is not one of these and cannot send mail.',
    ].join('\n'),
  );
}

async function main() {
  const credentials = loadCredentials();
  const port = Number(arg('port') ?? process.env.GMAIL_OAUTH_PORT ?? 5410);

  /**
   * The redirect has to be one Google knows about, and it has to reach this
   * process, which rules out the production URLs: the browser would hand the
   * code to the deployed site instead of to the terminal you are sitting at.
   */
  const registeredLocal = credentials.registeredRedirects.find((uri) =>
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri),
  );
  const redirect = arg('redirect') ?? registeredLocal ?? `http://localhost:${port}/callback`;
  const listenPort = Number(new URL(redirect).port || port);

  console.log(`\nUsing the OAuth client from ${credentials.source}.`);

  if (!registeredLocal && !arg('redirect')) {
    console.log(
      [
        '',
        '  ---------------------------------------------------------------',
        '  This client has no localhost redirect registered. Add one first,',
        '  or Google will answer with redirect_uri_mismatch.',
        '',
        '  Google Cloud console, Credentials, open this OAuth client, and',
        '  under "Authorised redirect URIs" add exactly:',
        '',
        `      ${redirect}`,
        '',
        '  Save, wait a few seconds, then run this command again. There is',
        '  no need to download the JSON again.',
        '',
        `  Currently registered: ${credentials.registeredRedirects.join(', ') || 'none'}`,
        '  ---------------------------------------------------------------',
        '',
        '  Carrying on in case you have already added it.',
      ].join('\n'),
    );
  }

  const state = randomBytes(16).toString('hex');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', credentials.clientId);
  authUrl.searchParams.set('redirect_uri', redirect);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  // Required to be given a refresh token at all, and `consent` forces a fresh
  // one even where this account has authorised the app before.
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log('\nOpen this in a browser and approve the request:\n');
  console.log(`  ${authUrl.toString()}\n`);
  console.log(`Waiting for the redirect back to ${redirect} ...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', redirect);
      if (url.pathname !== new URL(redirect).pathname) {
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

    server.listen(listenPort);
    server.on('error', (error: NodeJS.ErrnoException) =>
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(`Port ${listenPort} is already in use. Pass --port with a free one.`)
          : error,
      ),
    );
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
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirect,
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

  // Ask Gmail which mailbox just granted this, so the sender address is right
  // rather than guessed.
  let address = process.env.GMAIL_SENDER ?? '';
  if (payload.access_token) {
    const profile = (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${payload.access_token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)) as { emailAddress?: string } | null;
    if (profile?.emailAddress) address = profile.emailAddress;
  }

  console.log('\nDone. Put these in .env locally, and in the Vercel project settings:\n');
  console.log(`EMAIL_PROVIDER="gmail"`);
  console.log(`GMAIL_CLIENT_ID="${credentials.clientId}"`);
  console.log(`GMAIL_CLIENT_SECRET="${credentials.clientSecret}"`);
  console.log(`GMAIL_REFRESH_TOKEN="${payload.refresh_token}"`);
  console.log(`GMAIL_SENDER="${address}"\n`);
  console.log('Vercel needs all five: the JSON in files/ is not deployed.');
  console.log('Treat the refresh token like a password. It can send mail as that');
  console.log('account until revoked at https://myaccount.google.com/permissions\n');
}

main().catch((error: Error) => fail(error.message));
