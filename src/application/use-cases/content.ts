import { ConflictError, NotFoundError, ValidationError } from '@core/errors';
import type {
  FaqEntry,
  ProjectShowcase,
  Service,
  ServiceCategory,
  ServiceWithCategory,
  SessionPrincipal,
  SiteSettings,
  Testimonial,
  UUID,
} from '@core/entities';
import { Slug } from '@core/value-objects/identifiers';
import type {
  AuditLogRepository,
  Cache,
  FaqRepository,
  IdGenerator,
  ProjectRepository,
  ServiceCategoryRepository,
  ServiceRepository,
  SettingsRepository,
  TestimonialRepository,
} from '../ports';
import { requireRole } from './auth';

export interface ContentDeps {
  services: ServiceRepository;
  serviceCategories: ServiceCategoryRepository;
  testimonials: TestimonialRepository;
  projects: ProjectRepository;
  faqs: FaqRepository;
  settings: SettingsRepository;
  audit: AuditLogRepository;
  cache: Cache;
  ids: IdGenerator;
}

const CACHE_TTL_SECONDS = 300;

const KEYS = {
  settings: 'settings:site',
  services: 'services:active',
  categories: 'services:categories',
  service: (slug: string) => `services:slug:${slug}`,
  testimonials: 'testimonials:published',
  projects: 'projects:published',
  faqs: 'faqs:published',
};

/** One read-through helper, so every cached query behaves identically. */
async function cached<T>(cache: Cache, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  await cache.set(key, value, CACHE_TTL_SECONDS);
  return value;
}

export async function invalidate(cache: Cache, ...prefixes: string[]): Promise<void> {
  await Promise.all(prefixes.map((prefix) => cache.deleteByPrefix(prefix)));
}

/* ------------------------------------------------------------ public reads */

export function getSiteSettings(deps: ContentDeps): Promise<SiteSettings> {
  return cached(deps.cache, KEYS.settings, () => deps.settings.get());
}

export function listActiveServices(deps: ContentDeps): Promise<ServiceWithCategory[]> {
  return cached(deps.cache, KEYS.services, () => deps.services.listActive());
}

export function listServiceCategories(deps: ContentDeps): Promise<ServiceCategory[]> {
  return cached(deps.cache, KEYS.categories, () => deps.serviceCategories.listAll());
}

export async function getServiceBySlug(
  deps: ContentDeps,
  slug: string,
): Promise<ServiceWithCategory> {
  const service = await cached(deps.cache, KEYS.service(slug), () => deps.services.findBySlug(slug));
  if (!service || !service.isActive) throw new NotFoundError('Service', slug);
  return service;
}

export function listPublishedTestimonials(deps: ContentDeps, limit = 12): Promise<Testimonial[]> {
  return cached(deps.cache, KEYS.testimonials, () => deps.testimonials.listPublished(limit));
}

export function listPublishedProjects(deps: ContentDeps, limit = 24): Promise<ProjectShowcase[]> {
  return cached(deps.cache, KEYS.projects, () => deps.projects.listPublished(limit));
}

export function listPublishedFaqs(deps: ContentDeps): Promise<FaqEntry[]> {
  return cached(deps.cache, KEYS.faqs, () => deps.faqs.listPublished());
}

export interface HomepageBundle {
  settings: SiteSettings;
  services: ServiceWithCategory[];
  categories: ServiceCategory[];
  testimonials: Testimonial[];
  projects: ProjectShowcase[];
  faqs: FaqEntry[];
}

/**
 * The home page needs six collections. Fetching them together as one bundle
 * keeps it to a single round of parallel queries rather than a waterfall, and
 * every part is individually cached so a later page reuses the same data.
 */
export async function getHomepageBundle(deps: ContentDeps): Promise<HomepageBundle> {
  const [settings, services, categories, testimonials, projects, faqs] = await Promise.all([
    getSiteSettings(deps),
    listActiveServices(deps),
    listServiceCategories(deps),
    listPublishedTestimonials(deps, 9),
    listPublishedProjects(deps, 9),
    listPublishedFaqs(deps),
  ]);
  return { settings, services, categories, testimonials, projects, faqs };
}

