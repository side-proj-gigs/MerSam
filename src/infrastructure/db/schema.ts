import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ---------------------------------------------------------------- enums */

export const roleEnum = pgEnum('role', ['viewer', 'staff', 'admin', 'owner']);
export const leadStatusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
  'archived',
]);
export const leadSourceEnum = pgEnum('lead_source', [
  'website',
  'whatsapp',
  'phone',
  'referral',
  'walk_in',
  'other',
]);
export const urgencyEnum = pgEnum('urgency', ['flexible', 'this_week', 'urgent', 'emergency']);
export const clientTypeEnum = pgEnum('client_type', [
  'individual',
  'business',
  'institution',
  'community',
]);
export const jobStatusEnum = pgEnum('job_status', [
  'scheduled',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'void',
]);
export const discountKindEnum = pgEnum('discount_kind', ['none', 'fixed', 'percentage']);
export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'mobile_money',
  'bank_transfer',
  'cheque',
  'card',
  'other',
]);
export const paymentStateEnum = pgEnum('payment_state', ['fully_paid', 'part_payment', 'unpaid']);
export const workReportStatusEnum = pgEnum('work_report_status', ['draft', 'issued', 'archived']);
export const projectStatusEnum = pgEnum('project_status', ['completed', 'ongoing']);
export const mediaSourceEnum = pgEnum('media_source', ['upload', 'external']);
export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
]);
export const emailKindEnum = pgEnum('email_kind', [
  'enquiry_confirmation',
  'lead_notification',
  'invoice',
  'work_report',
  'proposal',
  'test',
]);
export const emailStatusEnum = pgEnum('email_status', ['sent', 'failed', 'skipped']);

/* ------------------------------------------------------------- helpers */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

const pk = () => uuid('id').primaryKey().defaultRandom();

/** Drizzle has no first-class bytea column, so this maps one onto Buffer. */
const customBytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/* ------------------------------------------------------------- access */

