import type {
  Client,
  FaqEntry,
  InvoiceRecord,
  InvoiceStatus,
  Job,
  JobStatus,
  JobWithRelations,
  Lead,
  LeadStatus,
  MediaAsset,
  Page,
  Payment,
  ProjectShowcase,
  Service,
  ServiceCategory,
  ServiceWithCategory,
  SiteSettings,
  Testimonial,
  User,
  UserWithSecret,
  UUID,
  WorkReport,
  WorkReportStatus,
} from '@core/entities';

/* ------------------------------------------------------------------ shared */

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): UUID;
}

/** Runs a callback inside one database transaction and hands back scoped repos. */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

/* ------------------------------------------------------------- content side */

export interface ServiceCategoryRepository {
  listAll(includeInactive?: boolean): Promise<ServiceCategory[]>;
  findById(id: UUID): Promise<ServiceCategory | null>;
  findBySlug(slug: string): Promise<ServiceCategory | null>;
  create(data: Omit<ServiceCategory, 'createdAt' | 'updatedAt'>): Promise<ServiceCategory>;
  update(id: UUID, data: Partial<ServiceCategory>): Promise<ServiceCategory>;
  delete(id: UUID): Promise<void>;
  reorder(order: { id: UUID; sortOrder: number }[]): Promise<void>;
}

export interface ServiceListFilters extends ListQuery {
  categoryId?: UUID;
  featuredOnly?: boolean;
  includeInactive?: boolean;
}

export interface ServiceRepository {
  list(filters: ServiceListFilters): Promise<Page<ServiceWithCategory>>;
  listActive(): Promise<ServiceWithCategory[]>;
  findById(id: UUID): Promise<ServiceWithCategory | null>;
  findBySlug(slug: string): Promise<ServiceWithCategory | null>;
  slugExists(slug: string, exceptId?: UUID): Promise<boolean>;
  create(data: Omit<Service, 'createdAt' | 'updatedAt'>): Promise<Service>;
  update(id: UUID, data: Partial<Service>): Promise<Service>;
  delete(id: UUID): Promise<void>;
  reorder(order: { id: UUID; sortOrder: number }[]): Promise<void>;
}

export interface TestimonialRepository {
  list(filters: ListQuery & { publishedOnly?: boolean }): Promise<Page<Testimonial>>;
  listPublished(limit?: number): Promise<Testimonial[]>;
  findById(id: UUID): Promise<Testimonial | null>;
  create(data: Omit<Testimonial, 'createdAt' | 'updatedAt'>): Promise<Testimonial>;
  update(id: UUID, data: Partial<Testimonial>): Promise<Testimonial>;
  delete(id: UUID): Promise<void>;
}

export interface ProjectRepository {
  list(
    filters: ListQuery & { publishedOnly?: boolean; serviceId?: UUID },
  ): Promise<Page<ProjectShowcase>>;
  listPublished(limit?: number): Promise<ProjectShowcase[]>;
  findById(id: UUID): Promise<ProjectShowcase | null>;
  findBySlug(slug: string): Promise<ProjectShowcase | null>;
  slugExists(slug: string, exceptId?: UUID): Promise<boolean>;
  create(data: Omit<ProjectShowcase, 'createdAt' | 'updatedAt'>): Promise<ProjectShowcase>;
  update(id: UUID, data: Partial<ProjectShowcase>): Promise<ProjectShowcase>;
  delete(id: UUID): Promise<void>;
}

export interface FaqRepository {
  list(filters: ListQuery & { publishedOnly?: boolean }): Promise<Page<FaqEntry>>;
  listPublished(): Promise<FaqEntry[]>;
  findById(id: UUID): Promise<FaqEntry | null>;
  create(data: Omit<FaqEntry, 'createdAt' | 'updatedAt'>): Promise<FaqEntry>;
  update(id: UUID, data: Partial<FaqEntry>): Promise<FaqEntry>;
  delete(id: UUID): Promise<void>;
}

export interface MediaRepository {
  list(filters: ListQuery & { folder?: string }): Promise<Page<MediaAsset>>;
  findById(id: UUID): Promise<MediaAsset | null>;
  create(data: Omit<MediaAsset, 'createdAt' | 'updatedAt'>): Promise<MediaAsset>;
  update(id: UUID, data: Partial<MediaAsset>): Promise<MediaAsset>;
  delete(id: UUID): Promise<void>;
  listFolders(): Promise<string[]>;
}

