import { describe, expect, it, vi } from 'vitest';

// The client module opens a pool on import, so the environment it reads is
// stubbed before it loads. Nothing here connects to a database.
vi.mock('../../src/infrastructure/config/env', () => ({
  env: {
    nodeEnv: 'test',
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    get isProduction() {
      return false;
    },
  },
}));

const { isTransient } = await import('../../src/infrastructure/db/client');

/**
 * Retrying the wrong error is worse than failing: a retried write that was
 * rejected for a real reason could duplicate work. These assertions pin down
 * exactly which failures are treated as a dropped connection.
 */
describe('transient error classification', () => {
  it('treats a Neon suspend as transient', () => {
    // 57P01 is what Postgres sends when the server shuts the connection down,
    // which is what a Neon scale-to-zero looks like from the client.
    expect(isTransient({ code: '57P01', message: 'terminating connection' })).toBe(true);
    expect(isTransient({ code: '57P03', message: 'cannot connect now' })).toBe(true);
  });

  it('treats socket level failures as transient', () => {
    for (const code of ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', '08006', '08003']) {
      expect(isTransient({ code, message: 'socket problem' }), code).toBe(true);
    }
  });

  it('recognises the driver messages that carry no code', () => {
    expect(isTransient(new Error('Connection terminated unexpectedly'))).toBe(true);
    expect(isTransient(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isTransient(new Error('Client has encountered a connection error'))).toBe(true);
  });

  it('looks through the wrapper Drizzle puts around driver errors', () => {
    const wrapped = Object.assign(new Error('Failed query: select ...'), {
      cause: Object.assign(new Error('terminating connection'), { code: '57P01' }),
    });
    expect(isTransient(wrapped)).toBe(true);
  });

  it('never retries a real database rejection', () => {
    const permanent = [
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      { code: '23503', message: 'foreign key violation' },
      { code: '23502', message: 'null value in column violates not-null constraint' },
      { code: '42703', message: 'column does not exist' },
      { code: '42601', message: 'syntax error at or near' },
      { code: '22P02', message: 'invalid input syntax for type uuid' },
      { code: '40001', message: 'could not serialize access' },
    ];

    for (const error of permanent) {
      expect(isTransient(error), error.code).toBe(false);
    }
  });

  it('is safe when handed something that is not an error', () => {
    expect(isTransient(null)).toBe(false);
    expect(isTransient(undefined)).toBe(false);
    expect(isTransient('a string')).toBe(false);
    expect(isTransient({})).toBe(false);
  });
});
