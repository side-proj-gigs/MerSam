import { z } from 'zod';
import { PROPOSAL_STATUSES } from '@core/entities';
import { dateSchema, listQuerySchema, moneyMinorSchema, uuidSchema } from './schemas';

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const proposalItemSchema = z.object({
  id: uuidSchema.optional(),
  section: trimmed(160).nullish(),
  title: requiredText(240, 'Item title'),
  description: trimmed(2000).default(''),
  unitOfMeasure: trimmed(32).default('Item'),
  quantity: z.coerce.number().positive('Quantity must be above zero').max(999999),
  unitPriceMinor: moneyMinorSchema,
  isOptional: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const proposalSchema = z.object({
  clientId: uuidSchema.nullish(),
  leadId: uuidSchema.nullish(),
  clientName: requiredText(200, 'Client name'),
  clientCompany: trimmed(200).nullish(),
  clientEmail: z.string().trim().email('Enter a valid email address').nullish().or(z.literal('')),
  clientPhone: trimmed(32).nullish(),
  clientAddress: trimmed(500).nullish(),

  title: requiredText(240, 'Proposal title'),
  salutation: trimmed(160).optional(),
  introduction: trimmed(6000).optional(),
  scopeIntro: trimmed(6000).optional(),
  closing: trimmed(6000).optional(),
  termsText: trimmed(6000).optional(),
  paymentTerms: trimmed(4000).optional(),
  notes: trimmed(4000).nullish(),

  preparedBy: trimmed(160).optional(),
  preparedByRole: trimmed(160).nullish(),

  currency: z.enum(['GHS', 'USD', 'EUR', 'GBP']).default('GHS'),
  discountKind: z.enum(['none', 'fixed', 'percentage']).default('none'),
  discountValue: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(0),

  issuedOn: dateSchema.optional(),
  validUntil: dateSchema.nullish(),
  validForDays: z.coerce.number().int().min(1).max(365).optional(),

  items: z.array(proposalItemSchema).min(1, 'Add at least one line of scope').max(100),
});

export const proposalUpdateSchema = proposalSchema.partial().extend({
  items: z.array(proposalItemSchema).min(1).max(100).optional(),
});

export const proposalFilterSchema = listQuerySchema.extend({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  clientId: uuidSchema.optional(),
});

export const proposalDecisionSchema = z.object({
  decision: z.enum(['accepted', 'declined']),
  note: trimmed(2000).optional(),
});

export const proposalFromLeadSchema = z.object({
  leadId: uuidSchema,
  title: trimmed(240).optional(),
  items: z.array(proposalItemSchema).max(100).optional(),
});

/** Shared by every "email this document" endpoint. */
export const sendDocumentSchema = z.object({
  to: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  note: trimmed(4000).optional(),
});

export const testEmailSchema = z.object({
  to: z.string().trim().email('Enter a valid email address'),
});
