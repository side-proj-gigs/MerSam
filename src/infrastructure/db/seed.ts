import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { calculateTotals, normaliseLines, calculateWorkReportTotals, normaliseCostLines } from '@core/entities';
import { DocumentNumber } from '@core/value-objects/identifiers';
import { photo, PHOTOS } from '@/lib/media';
import { poolConfig } from './connection';
import * as schema from './schema';
import {
  CATEGORY_SEED,
  FAQ_SEED,
  PROJECT_SEED,
  SAMPLE_INVOICE_LINES,
  SERVICE_SEED,
  SETTINGS_SEED,
  TESTIMONIAL_SEED,
} from './seed-data';

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const pool = new Pool(poolConfig(connectionString, { max: 2 }));
const db = drizzle(pool, { schema, casing: 'snake_case' });

const date = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

async function seedAdmin(): Promise<string> {
  const email = (process.env.ADMIN_EMAIL || 'admin@mersam.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
  const name = process.env.ADMIN_NAME || 'MerSam Administrator';

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    console.log(`  owner account ${email} already exists`);
    return existing.id;
  }

  const [created] = await db
    .insert(schema.users)
    .values({
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'owner',
      isActive: true,
    })
    .returning({ id: schema.users.id });

  console.log(`  created owner account ${email}`);
  return created!.id;
}

async function seedSettings(): Promise<void> {
  await db
    .insert(schema.siteSettings)
    .values(SETTINGS_SEED as typeof schema.siteSettings.$inferInsert)
    .onConflictDoUpdate({
      target: schema.siteSettings.id,
      set: { ...SETTINGS_SEED, updatedAt: new Date() } as Record<string, unknown>,
    });
  console.log('  site settings written');
}

async function seedCatalogue(): Promise<Map<string, string>> {
  const categoryIds = new Map<string, string>();

  for (const category of CATEGORY_SEED) {
    const [row] = await db
      .insert(schema.serviceCategories)
      .values({ ...category, isActive: true })
      .onConflictDoUpdate({
        target: schema.serviceCategories.slug,
        set: { ...category, updatedAt: new Date() },
      })
      .returning({ id: schema.serviceCategories.id });
    categoryIds.set(category.slug, row!.id);
  }
  console.log(`  ${CATEGORY_SEED.length} service categories written`);

  const serviceIds = new Map<string, string>();

  for (const [index, service] of SERVICE_SEED.entries()) {
    const values = {
      categoryId: categoryIds.get(service.category) ?? null,
      slug: service.slug,
      name: service.name,
      tagline: service.tagline,
      summary: service.summary,
      body: service.body,
      iconKey: service.iconKey,
      heroImageUrl: photo(PHOTOS[service.hero], { width: 1920, quality: 72 }),
      galleryUrls: service.gallery.map((key) => photo(PHOTOS[key], { width: 1200, quality: 70 })),
      features: service.features,
      deliverables: service.deliverables,
      startingPriceMinor: service.startingPriceMinor,
      priceNote: service.priceNote,
      turnaround: service.turnaround,
      sortOrder: index + 1,
      isActive: true,
      isFeatured: service.featured,
      // The layout template appends the company name, so it is left off here.
      seoTitle: `${service.name} in Ghana`,
      seoDescription: service.summary.slice(0, 300),
    };

    const [row] = await db
      .insert(schema.services)
      .values(values)
      .onConflictDoUpdate({ target: schema.services.slug, set: { ...values, updatedAt: new Date() } })
      .returning({ id: schema.services.id });
    serviceIds.set(service.slug, row!.id);
  }
  console.log(`  ${SERVICE_SEED.length} services written`);

  return serviceIds;
}

