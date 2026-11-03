import path from 'node:path';

/** Where the signed-in session is parked for the admin specs to reuse. */
export const ADMIN_STATE = path.join(process.cwd(), 'test-results', '.auth', 'admin.json');

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@mersam.com';

/**
 * Read from the environment, never hardcoded. Playwright loads .env in
 * playwright.config.ts, so a local run picks up the seeded account. A real
 * password committed here would be published with the repository.
 */
export const ADMIN_PASSWORD = (() => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'ADMIN_PASSWORD is not set. The end-to-end suite signs in with the seeded owner account, ' +
        'so copy .env.example to .env and fill it in before running the tests.',
    );
  }
  return password;
})();