/* ----------------------------------------------------------- admin writes */

export type ServiceInput = Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>> & {
  name: string;
};

async function uniqueServiceSlug(
  deps: ContentDeps,
  desired: string,
  exceptId?: UUID,
): Promise<string> {
  const base = Slug.create(desired).value;
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    if (!(await deps.services.slugExists(candidate, exceptId))) return candidate;
  }
  throw new ConflictError('Could not derive a unique web address for that service');
}

export async function createService(
  deps: ContentDeps,
  actor: SessionPrincipal,
  input: ServiceInput,
): Promise<Service> {
  requireRole(actor, 'admin');
  const name = input.name.trim();
  if (!name) throw new ValidationError('A service needs a name');

  const service = await deps.services.create({
    id: deps.ids.next(),
    categoryId: input.categoryId ?? null,
    slug: await uniqueServiceSlug(deps, input.slug || name),
    name,
    tagline: input.tagline ?? '',
    summary: input.summary ?? '',
    body: input.body ?? '',
    iconKey: input.iconKey ?? 'droplet',
    heroImageUrl: input.heroImageUrl ?? '',
    galleryUrls: input.galleryUrls ?? [],
    features: input.features ?? [],
    deliverables: input.deliverables ?? [],
    startingPriceMinor: input.startingPriceMinor ?? null,
    priceNote: input.priceNote ?? '',
    turnaround: input.turnaround ?? '',
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  });

  await invalidate(deps.cache, 'services:');
  await deps.audit.record({
    actorId: actor.userId,
    action: 'create',
    entity: 'service',
    entityId: service.id,
    summary: `${actor.name} added the service ${service.name}`,
  });
  return service;
}

export async function updateService(
  deps: ContentDeps,
  actor: SessionPrincipal,
  id: UUID,
  input: Partial<ServiceInput>,
): Promise<Service> {
  requireRole(actor, 'admin');
  const existing = await deps.services.findById(id);
  if (!existing) throw new NotFoundError('Service', id);

  const slug =
    input.slug && input.slug !== existing.slug
      ? await uniqueServiceSlug(deps, input.slug, id)
      : undefined;

  const service = await deps.services.update(id, {
    ...input,
    ...(input.name ? { name: input.name.trim() } : {}),
    ...(slug ? { slug } : {}),
  });

  await invalidate(deps.cache, 'services:');
  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'service',
    entityId: id,
    summary: `${actor.name} updated the service ${service.name}`,
  });
  return service;
}

export async function deleteService(
  deps: ContentDeps,
  actor: SessionPrincipal,
  id: UUID,
): Promise<void> {
  requireRole(actor, 'admin');
  const existing = await deps.services.findById(id);
  if (!existing) throw new NotFoundError('Service', id);

  await deps.services.delete(id);
  await invalidate(deps.cache, 'services:');
  await deps.audit.record({
    actorId: actor.userId,
    action: 'delete',
    entity: 'service',
    entityId: id,
    summary: `${actor.name} removed the service ${existing.name}`,
  });
}

export async function reorderServices(
  deps: ContentDeps,
  actor: SessionPrincipal,
  order: { id: UUID; sortOrder: number }[],
): Promise<void> {
  requireRole(actor, 'admin');
  await deps.services.reorder(order);
  await invalidate(deps.cache, 'services:');
}

export async function updateSiteSettings(
  deps: ContentDeps,
  actor: SessionPrincipal,
  input: Partial<SiteSettings>,
): Promise<SiteSettings> {
  requireRole(actor, 'admin');
  const settings = await deps.settings.update(input);

  await invalidate(deps.cache, 'settings:');
  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'settings',
    entityId: 'singleton',
    summary: `${actor.name} updated the site settings`,
  });
  return settings;
}
