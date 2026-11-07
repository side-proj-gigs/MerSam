import 'dotenv/config';
import { db, pool } from '../src/infrastructure/db/client';
import { inArray, like, or } from 'drizzle-orm';
import {
  idempotencyKeys,
  invoices,
  leads,
  mediaAssets,
  mediaBlobs,
  proposals,
  rateLimitBuckets,
  workReports,
} from '../src/infrastructure/db/schema';

/**
 * Removes the records the end-to-end suite creates, so repeated runs do not
 * grow the database without limit. The two seeded worked examples, the real
 * Mr. Ebo invoice and the Shola report, are deliberately left alone.
 *
 * Payments and cost lines are removed by their cascading foreign keys.
 */
const TEST_CUSTOMERS = ['Playwright Test Customer', 'Idempotent Customer', 'Report Source Customer'];
const TEST_LEADS = [
  'Playwright Visitor',
  'Debug Visitor',
  'Idempotency Check',
  'Spam Bot',
  'Proposal Source Enquiry',
];
const TEST_PROSPECTS = ['Playwright Prospect', 'Proposal Source Enquiry'];

async function main() {
  const removedReports = await db
    .delete(workReports)
    .where(inArray(workReports.clientName, TEST_CUSTOMERS))
    .returning({ id: workReports.id });

  const removedInvoices = await db
    .delete(invoices)
    .where(inArray(invoices.customerName, TEST_CUSTOMERS))
    .returning({ id: invoices.id });

  // Uploads the media spec leaves behind if it fails part way through.
  // Migration 0001 dropped the foreign key, so the bytes do not follow the
  // row automatically and have to be removed by their storage key.
  const removedMedia = await db
    .delete(mediaAssets)
    .where(or(like(mediaAssets.altText, 'e2e upload %'), like(mediaAssets.altText, 'e2e large %')))
    .returning({ id: mediaAssets.id, storageKey: mediaAssets.storageKey });

  const orphanedBlobs = removedMedia
    .map((asset) => asset.storageKey)
    .filter((key): key is string => Boolean(key));
  if (orphanedBlobs.length > 0) {
    await db.delete(mediaBlobs).where(inArray(mediaBlobs.id, orphanedBlobs));
  }

  // Proposals go before leads: one points at the other.
  const removedProposals = await db
    .delete(proposals)
    .where(inArray(proposals.clientName, TEST_PROSPECTS))
    .returning({ id: proposals.id });

  const removedLeads = await db
    .delete(leads)
    .where(inArray(leads.fullName, TEST_LEADS))
    .returning({ id: leads.id });

  console.log(
    `removed  reports=${removedReports.length}  invoices=${removedInvoices.length}` +
      `  proposals=${removedProposals.length}  leads=${removedLeads.length}` +
      `  media=${removedMedia.length}`,
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