export interface SettingsRepository {
  get(): Promise<SiteSettings>;
  update(data: Partial<SiteSettings>): Promise<SiteSettings>;
}

/* ----------------------------------------------------------------- CRM side */

export interface LeadFilters extends ListQuery {
  status?: LeadStatus;
  serviceId?: UUID;
  assignedTo?: UUID;
  from?: Date;
  to?: Date;
}

export interface LeadRepository {
  list(filters: LeadFilters): Promise<Page<Lead>>;
  findById(id: UUID): Promise<Lead | null>;
  findByReference(reference: string): Promise<Lead | null>;
  create(data: Omit<Lead, 'createdAt' | 'updatedAt'>): Promise<Lead>;
  update(id: UUID, data: Partial<Lead>): Promise<Lead>;
  delete(id: UUID): Promise<void>;
  countByStatus(): Promise<Record<string, number>>;
  nextSequence(year: number): Promise<number>;
  /** Guards against a double-submitted contact form within a short window. */
  findRecentDuplicate(phone: string, message: string, withinMinutes: number): Promise<Lead | null>;
}

export interface ClientRepository {
  list(filters: ListQuery & { isActive?: boolean }): Promise<Page<Client>>;
  findById(id: UUID): Promise<Client | null>;
  findByPhone(phone: string): Promise<Client | null>;
  create(data: Omit<Client, 'createdAt' | 'updatedAt'>): Promise<Client>;
  update(id: UUID, data: Partial<Client>): Promise<Client>;
  delete(id: UUID): Promise<void>;
  nextSequence(): Promise<number>;
}

export interface JobFilters extends ListQuery {
  status?: JobStatus;
  clientId?: UUID;
  serviceId?: UUID;
  assignedTo?: UUID;
  from?: Date;
  to?: Date;
}

export interface JobRepository {
  list(filters: JobFilters): Promise<Page<JobWithRelations>>;
  findById(id: UUID): Promise<JobWithRelations | null>;
  create(data: Omit<Job, 'createdAt' | 'updatedAt'>): Promise<Job>;
  update(id: UUID, data: Partial<Job>): Promise<Job>;
  delete(id: UUID): Promise<void>;
  countByStatus(): Promise<Record<string, number>>;
  nextSequence(year: number): Promise<number>;
}

/* ------------------------------------------------------------- finance side */

export interface InvoiceFilters extends ListQuery {
  status?: InvoiceStatus;
  clientId?: UUID;
  jobId?: UUID;
  from?: Date;
  to?: Date;
}

export interface InvoiceSummary {
  id: UUID;
  invoiceNumber: string;
  customerName: string;
  issuedOn: Date;
  dueOn: Date | null;
  status: InvoiceStatus;
  currency: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
}

export interface InvoiceRepository {
  list(filters: InvoiceFilters): Promise<Page<InvoiceSummary>>;
  findById(id: UUID): Promise<InvoiceRecord | null>;
  findByNumber(invoiceNumber: string): Promise<InvoiceRecord | null>;
  create(data: Omit<InvoiceRecord, 'createdAt' | 'updatedAt'>): Promise<InvoiceRecord>;
  update(
    id: UUID,
    data: Partial<Omit<InvoiceRecord, 'lines'>>,
    lines?: InvoiceRecord['lines'],
  ): Promise<InvoiceRecord>;
  delete(id: UUID): Promise<void>;
  countSameDay(issuedOn: Date): Promise<number>;
  /** Re-sums payments and writes the paid and balance columns back. */
  refreshPaymentTotals(id: UUID): Promise<InvoiceRecord>;
  revenueBetween(from: Date, to: Date): Promise<{ totalMinor: number; paidMinor: number; count: number }>;
  monthlyRevenue(months: number): Promise<{ month: string; totalMinor: number; paidMinor: number }[]>;
  outstandingTotal(): Promise<number>;
}

