import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';

/**
 * The copy on this site is written without em or en dashes, which is a
 * deliberate house style. This checks the stored content, not just the source.
 */
const DASH = '\u2014';
const EN_DASH = '\u2013';

async function main() {
  const result = await db.execute(sql`
    select 'services' as source, count(*)::int as hits from services
      where body like ${'%' + DASH + '%'} or summary like ${'%' + DASH + '%'}
         or tagline like ${'%' + DASH + '%'} or body like ${'%' + EN_DASH + '%'}
    union all
    select 'faqs', count(*)::int from faqs
      where answer like ${'%' + DASH + '%'} or question like ${'%' + DASH + '%'}
    union all
    select 'projects', count(*)::int from projects
      where body like ${'%' + DASH + '%'} or summary like ${'%' + DASH + '%'}
    union all
    select 'testimonials', count(*)::int from testimonials
      where quote like ${'%' + DASH + '%'}
    union all
    select 'settings', count(*)::int from site_settings
      where about like ${'%' + DASH + '%'} or tagline like ${'%' + DASH + '%'}
         or mission like ${'%' + DASH + '%'}
    union all
    select 'work_reports', count(*)::int from work_reports
      where introduction like ${'%' + DASH + '%'} or work_performed like ${'%' + DASH + '%'}
         or appreciation like ${'%' + DASH + '%'}
  `);

  const rows = (result.rows ?? result) as { source: string; hits: number }[];
  let total = 0;
  for (const row of rows) {
    total += Number(row.hits);
    console.log(`  ${row.source.padEnd(14)} ${row.hits}`);
  }
  console.log(total === 0 ? 'No em or en dashes in stored content' : `FOUND ${total} rows with dashes`);
  if (total > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
