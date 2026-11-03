import type { PoolConfig } from 'pg';

/**
 * Builds the pg pool configuration from a connection string.
 *
 * Two things happen here, both deliberate.
 *
 * The `sslmode` and `channel_binding` parameters are stripped out and TLS is
 * configured explicitly instead. `pg-connection-string` currently treats
 * `sslmode=require` as `verify-full` and warns that a future major version
 * will adopt libpq semantics, under which `require` encrypts but does *not*
 * authenticate the server. Rather than inherit whichever meaning the library
 * happens to use, the intent is stated in code: encrypt and verify.
 *
 * Verification is left on. Neon presents a certificate from a publicly trusted
 * CA, so turning it off buys nothing and costs the guarantee that the host
 * answering is the host we meant to reach.
 */
export function poolConfig(connectionString: string, overrides: PoolConfig = {}): PoolConfig {
  let url: URL | null = null;
  try {
    url = new URL(connectionString);
  } catch {
    // Not a parseable URL, so hand it to pg untouched and let it complain.
  }

  const requestedMode = url?.searchParams.get('sslmode') ?? 'require';
  const wantsTls = requestedMode !== 'disable';

  if (url) {
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
  }

  return {
    connectionString: url ? url.toString() : connectionString,
    ssl: wantsTls ? { rejectUnauthorized: true } : undefined,
    ...overrides,
  };
}

/** True when the connection points at Neon, which shapes the pool sizing. */
export function isNeon(connectionString: string): boolean {
  return connectionString.includes('neon.tech');
}
