import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';
import { idempotencyKeys, invoices, leads, rateLimitBuckets, workReports } from '../src/infrastructure/db/schema';

/**
 * Removes the records the end-to-end suite creates, so repeated runs do not
 * grow the database without limit. The two seeded worked examples, the real
 * Mr. Ebo invoice and the Shola report, are deliberately left alone.
 *
 * Payments and cost lines are removed by their cascading foreign keys.
 */
const TEST_CUSTOMERS = ['Playwright Test Customer', 'Idempotent Customer', 'Report Source Customer'];
const TEST_LEADS = ['Playwright Visitor', 'Debug Visitor', 'Idempotency Check', 'Spam Bot'];

async function main() {
  const removedReports = await db
    .delete(workReports)
    .where(inArray(workReports.clientName, TEST_CUSTOMERS))
    .returning({ id: workReports.id });

  const removedInvoices = await db
    .delete(invoices)
    .where(inArray(invoices.customerName, TEST_CUSTOMERS))
    .returning({ id: invoices.id });

  const removedLeads = await db
    .delete(leads)
    .where(inArray(leads.fullName, TEST_LEADS))
    .returning({ id: leads.id });

  console.log(
    `removed  reports=${removedReports.length}  invoices=${removedInvoices.length}  leads=${removedLeads.length}`,
  );

  await db.delete(rateLimitBuckets);
  await db.delete(idempotencyKeys);
  console.log('rate limit and idempotency tables cleared');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
