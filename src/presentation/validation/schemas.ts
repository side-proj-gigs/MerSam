import { z } from 'zod';
import {
  DISCOUNT_KINDS,
  INVOICE_STATUSES,
  JOB_STATUSES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PAYMENT_METHODS,
  ROLES,
  URGENCY_LEVELS,
  WORK_REPORT_STATUSES,
} from '@core/entities';

/* ------------------------------------------------------------- primitives */

export const uuidSchema = z.string().uuid('That identifier is not valid');

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Accepts "1,100.50", "1100.5" or a number and yields integer minor units. */
export const moneyMinorSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const raw = typeof value === 'number' ? value : Number(value.replace(/[,\s]/g, ''));
    if (!Number.isFinite(raw)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount' });
      return z.NEVER;
    }
    if (raw < 0) {
      ctx.addIssue({ code: 'custom', message: 'Amounts cannot be negative' });
      return z.NEVER;
    }
    return Math.round(raw * 100);
  });

export const dateSchema = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid date' });
      return z.NEVER;
    }
    return parsed;
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: trimmed(200).optional(),
  sort: trimmed(40).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
});

export function parseListQuery(url: URL): z.infer<typeof listQuerySchema> {
  return listQuerySchema.parse(Object.fromEntries(url.searchParams));
}

/* ------------------------------------------------------------------ auth */

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').max(254),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const createUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  name: requiredText(160, 'Name'),
  password: z.string().min(10, 'Passwords must be at least 10 characters'),
  role: z.enum(ROLES),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(10, 'Passwords must be at least 10 characters'),
});

/* --------------------------------------------------------------- enquiry */

export const enquirySchema = z.object({
  fullName: requiredText(200, 'Your name'),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  phone: requiredText(32, 'Your phone number'),
  location: trimmed(200).default(''),
  serviceId: uuidSchema.nullish(),
  message: z
    .string()
    .trim()
    .min(10, 'Please describe what you need in a little more detail')
    .max(4000, 'Please keep your message under 4000 characters'),
  urgency: z.enum(URGENCY_LEVELS).default('flexible'),
  budgetHint: trimmed(120).nullish(),
  /** Hidden field, left empty by a person and filled in by a bot. */
  website: z.string().max(200).optional(),
});

export const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: uuidSchema.nullish(),
  note: trimmed(2000).optional(),
});

export const leadFilterSchema = listQuerySchema.extend({
  status: z.enum(LEAD_STATUSES).optional(),
  serviceId: uuidSchema.optional(),
});

/* ------------------------------------------------------------- catalogue */

export const serviceFeatureSchema = z.object({
  title: requiredText(160, 'Feature title'),
  detail: trimmed(600).default(''),
});

export const serviceSchema = z.object({
  name: requiredText(160, 'Service name'),
  slug: trimmed(96).optional(),
  categoryId: uuidSchema.nullish(),
  tagline: trimmed(300).default(''),
  summary: trimmed(1200).default(''),
  body: trimmed(20000).default(''),
  iconKey: trimmed(48).default('droplet'),
  heroImageUrl: trimmed(1000).default(''),
  galleryUrls: z.array(z.string().trim().max(1000)).max(24).default([]),
  features: z.array(serviceFeatureSchema).max(16).default([]),
  deliverables: z.array(z.string().trim().max(300)).max(24).default([]),
  startingPriceMinor: moneyMinorSchema.nullish(),
  priceNote: trimmed(200).default(''),
  turnaround: trimmed(120).default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  seoTitle: trimmed(200).nullish(),
  seoDescription: trimmed(600).nullish(),
});