export interface PaymentRepository {
  list(
    filters: ListQuery & { invoiceId?: UUID; clientId?: UUID; from?: Date; to?: Date },
  ): Promise<Page<Payment>>;
  listForInvoice(invoiceId: UUID): Promise<Payment[]>;
  findById(id: UUID): Promise<Payment | null>;
  create(data: Omit<Payment, 'createdAt' | 'updatedAt'>): Promise<Payment>;
  delete(id: UUID): Promise<void>;
  totalForInvoice(invoiceId: UUID): Promise<number>;
}

export interface WorkReportRepository {
  list(filters: ListQuery & { status?: WorkReportStatus; clientId?: UUID }): Promise<Page<WorkReport>>;
  findById(id: UUID): Promise<WorkReport | null>;
  findByNumber(reportNumber: string): Promise<WorkReport | null>;
  create(data: Omit<WorkReport, 'createdAt' | 'updatedAt'>): Promise<WorkReport>;
  update(
    id: UUID,
    data: Partial<Omit<WorkReport, 'costLines'>>,
    costLines?: WorkReport['costLines'],
  ): Promise<WorkReport>;
  delete(id: UUID): Promise<void>;
  nextSequence(year: number): Promise<number>;
}

/* -------------------------------------------------------------- access side */

export interface UserRepository {
  list(filters: ListQuery): Promise<Page<User>>;
  findById(id: UUID): Promise<User | null>;
  findByEmail(email: string): Promise<UserWithSecret | null>;
  findByCardSlug(slug: string): Promise<User | null>;
  cardSlugExists(slug: string, exceptId?: UUID): Promise<boolean>;
  /** Fire and forget view counter for a published card. */
  recordCardView(id: UUID): Promise<void>;
  create(data: Omit<UserWithSecret, 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: UUID, data: Partial<UserWithSecret>): Promise<User>;
  delete(id: UUID): Promise<void>;
  count(): Promise<number>;
}

export interface AuditEntry {
  id: UUID;
  actorName: string | null;
  action: string;
  entity: string;
  summary: string;
  createdAt: Date;
}

export interface AuditLogRepository {
  record(entry: {
    actorId: UUID | null;
    action: string;
    entity: string;
    entityId: string | null;
    summary: string;
    metadata?: unknown;
  }): Promise<void>;
  recent(limit: number): Promise<AuditEntry[]>;
}

/* ---------------------------------------------------------------- services */

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface SessionToken {
  token: string;
  expiresAt: Date;
}

export interface TokenService {
  issue(payload: Record<string, unknown>, ttlSeconds: number): Promise<SessionToken>;
  verify<T = Record<string, unknown>>(token: string): Promise<T | null>;
}

/**
 * Idempotency keeps a repeated POST from creating a second invoice or payment.
 * The first call reserves the key, later calls carrying the same key replay the
 * stored response instead of running the use case a second time.
 */
export type IdempotencyLookup =
  | { status: 'in_flight' }
  | { status: 'completed'; response: unknown }
  | null;

export interface IdempotencyStore {
  reserve(key: string, scope: string): Promise<'reserved' | 'in_flight' | 'completed'>;
  complete(key: string, scope: string, response: unknown): Promise<void>;
  lookup(key: string, scope: string): Promise<IdempotencyLookup>;
  release(key: string, scope: string): Promise<void>;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }>;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

export interface StoredFile {
  key: string;
  byteSize: number;
  mimeType: string;
}

/**
 * Bytes are addressed by an opaque key. Nothing outside this port knows whether
 * they live in object storage or in Postgres, and the public URL is always a
 * route this application serves, so swapping the driver changes no URLs.
 */
export interface FileStorage {
  save(input: { folder: string; filename: string; mimeType: string; data: Buffer }): Promise<StoredFile>;
  read(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  remove(key: string): Promise<void>;
}

export interface Notifier {
  notifyNewLead(lead: Lead): Promise<void>;
}

/** Everything the composition root wires together, handed to the use cases. */
export interface Repositories {
  services: ServiceRepository;
  serviceCategories: ServiceCategoryRepository;
  testimonials: TestimonialRepository;
  projects: ProjectRepository;
  faqs: FaqRepository;
  media: MediaRepository;
  settings: SettingsRepository;
  leads: LeadRepository;
  clients: ClientRepository;
  jobs: JobRepository;
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  workReports: WorkReportRepository;
  users: UserRepository;
  audit: AuditLogRepository;
}
