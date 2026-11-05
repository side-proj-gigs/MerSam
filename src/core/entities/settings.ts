import type { Timestamped } from './common';

export interface BusinessHour {
  day: string;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface OfficeLocation {
  label: string;
  addressLines: string[];
  phone: string | null;
  mapUrl: string | null;
}

export interface HeroSlide {
  eyebrow: string;
  headline: string;
  subhead: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface StatHighlight {
  label: string;
  value: string;
  suffix: string;
}

/**
 * One editable document behind every piece of chrome on the public site: the
 * phone number in the header, the address in the footer, the hero carousel and
 * the defaults stamped onto new invoices.
 */
export interface SiteSettings extends Timestamped {
  id: string;
  companyName: string;
  legalName: string;
  tagline: string;
  about: string;
  mission: string;
  logoUrl: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  whatsappNumber: string | null;
  primaryEmail: string;
  supportEmail: string | null;
  addressLines: string[];
  city: string;
  region: string;
  country: string;
  mapEmbedUrl: string | null;
  businessHours: BusinessHour[];
  socials: SocialLink[];
  offices: OfficeLocation[];
  heroSlides: HeroSlide[];
  stats: StatHighlight[];
  emergencyBannerText: string | null;
  emergencyBannerEnabled: boolean;
  defaultVatRate: number;
  defaultCurrency: string;
  defaultInvoiceTerms: string;
  defaultPaymentDetails: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  momoNumber: string | null;
  momoAccountName: string | null;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  ogImageUrl: string | null;

  /* Outbound email. The provider key lives in the environment, never here. */
  emailEnabled: boolean;
  emailFromName: string | null;
  emailFromAddress: string | null;
  emailReplyTo: string | null;
  /** Internal copy of every message, so the office keeps its own record. */
  emailBcc: string | null;
  emailSignature: string | null;
  sendEnquiryConfirmation: boolean;
}

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
