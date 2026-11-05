import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';
import { createRepositories } from '../src/infrastructure/repositories';
import { createProposal } from '../src/application/use-cases/proposals';
import { systemClock, uuidGenerator } from '../src/infrastructure/services';

/** Creates a worked proposal so the feature can be inspected against real data. */
async function main() {
  const repos = createRepositories(db);

  const [owner] = (await db.execute(sql`select id, name from users order by created_at limit 1`))
    .rows as { id: string; name: string }[];
  if (!owner) throw new Error('no user to attribute the proposal to');

  const existing = await repos.proposals.list({ search: 'Ridge Residences', pageSize: 1 });
  if (existing.items.length > 0) {
    console.log('sample proposal already present:', existing.items[0]!.proposalNumber);
    return;
  }

  const proposal = await createProposal(
    {
      proposals: repos.proposals,
      leads: repos.leads,
      settings: repos.settings,
      audit: repos.audit,
      clock: systemClock,
      ids: uuidGenerator,
    },
    { userId: owner.id, email: 'admin@mersam.com', name: owner.name, role: 'owner' },
    {
      clientName: 'Mrs. Adwoa Asante',
      clientCompany: 'Ridge Residences Limited',
      clientEmail: 'adwoa@example.com',
      clientPhone: '+233244607788',
      clientAddress: 'Ridge, Accra',
      title: 'Borehole and treatment plant for Ridge Residences',
      preparedByRole: 'Managing Director',
      vatRate: 0,
      items: [
        { section: 'Phase 1, survey and drilling', title: 'Geophysical survey', description: 'Vertical electrical soundings across the plot with a marked drilling point and written report.', quantity: 1, unitPriceMinor: 350000 },
        { section: 'Phase 1, survey and drilling', title: 'Borehole drilling and construction', description: 'Drilling to an expected 45 metres, casing, screening, gravel pack and development until the water runs clear.', quantity: 1, unitPriceMinor: 3200000 },
        { section: 'Phase 1, survey and drilling', title: 'Pumping test and water analysis', description: 'Sustainable yield established and a laboratory analysis of the raw water.', quantity: 1, unitPriceMinor: 280000 },
        { section: 'Phase 2, treatment and storage', title: 'Multimedia and carbon filtration skid', description: 'Sized from the water analysis, built on a skid and commissioned on site.', quantity: 1, unitPriceMinor: 1850000 },
        { section: 'Phase 2, treatment and storage', title: 'Storage tank, 5,000 litres', quantity: 2, unitPriceMinor: 420000 },
        { section: 'Phase 3, distribution', title: 'Pressure set and distribution pipework', description: 'Pump, controller and distribution to the existing plumbing, pressure tested before handover.', quantity: 1, unitPriceMinor: 1150000 },
        { title: 'Reverse osmosis polishing stage', description: 'Recommended only if the analysis shows dissolved solids above the drinking water limit.', quantity: 1, unitPriceMinor: 1450000, isOptional: true },
        { title: 'Annual service contract', description: 'Two visits a year, media changes and a logged water analysis.', quantity: 1, unitPriceMinor: 480000, isOptional: true },
      ],
    },
  );

  console.log('created', proposal.proposalNumber, 'total', proposal.totalMinor / 100);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
