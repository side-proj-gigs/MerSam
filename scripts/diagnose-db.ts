import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';

async function main() {
  const columns = await db.execute(sql`
    select column_name from information_schema.columns
    where table_name = 'users' and column_name in
      ('card_slug','card_published','job_title','specialities','card_views','phone','whatsapp','bio','location','linkedin_url')
    order by column_name
  `);
  const names = ((columns.rows ?? columns) as { column_name: string }[]).map((r) => r.column_name);
  console.log('card columns present:', names.join(', ') || 'NONE');

  const applied = await db.execute(sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`);
  console.log('migrations applied:', ((applied.rows ?? applied) as unknown[]).length);

  const card = await db.execute(
    sql`select name, card_slug, card_published from users where card_slug = 'mersam-administrator'`,
  );
  console.log('card row:', JSON.stringify((card.rows ?? card)));
}

main()
  .catch((error) => {
    console.error('DIAGNOSIS FAILED');
    console.error('  message:', (error as Error).message);
    const cause = (error as { cause?: Error }).cause;
    if (cause) console.error('  cause:', cause.message, '| code:', (cause as { code?: string }).code);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