export const serviceCategorySchema = z.object({
  name: requiredText(160, 'Category name'),
  slug: trimmed(96).optional(),
  description: trimmed(1000).default(''),
  iconKey: trimmed(48).default('droplet'),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six digit hex colour such as #C9A227')
    .default('#C9A227'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const testimonialSchema = z.object({
  authorName: requiredText(160, 'Author name'),
  authorRole: trimmed(160).default(''),
  location: trimmed(160).default(''),
  quote: requiredText(1500, 'Quote'),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  avatarUrl: trimmed(1000).nullish(),
  serviceId: uuidSchema.nullish(),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const projectSchema = z.object({
  title: requiredText(200, 'Project title'),
  slug: trimmed(96).optional(),
  client: trimmed(160).default(''),
  location: trimmed(160).default(''),
  summary: trimmed(1200).default(''),
  body: trimmed(20000).default(''),
  serviceId: uuidSchema.nullish(),
  coverImageUrl: trimmed(1000).default(''),
  galleryUrls: z.array(z.string().trim().max(1000)).max(24).default([]),
  completedOn: dateSchema.nullish(),
  status: z.enum(['completed', 'ongoing']).default('completed'),
  stats: z
    .array(z.object({ label: requiredText(80, 'Label'), value: requiredText(80, 'Value') }))
    .max(8)
    .default([]),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const faqSchema = z.object({
  question: requiredText(500, 'Question'),
  answer: requiredText(4000, 'Answer'),
  category: trimmed(96).default('General'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isPublished: z.boolean().default(true),
});

export const reorderSchema = z.object({
  order: z.array(z.object({ id: uuidSchema, sortOrder: z.number().int().min(0) })).max(500),
});

/* -------------------------------------------------------------- settings */

export const settingsSchema = z
  .object({
    companyName: requiredText(160, 'Company name'),
    legalName: trimmed(200).default(''),
    tagline: trimmed(400).default(''),
    about: trimmed(6000).default(''),
    mission: trimmed(3000).default(''),
    logoUrl: trimmed(1000).default(''),
    primaryPhone: requiredText(32, 'Primary phone'),
    secondaryPhone: trimmed(32).nullish(),
    whatsappNumber: trimmed(32).nullish(),
    primaryEmail: z.string().trim().email('Enter a valid email address'),
    supportEmail: z.string().trim().email('Enter a valid email address').nullish().or(z.literal('')),
    addressLines: z.array(z.string().trim().max(200)).max(6).default([]),
    city: trimmed(120).default(''),
    region: trimmed(120).default(''),
    country: trimmed(120).default('Ghana'),
    mapEmbedUrl: trimmed(2000).nullish(),
    businessHours: z
      .array(
        z.object({
          day: requiredText(20, 'Day'),
          opensAt: trimmed(10).default('08:00'),
          closesAt: trimmed(10).default('17:00'),
          isClosed: z.boolean().default(false),
        }),
      )
      .max(7)
      .default([]),
    socials: z
      .array(z.object({ platform: requiredText(40, 'Platform'), url: trimmed(500).default('') }))
      .max(10)
      .default([]),
    offices: z
      .array(
        z.object({
          label: requiredText(120, 'Label'),
          addressLines: z.array(z.string().trim().max(200)).max(6).default([]),
          phone: trimmed(32).nullish(),
          mapUrl: trimmed(2000).nullish(),
        }),
      )
      .max(6)
      .default([]),
    heroSlides: z
      .array(
        z.object({
          eyebrow: trimmed(120).default(''),
          headline: requiredText(200, 'Headline'),
          subhead: trimmed(500).default(''),
          imageUrl: trimmed(1000).default(''),
          ctaLabel: trimmed(60).default('Request a quote'),
          ctaHref: trimmed(300).default('/contact'),
        }),
      )
      .max(8)
      .default([]),
    stats: z
      .array(
        z.object({
          label: requiredText(80, 'Label'),
          value: requiredText(20, 'Value'),
          suffix: trimmed(10).default(''),
        }),
      )
      .max(8)
      .default([]),
    emergencyBannerText: trimmed(300).nullish(),
    emergencyBannerEnabled: z.boolean().default(false),
    defaultVatRate: z.coerce.number().min(0).max(100).default(0),
    defaultCurrency: z.enum(['GHS', 'USD', 'EUR', 'GBP']).default('GHS'),
    defaultInvoiceTerms: trimmed(4000).default(''),
    defaultPaymentDetails: trimmed(2000).default(''),
    bankName: trimmed(160).nullish(),
    bankAccountName: trimmed(160).nullish(),
    bankAccountNumber: trimmed(64).nullish(),
    momoNumber: trimmed(32).nullish(),
    momoAccountName: trimmed(160).nullish(),
    seoTitle: trimmed(200).default(''),
    seoDescription: trimmed(600).default(''),
    seoKeywords: z.array(z.string().trim().max(60)).max(30).default([]),
    ogImageUrl: trimmed(1000).nullish(),
  })
  .partial();

/* ---------------------------------------------------------------- clients */

export const clientSchema = z.object({
  name: requiredText(200, 'Client name'),
  contactPerson: trimmed(160).nullish(),
  email: z.string().trim().email('Enter a valid email address').nullish().or(z.literal('')),
  phone: requiredText(32, 'Phone number'),
  altPhone: trimmed(32).nullish(),
  address: trimmed(500).default(''),
  city: trimmed(120).default(''),
  region: trimmed(120).default(''),
  clientType: z.enum(['individual', 'business', 'institution', 'community']).default('individual'),
  notes: trimmed(4000).nullish(),
  isActive: z.boolean().default(true),
});

export const jobSchema = z.object({
  clientId: uuidSchema,
  serviceId: uuidSchema.nullish(),
  leadId: uuidSchema.nullish(),
  title: requiredText(240, 'Job title'),
  description: trimmed(6000).default(''),
  siteAddress: trimmed(500).default(''),
  status: z.enum(JOB_STATUSES).default('scheduled'),
  scheduledFor: dateSchema.nullish(),
  startedOn: dateSchema.nullish(),
  completedOn: dateSchema.nullish(),
  assignedTo: uuidSchema.nullish(),
  photoUrls: z.array(z.string().trim().max(1000)).max(40).default([]),
  internalNotes: trimmed(4000).nullish(),
});

/* -------------------------------------------------------------- invoices */

export const invoiceLineSchema = z.object({
  id: uuidSchema.optional(),
  unitOfMeasure: trimmed(32).default('Pcs'),
  description: requiredText(500, 'Description'),
  quantity: z.coerce.number().positive('Quantity must be above zero').max(999999),
  unitPriceMinor: moneyMinorSchema,
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const invoiceSchema = z.object({
  clientId: uuidSchema.nullish(),
  jobId: uuidSchema.nullish(),
  customerName: requiredText(200, 'Customer name'),
  customerAddress: trimmed(500).nullish(),
  customerPhone: trimmed(32).nullish(),
  customerEmail: z.string().trim().email('Enter a valid email address').nullish().or(z.literal('')),
  currency: z.enum(['GHS', 'USD', 'EUR', 'GBP']).default('GHS'),
  issuedOn: dateSchema.optional(),
  dueOn: dateSchema.nullish(),
  discountKind: z.enum(DISCOUNT_KINDS).default('none'),
  discountValue: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  termsText: trimmed(4000).optional(),
  paymentDetails: trimmed(2000).optional(),
  notes: trimmed(4000).nullish(),
  lines: z.array(invoiceLineSchema).min(1, 'Add at least one line item').max(200),
});

export const invoiceUpdateSchema = invoiceSchema.partial().extend({
  lines: z.array(invoiceLineSchema).min(1).max(200).optional(),
});

export const invoiceFilterSchema = listQuerySchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  clientId: uuidSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const paymentSchema = z.object({
  amountMinor: moneyMinorSchema,
  method: z.enum(PAYMENT_METHODS).default('cash'),
  reference: trimmed(120).nullish(),
  paidOn: dateSchema.optional(),
  note: trimmed(1000).nullish(),
});

/* ---------------------------------------------------------- work reports */

export const costLineSchema = z.object({
  id: uuidSchema.optional(),
  description: requiredText(500, 'Description'),
  amountMinor: moneyMinorSchema,
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const workReportSchema = z.object({
  jobId: uuidSchema.nullish(),
  clientId: uuidSchema.nullish(),
  invoiceId: uuidSchema.nullish(),
  clientName: requiredText(200, 'Client name'),
  serviceCategory: requiredText(160, 'Service category'),
  title: trimmed(240).optional(),
  dateOfWork: dateSchema,
  reportDate: dateSchema.optional(),
  currency: z.enum(['GHS', 'USD', 'EUR', 'GBP']).default('GHS'),
  introduction: trimmed(4000).optional(),
  workPerformed: requiredText(8000, 'Description of work performed'),
  completionNote: trimmed(4000).optional(),
  paymentNote: trimmed(4000).optional(),
  appreciation: trimmed(4000).optional(),
  preparedBy: trimmed(160).optional(),
  authorisedRepresentative: trimmed(160).nullish(),
  signatureImageUrl: trimmed(1000).nullish(),
  photoUrls: z.array(z.string().trim().max(1000)).max(40).default([]),
  costLines: z.array(costLineSchema).min(1, 'Add at least one cost line').max(100),
  totalPaidMinor: moneyMinorSchema,
});

export const workReportUpdateSchema = workReportSchema.partial().extend({
  costLines: z.array(costLineSchema).min(1).max(100).optional(),
  status: z.enum(WORK_REPORT_STATUSES).optional(),
});

/* ------------------------------------------------------------------ misc */

export const mediaSchema = z.object({
  url: z.string().trim().min(1, 'A media URL is required').max(1000),
  thumbnailUrl: trimmed(1000).nullish(),
  altText: trimmed(300).default(''),
  folder: trimmed(96).default('general'),
  mimeType: trimmed(120).default('image/jpeg'),
});

export const leadSourceSchema = z.enum(LEAD_SOURCES);