export const users = pgTable(
  'users',
  {
    id: pk(),
    email: varchar('email', { length: 254 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('staff'),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),

    /* Digital business card. Every member of staff can be given a shareable
       card at /card/<slug>, reachable from a printed or on-screen QR code. */
    jobTitle: varchar('job_title', { length: 120 }),
    cardSlug: varchar('card_slug', { length: 64 }),
    cardPublished: boolean('card_published').notNull().default(false),
    phone: varchar('phone', { length: 32 }),
    whatsapp: varchar('whatsapp', { length: 32 }),
    bio: text('bio'),
    location: varchar('location', { length: 160 }),
    linkedinUrl: text('linkedin_url'),
    specialities: jsonb('specialities').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    cardViews: integer('card_views').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Bumping this invalidates every session token already in the wild. */
    tokenVersion: integer('token_version').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
    uniqueIndex('users_card_slug_unique').on(t.cardSlug),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: pk(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    entity: varchar('entity', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt.desc())],
);

/* ------------------------------------------------------------ settings */

export const siteSettings = pgTable('site_settings', {
  id: varchar('id', { length: 16 }).primaryKey().default('singleton'),
  companyName: varchar('company_name', { length: 160 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }).notNull(),
  tagline: text('tagline').notNull(),
  about: text('about').notNull(),
  mission: text('mission').notNull(),
  logoUrl: text('logo_url').notNull(),
  primaryPhone: varchar('primary_phone', { length: 32 }).notNull(),
  secondaryPhone: varchar('secondary_phone', { length: 32 }),
  whatsappNumber: varchar('whatsapp_number', { length: 32 }),
  primaryEmail: varchar('primary_email', { length: 254 }).notNull(),
  supportEmail: varchar('support_email', { length: 254 }),
  addressLines: jsonb('address_lines').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  city: varchar('city', { length: 120 }).notNull(),
  region: varchar('region', { length: 120 }).notNull(),
  country: varchar('country', { length: 120 }).notNull(),
  mapEmbedUrl: text('map_embed_url'),
  businessHours: jsonb('business_hours').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  socials: jsonb('socials').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  offices: jsonb('offices').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  heroSlides: jsonb('hero_slides').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  stats: jsonb('stats').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  emergencyBannerText: text('emergency_banner_text'),
  emergencyBannerEnabled: boolean('emergency_banner_enabled').notNull().default(false),
  defaultVatRate: numeric('default_vat_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('GHS'),
  defaultInvoiceTerms: text('default_invoice_terms').notNull(),
  defaultPaymentDetails: text('default_payment_details').notNull(),
  bankName: varchar('bank_name', { length: 160 }),
  bankAccountName: varchar('bank_account_name', { length: 160 }),
  bankAccountNumber: varchar('bank_account_number', { length: 64 }),
  momoNumber: varchar('momo_number', { length: 32 }),
  momoAccountName: varchar('momo_account_name', { length: 160 }),
  seoTitle: varchar('seo_title', { length: 200 }).notNull(),
  seoDescription: text('seo_description').notNull(),
  seoKeywords: jsonb('seo_keywords').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  ogImageUrl: text('og_image_url'),

  /* Outbound email. The provider key itself lives in the environment and is
     never stored here, so a database dump cannot leak the ability to send. */
  emailEnabled: boolean('email_enabled').notNull().default(false),
  emailFromName: varchar('email_from_name', { length: 160 }),
  emailFromAddress: varchar('email_from_address', { length: 254 }),
  emailReplyTo: varchar('email_reply_to', { length: 254 }),
  /** Internal copy of everything sent, so the office keeps its own record. */
  emailBcc: varchar('email_bcc', { length: 254 }),
  emailSignature: text('email_signature'),
  sendEnquiryConfirmation: boolean('send_enquiry_confirmation').notNull().default(true),
  ...timestamps,
});

/* ----------------------------------------------------------- catalogue */

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: pk(),
    slug: varchar('slug', { length: 96 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description').notNull().default(''),
    iconKey: varchar('icon_key', { length: 48 }).notNull().default('droplet'),
    accentColor: varchar('accent_color', { length: 16 }).notNull().default('#C9A227'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('service_categories_slug_unique').on(t.slug)],
);

export const services = pgTable(
  'services',
  {
    id: pk(),
    categoryId: uuid('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
    slug: varchar('slug', { length: 96 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    tagline: text('tagline').notNull().default(''),
    summary: text('summary').notNull().default(''),
    body: text('body').notNull().default(''),
    iconKey: varchar('icon_key', { length: 48 }).notNull().default('droplet'),
    heroImageUrl: text('hero_image_url').notNull().default(''),
    galleryUrls: jsonb('gallery_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    features: jsonb('features').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    deliverables: jsonb('deliverables').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    startingPriceMinor: integer('starting_price_minor'),
    priceNote: varchar('price_note', { length: 200 }).notNull().default(''),
    turnaround: varchar('turnaround', { length: 120 }).notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    seoTitle: varchar('seo_title', { length: 200 }),
    seoDescription: text('seo_description'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('services_slug_unique').on(t.slug),
    index('services_active_idx').on(t.isActive, t.sortOrder),
    index('services_category_idx').on(t.categoryId),
  ],
);

export const testimonials = pgTable(
  'testimonials',
  {
    id: pk(),
    authorName: varchar('author_name', { length: 160 }).notNull(),
    authorRole: varchar('author_role', { length: 160 }).notNull().default(''),
    location: varchar('location', { length: 160 }).notNull().default(''),
    quote: text('quote').notNull(),
    rating: smallint('rating').notNull().default(5),
    avatarUrl: text('avatar_url'),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    isPublished: boolean('is_published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('testimonials_published_idx').on(t.isPublished, t.sortOrder)],
);

export const projects = pgTable(
  'projects',
  {
    id: pk(),
    slug: varchar('slug', { length: 96 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    client: varchar('client', { length: 160 }).notNull().default(''),
    location: varchar('location', { length: 160 }).notNull().default(''),
    summary: text('summary').notNull().default(''),
    body: text('body').notNull().default(''),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    coverImageUrl: text('cover_image_url').notNull().default(''),
    galleryUrls: jsonb('gallery_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    completedOn: date('completed_on'),
    status: projectStatusEnum('status').notNull().default('completed'),
    stats: jsonb('stats').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    isPublished: boolean('is_published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('projects_slug_unique').on(t.slug),
    index('projects_published_idx').on(t.isPublished, t.sortOrder),
  ],
);

export const faqs = pgTable(
  'faqs',
  {
    id: pk(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    category: varchar('category', { length: 96 }).notNull().default('General'),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('faqs_published_idx').on(t.isPublished, t.sortOrder)],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: pk(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    altText: varchar('alt_text', { length: 300 }).notNull().default(''),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    byteSize: integer('byte_size').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    folder: varchar('folder', { length: 96 }).notNull().default('general'),
    storageKey: text('storage_key'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    source: mediaSourceEnum('source').notNull().default('upload'),
    ...timestamps,
  },
  (t) => [index('media_folder_idx').on(t.folder, t.createdAt.desc())],
);

/* ----------------------------------------------------------------- CRM */

export const clients = pgTable(
  'clients',
  {
    id: pk(),
    reference: varchar('reference', { length: 32 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    contactPerson: varchar('contact_person', { length: 160 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }).notNull(),
    altPhone: varchar('alt_phone', { length: 32 }),
    address: text('address').notNull().default(''),
    city: varchar('city', { length: 120 }).notNull().default(''),
    region: varchar('region', { length: 120 }).notNull().default(''),
    clientType: clientTypeEnum('client_type').notNull().default('individual'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('clients_reference_unique').on(t.reference),
    index('clients_phone_idx').on(t.phone),
    index('clients_name_idx').on(t.name),
  ],
);

export const leads = pgTable(
  'leads',
  {
    id: pk(),
    reference: varchar('reference', { length: 32 }).notNull(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 32 }).notNull(),
    location: varchar('location', { length: 200 }).notNull().default(''),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    serviceName: varchar('service_name', { length: 160 }),
    message: text('message').notNull(),
    urgency: urgencyEnum('urgency').notNull().default('flexible'),
    budgetHint: varchar('budget_hint', { length: 120 }),
    status: leadStatusEnum('status').notNull().default('new'),
    source: leadSourceEnum('source').notNull().default('website'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    internalNotes: text('internal_notes'),
    /** Short hash of phone plus message, used to swallow double submissions. */
    dedupeHash: varchar('dedupe_hash', { length: 64 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('leads_reference_unique').on(t.reference),
    index('leads_status_idx').on(t.status, t.createdAt.desc()),
    index('leads_dedupe_idx').on(t.dedupeHash, t.createdAt.desc()),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: pk(),
    reference: varchar('reference', { length: 32 }).notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description').notNull().default(''),
    siteAddress: text('site_address').notNull().default(''),
    status: jobStatusEnum('status').notNull().default('scheduled'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    startedOn: date('started_on'),
    completedOn: date('completed_on'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    internalNotes: text('internal_notes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('jobs_reference_unique').on(t.reference),
    index('jobs_status_idx').on(t.status, t.scheduledFor),
    index('jobs_client_idx').on(t.clientId),
  ],
);

/* ------------------------------------------------------------- finance */

export const invoices = pgTable(
  'invoices',
  {
    id: pk(),
    invoiceNumber: varchar('invoice_number', { length: 32 }).notNull(),
    customerReference: varchar('customer_reference', { length: 48 }).notNull().default(''),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    customerName: varchar('customer_name', { length: 200 }).notNull(),
    customerAddress: text('customer_address'),
    customerPhone: varchar('customer_phone', { length: 32 }),
    customerEmail: varchar('customer_email', { length: 254 }),
    currency: varchar('currency', { length: 3 }).notNull().default('GHS'),
    issuedOn: date('issued_on').notNull(),
    dueOn: date('due_on'),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    discountKind: discountKindEnum('discount_kind').notNull().default('none'),
    discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull().default('0'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    termsText: text('terms_text').notNull().default(''),
    paymentDetails: text('payment_details').notNull().default(''),
    notes: text('notes'),
    subtotalMinor: integer('subtotal_minor').notNull().default(0),
    discountMinor: integer('discount_minor').notNull().default(0),
    vatMinor: integer('vat_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull().default(0),
    amountPaidMinor: integer('amount_paid_minor').notNull().default(0),
    balanceMinor: integer('balance_minor').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('invoices_number_unique').on(t.invoiceNumber),
    index('invoices_status_idx').on(t.status, t.issuedOn.desc()),
    index('invoices_client_idx').on(t.clientId),
    index('invoices_issued_idx').on(t.issuedOn.desc()),
  ],
);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: pk(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    unitOfMeasure: varchar('unit_of_measure', { length: 32 }).notNull().default('Pcs'),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
    unitPriceMinor: integer('unit_price_minor').notNull().default(0),
    lineTotalMinor: integer('line_total_minor').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('invoice_lines_invoice_idx').on(t.invoiceId, t.sortOrder)],
);

export const payments = pgTable(
  'payments',
  {
    id: pk(),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    amountMinor: integer('amount_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('GHS'),
    method: paymentMethodEnum('method').notNull().default('cash'),
    reference: varchar('reference', { length: 120 }),
    paidOn: date('paid_on').notNull(),
    note: text('note'),
    recordedBy: uuid('recorded_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('payments_invoice_idx').on(t.invoiceId),
    index('payments_paid_on_idx').on(t.paidOn.desc()),
  ],
);

export const workReports = pgTable(
  'work_reports',
  {
    id: pk(),
    reportNumber: varchar('report_number', { length: 32 }).notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    clientName: varchar('client_name', { length: 200 }).notNull(),
    serviceCategory: varchar('service_category', { length: 160 }).notNull().default(''),
    title: varchar('title', { length: 240 }).notNull().default('Work Completion and Payment Report'),
    dateOfWork: date('date_of_work').notNull(),
    reportDate: date('report_date').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('GHS'),
    introduction: text('introduction').notNull().default(''),
    workPerformed: text('work_performed').notNull().default(''),
    completionNote: text('completion_note').notNull().default(''),
    paymentNote: text('payment_note').notNull().default(''),
    appreciation: text('appreciation').notNull().default(''),
    preparedBy: varchar('prepared_by', { length: 160 }).notNull().default('MerSam'),
    authorisedRepresentative: varchar('authorised_representative', { length: 160 }),
    signatureImageUrl: text('signature_image_url'),
    photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    totalCostMinor: integer('total_cost_minor').notNull().default(0),
    totalPaidMinor: integer('total_paid_minor').notNull().default(0),
    outstandingMinor: integer('outstanding_minor').notNull().default(0),
    paymentState: paymentStateEnum('payment_state').notNull().default('unpaid'),
    status: workReportStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('work_reports_number_unique').on(t.reportNumber),
    index('work_reports_status_idx').on(t.status, t.reportDate.desc()),
  ],
);

export const workReportCostLines = pgTable(
  'work_report_cost_lines',
  {
    id: pk(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => workReports.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amountMinor: integer('amount_minor').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('work_report_lines_report_idx').on(t.reportId, t.sortOrder)],
);

/**
 * Uploaded bytes live in Neon alongside everything else, which keeps the whole
 * deployment to one managed service. Files are capped at a few megabytes and
 * served through a route that sets a long immutable cache header, so the blob
 * is read once per edge location rather than once per visitor.
 */
export const mediaBlobs = pgTable('media_blobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: customBytea('data').notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull().default('application/octet-stream'),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  createdAt: timestamps.createdAt,
});

/* ----------------------------------------------------------- proposals */

/**
 * A proposal is a letter with a priced scope attached. The narrative fields
 * carry the letter, the line items carry the table, and the money columns
 * behave exactly like an invoice so one set of rules covers both.
 */
export const proposals = pgTable(
  'proposals',
  {
    id: pk(),
    proposalNumber: varchar('proposal_number', { length: 32 }).notNull(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

    clientName: varchar('client_name', { length: 200 }).notNull(),
    clientCompany: varchar('client_company', { length: 200 }),
    clientEmail: varchar('client_email', { length: 254 }),
    clientPhone: varchar('client_phone', { length: 32 }),
    clientAddress: text('client_address'),

    title: varchar('title', { length: 240 }).notNull(),
    salutation: varchar('salutation', { length: 160 }).notNull().default('Dear Sir or Madam'),
    introduction: text('introduction').notNull().default(''),
    scopeIntro: text('scope_intro').notNull().default(''),
    closing: text('closing').notNull().default(''),
    termsText: text('terms_text').notNull().default(''),
    paymentTerms: text('payment_terms').notNull().default(''),
    notes: text('notes'),

    preparedBy: varchar('prepared_by', { length: 160 }).notNull().default('MerSam'),
    preparedByRole: varchar('prepared_by_role', { length: 160 }),

    currency: varchar('currency', { length: 3 }).notNull().default('GHS'),
    discountKind: discountKindEnum('discount_kind').notNull().default('none'),
    discountValue: numeric('discount_value', { precision: 12, scale: 2 }).notNull().default('0'),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    subtotalMinor: integer('subtotal_minor').notNull().default(0),
    discountMinor: integer('discount_minor').notNull().default(0),
    vatMinor: integer('vat_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull().default(0),

    issuedOn: date('issued_on').notNull(),
    validUntil: date('valid_until'),
    status: proposalStatusEnum('status').notNull().default('draft'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('proposals_number_unique').on(t.proposalNumber),
    index('proposals_status_idx').on(t.status, t.issuedOn.desc()),
    index('proposals_client_idx').on(t.clientId),
  ],
);

export const proposalItems = pgTable(
  'proposal_items',
  {
    id: pk(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    /** Groups items under a heading, for example a phase or a work package. */
    section: varchar('section', { length: 160 }),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description').notNull().default(''),
    unitOfMeasure: varchar('unit_of_measure', { length: 32 }).notNull().default('Item'),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull().default('1'),
    unitPriceMinor: integer('unit_price_minor').notNull().default(0),
    lineTotalMinor: integer('line_total_minor').notNull().default(0),
    /** Priced but excluded from the total until the client asks for it. */
    isOptional: boolean('is_optional').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('proposal_items_proposal_idx').on(t.proposalId, t.sortOrder)],
);

/* --------------------------------------------------------------- email */

/**
 * Every send attempt is recorded, successful or not. It gives the office a
 * record of what went out, and it is what makes resending safe: the use case
 * can see that a document has already reached an address.
 */
export const emailLog = pgTable(
  'email_log',
  {
    id: pk(),
    kind: emailKindEnum('kind').notNull(),
    status: emailStatusEnum('status').notNull(),
    recipient: varchar('recipient', { length: 254 }).notNull(),
    subject: varchar('subject', { length: 400 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }),
    entityId: uuid('entity_id'),
    providerId: varchar('provider_id', { length: 120 }),
    error: text('error'),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index('email_log_entity_idx').on(t.entityType, t.entityId, t.createdAt.desc()),
    index('email_log_created_idx').on(t.createdAt.desc()),
  ],
);

/* --------------------------------------------------------- idempotency */

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 128 }).notNull(),
    scope: varchar('scope', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('in_flight'),
    response: jsonb('response'),
    createdAt: timestamps.createdAt,
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('idempotency_key_scope_unique').on(t.key, t.scope),
    index('idempotency_created_idx').on(t.createdAt),
  ],
);

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: varchar('key', { length: 160 }).primaryKey(),
    hits: integer('hits').notNull().default(0),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_limit_window_idx').on(t.windowStart)],
);

/* ----------------------------------------------------------- relations */

export const servicesRelations = relations(services, ({ one }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  lines: many(invoiceLines),
  payments: many(payments),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  job: one(jobs, { fields: [invoices.jobId], references: [jobs.id] }),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
}));

export const workReportsRelations = relations(workReports, ({ many, one }) => ({
  costLines: many(workReportCostLines),
  client: one(clients, { fields: [workReports.clientId], references: [clients.id] }),
  job: one(jobs, { fields: [workReports.jobId], references: [jobs.id] }),
}));

export const workReportCostLinesRelations = relations(workReportCostLines, ({ one }) => ({
  report: one(workReports, { fields: [workReportCostLines.reportId], references: [workReports.id] }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  service: one(services, { fields: [jobs.serviceId], references: [services.id] }),
}));

export const proposalsRelations = relations(proposals, ({ many, one }) => ({
  items: many(proposalItems),
  client: one(clients, { fields: [proposals.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [proposals.leadId], references: [leads.id] }),
}));

export const proposalItemsRelations = relations(proposalItems, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalItems.proposalId], references: [proposals.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));
