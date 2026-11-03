import type { Timestamped, UUID } from './common';

/**
 * Every service MerSam sells is a row the office can edit, so the marketing
 * pages, the quote form and the invoice line presets all read from one source.
 */
export interface ServiceCategory extends Timestamped {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  accentColor: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ServiceFeature {
  title: string;
  detail: string;
}

export interface Service extends Timestamped {
  id: UUID;
  categoryId: UUID | null;
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  /** Long-form body shown on the service detail page, written as Markdown. */
  body: string;
  iconKey: string;
  heroImageUrl: string;
  galleryUrls: string[];
  features: ServiceFeature[];
  deliverables: string[];
  /** Indicative floor price in minor units, null when quoted per site visit. */
  startingPriceMinor: number | null;
  priceNote: string;
  turnaround: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ServiceWithCategory extends Service {
  category: ServiceCategory | null;
}

export interface Testimonial extends Timestamped {
  id: UUID;
  authorName: string;
  authorRole: string;
  location: string;
  quote: string;
  rating: number;
  avatarUrl: string | null;
  serviceId: UUID | null;
  isPublished: boolean;
  sortOrder: number;
}

export type ProjectStatus = 'completed' | 'ongoing';

export interface ProjectShowcase extends Timestamped {
  id: UUID;
  slug: string;
  title: string;
  client: string;
  location: string;
  summary: string;
  body: string;
  serviceId: UUID | null;
  coverImageUrl: string;
  galleryUrls: string[];
  completedOn: Date | null;
  status: ProjectStatus;
  stats: { label: string; value: string }[];
  isPublished: boolean;
  sortOrder: number;
}

export interface FaqEntry extends Timestamped {
  id: UUID;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface MediaAsset extends Timestamped {
  id: UUID;
  url: string;
  thumbnailUrl: string | null;
  altText: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  folder: string;
  /** Opaque handle for the storage driver, null for externally hosted media. */
  storageKey: string | null;
  uploadedBy: UUID | null;
  source: 'upload' | 'external';
}