async function seedSocialProof(serviceIds: Map<string, string>): Promise<void> {
  const existingTestimonials = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(schema.testimonials);

  if ((existingTestimonials[0]?.value ?? 0) === 0) {
    await db.insert(schema.testimonials).values(
      TESTIMONIAL_SEED.map((item) => ({ ...item, isPublished: true, avatarUrl: null })),
    );
    console.log(`  ${TESTIMONIAL_SEED.length} testimonials written`);
  }

  for (const project of PROJECT_SEED) {
    const values = {
      slug: project.slug,
      title: project.title,
      client: project.client,
      location: project.location,
      summary: project.summary,
      body: project.body,
      serviceId: serviceIds.get(project.serviceSlug) ?? null,
      coverImageUrl: photo(PHOTOS[project.cover], { width: 1600, quality: 72 }),
      galleryUrls: project.gallery.map((key) => photo(PHOTOS[key], { width: 1200, quality: 70 })),
      completedOn: project.completedOn,
      status: 'completed' as const,
      stats: project.stats,
      isPublished: true,
      sortOrder: project.sortOrder,
    };
    await db
      .insert(schema.projects)
      .values(values)
      .onConflictDoUpdate({ target: schema.projects.slug, set: { ...values, updatedAt: new Date() } });
  }
  console.log(`  ${PROJECT_SEED.length} projects written`);

  const existingFaqs = await db.select({ value: sql<number>`count(*)::int` }).from(schema.faqs);
  if ((existingFaqs[0]?.value ?? 0) === 0) {
    await db.insert(schema.faqs).values(FAQ_SEED.map((item) => ({ ...item, isPublished: true })));
    console.log(`  ${FAQ_SEED.length} FAQs written`);
  }
}

/**
 * Recreates the two signed documents the office already uses, so the new system
 * can be checked against paperwork everyone recognises.
 */
