import { describe, expect, it } from 'vitest';
import { isNeon, poolConfig } from '../../src/infrastructure/db/connection';

const NEON =
  'postgresql://user:secret@ep-example-pooler.c-9.us-east-2.aws.neon.tech/mersam_db?sslmode=require&channel_binding=require';

describe('pool configuration', () => {
  it('keeps certificate verification on', () => {
    // Encrypted but unauthenticated is not good enough: without this the
    // connection can be intercepted by anything that can present a
    // certificate, valid or not.
    expect(poolConfig(NEON).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('strips the parameters that make pg-connection-string warn', () => {
    const { connectionString } = poolConfig(NEON);
    expect(connectionString).not.toContain('sslmode');
    expect(connectionString).not.toContain('channel_binding');
  });

  it('keeps the rest of the connection string intact', () => {
    const { connectionString } = poolConfig(NEON);
    expect(connectionString).toContain('ep-example-pooler.c-9.us-east-2.aws.neon.tech');
    expect(connectionString).toContain('/mersam_db');
    expect(connectionString).toContain('user:secret@');
  });

  it('honours an explicit request to disable TLS', () => {
    // Only a local database would ever ask for this.
    const local = 'postgresql://postgres:postgres@localhost:5432/mersam?sslmode=disable';
    expect(poolConfig(local).ssl).toBeUndefined();
  });

  it('defaults to TLS when no mode is stated', () => {
    const plain = 'postgresql://user:pass@db.example.com:5432/mersam';
    expect(poolConfig(plain).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('passes overrides through', () => {
    const config = poolConfig(NEON, { max: 1, connectionTimeoutMillis: 5000 });
    expect(config.max).toBe(1);
    expect(config.connectionTimeoutMillis).toBe(5000);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('hands an unparseable string straight through rather than mangling it', () => {
    const odd = 'not a url at all';
    expect(poolConfig(odd).connectionString).toBe(odd);
  });

  it('recognises a Neon host', () => {
    expect(isNeon(NEON)).toBe(true);
    expect(isNeon('postgresql://postgres@localhost:5432/mersam')).toBe(false);
  });
});
