import type { Timestamped, UUID } from './common';

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost', 'archived'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['website', 'whatsapp', 'phone', 'referral', 'walk_in', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const URGENCY_LEVELS = ['flexible', 'this_week', 'urgent', 'emergency'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

/** A quote request raised from the public site or logged by the office. */
export interface Lead extends Timestamped {
  id: UUID;
  reference: string;
  fullName: string;
  email: string | null;
  phone: string;
  location: string;
  serviceId: UUID | null;
  serviceName: string | null;
  message: string;
  urgency: Urgency;
  budgetHint: string | null;
  status: LeadStatus;
  source: LeadSource;
  assignedTo: UUID | null;
  clientId: UUID | null;
  convertedAt: Date | null;
  lastContactedAt: Date | null;
  internalNotes: string | null;
}

export interface Client extends Timestamped {
  id: UUID;
  reference: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string;
  altPhone: string | null;
  address: string;
  city: string;
  region: string;
  clientType: 'individual' | 'business' | 'institution' | 'community';
  notes: string | null;
  isActive: boolean;
}

export const JOB_STATUSES = [
  'scheduled',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A unit of work on site. Invoices and completion reports both hang off a job. */
export interface Job extends Timestamped {
  id: UUID;
  reference: string;
  clientId: UUID;
  serviceId: UUID | null;
  leadId: UUID | null;
  title: string;
  description: string;
  siteAddress: string;
  status: JobStatus;
  scheduledFor: Date | null;
  startedOn: Date | null;
  completedOn: Date | null;
  assignedTo: UUID | null;
  photoUrls: string[];
  internalNotes: string | null;
}

export interface JobWithRelations extends Job {
  clientName: string;
  serviceName: string | null;
}