async function seedWorkedExamples(ownerId: string, serviceIds: Map<string, string>): Promise<void> {
  const [existing] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(schema.invoices);
  if ((existing?.value ?? 0) > 0) {
    console.log('  worked examples already present, skipping');
    return;
  }

  const [ebo] = await db
    .insert(schema.clients)
    .values({
      reference: 'CL-0001',
      name: 'Mr. Ebo Quartey',
      email: null,
      phone: '+233551830102',
      address: 'Spintex Road',
      city: 'Accra',
      region: 'Greater Accra',
      clientType: 'individual',
      notes: 'Four unit apartment block, Spintex.',
    })
    .returning({ id: schema.clients.id });

  const [shola] = await db
    .insert(schema.clients)
    .values({
      reference: 'CL-0002',
      name: 'Shola',
      email: null,
      phone: '+233551830103',
      address: 'Madina',
      city: 'Accra',
      region: 'Greater Accra',
      clientType: 'individual',
    })
    .returning({ id: schema.clients.id });

  /* --- the Mr. Ebo invoice, GHS 19,830.00 --- */

  const issuedOn = date('2026-10-16');
  const lines = normaliseLines(SAMPLE_INVOICE_LINES, () => randomUUID());
  const totals = calculateTotals({
    lines,
    currency: 'GHS',
    discountKind: 'none',
    discountValue: 0,
    vatRate: 0,
    amountPaidMinor: 0,
  });

  const invoiceNumber = DocumentNumber.invoice(issuedOn, 1);
  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      invoiceNumber,
      customerReference: DocumentNumber.customerReference('Mr. Ebo', invoiceNumber),
      clientId: ebo!.id,
      customerName: 'MR. EBO',
      customerAddress: 'Accra, Ghana',
      customerPhone: '+233551830101',
      currency: 'GHS',
      issuedOn: '2026-10-16',
      dueOn: '2026-10-23',
      status: 'sent',
      discountKind: 'none',
      discountValue: '0',
      vatRate: '0',
      termsText: SETTINGS_SEED.defaultInvoiceTerms,
      paymentDetails: SETTINGS_SEED.defaultPaymentDetails,
      subtotalMinor: totals.subtotal.minorUnits,
      discountMinor: totals.discount.minorUnits,
      vatMinor: totals.vat.minorUnits,
      totalMinor: totals.total.minorUnits,
      amountPaidMinor: 0,
      balanceMinor: totals.total.minorUnits,
      sentAt: issuedOn,
      createdBy: ownerId,
    })
    .returning({ id: schema.invoices.id });

  await db.insert(schema.invoiceLines).values(
    lines.map((line) => ({
      id: line.id,
      invoiceId: invoice!.id,
      unitOfMeasure: line.unitOfMeasure,
      description: line.description,
      quantity: String(line.quantity),
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.lineTotalMinor,
      sortOrder: line.sortOrder,
    })),
  );
  console.log(`  invoice ${invoiceNumber} written at ${totals.total.format()}`);

  /* --- the Shola work completion report, GHS 2,800.00 fully paid --- */

  const [job] = await db
    .insert(schema.jobs)
    .values({
      reference: 'JOB-2026-0001',
      clientId: shola!.id,
      serviceId: serviceIds.get('drainage-works') ?? null,
      title: 'Sewage pipe unblocking and section re-lay',
      description:
        'Client reported a blocked sewage pipe. Line cleared, fall survey carried out and a dropped three metre section re-laid to correct gradient.',
      siteAddress: 'Madina, Accra',
      status: 'completed',
      startedOn: '2026-10-04',
      completedOn: '2026-10-04',
      assignedTo: ownerId,
    })
    .returning({ id: schema.jobs.id });

  const costLines = normaliseCostLines(
    [{ description: 'Labour cost for sewage pipe unblocking', amountMinor: 280000 }],
    () => randomUUID(),
  );
  const reportTotals = calculateWorkReportTotals(costLines, 280000, 'GHS');
  const reportNumber = DocumentNumber.workReport(2026, 1);

  const [report] = await db
    .insert(schema.workReports)
    .values({
      reportNumber,
      jobId: job!.id,
      clientId: shola!.id,
      clientName: 'Shola',
      serviceCategory: 'Plumbing and Sewage Maintenance',
      title: 'Work Completion and Payment Report',
      dateOfWork: '2026-10-04',
      reportDate: '2026-10-26',
      currency: 'GHS',
      introduction:
        'MerSam is pleased to present this report documenting the plumbing maintenance work completed for Shola on 4 October 2026, together with confirmation of the payment received.',
      workPerformed:
        'The client reported that the sewage pipe was blocked. MerSam carried out the necessary plumbing maintenance work to unblock the pipe and restore proper flow.\n\nThe work was successfully completed within one working day.',
      completionNote:
        'MerSam confirms that the sewage pipe unblocking work was completed within one working day. This report serves as a record of the work performed, the total labour cost, and the full payment received.',
      paymentNote:
        'MerSam confirms that the client, Shola, has paid the full amount of GH₵2,800.00 for the work completed.\n\nThe account has been settled in full, and there is no outstanding balance.',
      appreciation:
        'MerSam sincerely appreciates Shola for choosing our services. We remain committed to providing reliable, professional, and efficient plumbing maintenance services to our clients.\n\nThank you for choosing MerSam.',
      preparedBy: 'MerSam',
      totalCostMinor: reportTotals.totalCost.minorUnits,
      totalPaidMinor: reportTotals.totalPaid.minorUnits,
      outstandingMinor: reportTotals.outstanding.minorUnits,
      paymentState: reportTotals.state,
      status: 'issued',
      createdBy: ownerId,
    })
    .returning({ id: schema.workReports.id });

  await db.insert(schema.workReportCostLines).values(
    costLines.map((line) => ({
      id: line.id,
      reportId: report!.id,
      description: line.description,
      amountMinor: line.amountMinor,
      sortOrder: line.sortOrder,
    })),
  );
  console.log(`  work report ${reportNumber} written at ${reportTotals.totalCost.format()}`);
}

async function main(): Promise<void> {
  console.log('Seeding MerSam');
  const ownerId = await seedAdmin();
  await seedSettings();
  const serviceIds = await seedCatalogue();
  await seedSocialProof(serviceIds);
  await seedWorkedExamples(ownerId, serviceIds);
  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
