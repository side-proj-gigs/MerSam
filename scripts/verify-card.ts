import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/infrastructure/db/client';
import { users } from '../src/infrastructure/db/schema';
import { qrSvgFor } from '../src/infrastructure/qr/render';
import { renderWallpaperSvg } from '../src/infrastructure/qr/wallpaper';

const OUT = process.argv[2] ?? '.';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@mersam.com').toLowerCase();

  const [updated] = await db
    .update(users)
    .set({
      jobTitle: 'Managing Director',
      cardSlug: 'mersam-administrator',
      cardPublished: true,
      phone: '+233551830101',
      whatsapp: '+233551830101',
      location: 'Accra, Ghana',
      bio: 'Fourteen years sinking boreholes and building treatment plants across Ghana. If it carries water, we have probably fixed one.',
      specialities: ['Borehole drilling', 'Reverse osmosis', 'Community schemes', 'Pressure testing'],
      linkedinUrl: 'https://www.linkedin.com/company/mersamgh',
    })
    .where(eq(users.email, email))
    .returning({ slug: users.cardSlug, name: users.name, title: users.jobTitle });

  if (!updated) throw new Error(`no user found for ${email}`);
  console.log('card published for', updated.name, '->', `/card/${updated.slug}`);

  const url = `${SITE}/card/${updated.slug}`;

  for (const theme of ['light', 'dark', 'gold'] as const) {
    writeFileSync(`${OUT}/qr-${theme}.svg`, await qrSvgFor(url, { theme, size: 600 }));
  }

  for (const theme of ['dark', 'light', 'gold'] as const) {
    writeFileSync(
      `${OUT}/wallpaper-${theme}.svg`,
      await renderWallpaperSvg({
        name: updated.name,
        jobTitle: updated.title ?? '',
        company: 'MerSam',
        phone: '+233 55 183 0101',
        url,
        theme,
      }),
    );
  }

  console.log('wrote 3 QR codes and 3 wallpapers to', OUT);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
