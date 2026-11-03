import { and, asc, count, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { NotFoundError } from '@core/errors';
import type {
  FaqEntry,
  MediaAsset,
  ProjectShowcase,
  Service,
  ServiceCategory,
  ServiceFeature,
  ServiceWithCategory,
  SiteSettings,
  Testimonial,
} from '@core/entities';
import type {
  FaqRepository,
  ListQuery,
  MediaRepository,
  ProjectRepository,
  ServiceCategoryRepository,
  ServiceListFilters,
  ServiceRepository,
  SettingsRepository,
  TestimonialRepository,
} from '@app-layer/ports';
import type { Database } from '../db/client';
import {
  faqs,
  mediaAssets,
  projects,
  serviceCategories,
  services,
  siteSettings,
  testimonials,
} from '../db/schema';
import { jsonArray, likeTerm, orderBy, page, pagination, toDate, toDateString, toNumber } from './helpers';

type Row<T> = T extends { $inferSelect: infer S } ? S : never;

/* ------------------------------------------------------------- mappers */

function mapCategory(row: Row<typeof serviceCategories>): ServiceCategory {
  return { ...row };
}

function mapService(row: Row<typeof services>): Service {
  return {
    ...row,
    galleryUrls: jsonArray<string>(row.galleryUrls),
    features: jsonArray<ServiceFeature>(row.features),
    deliverables: jsonArray<string>(row.deliverables),
  };
}

function mapProject(row: Row<typeof projects>): ProjectShowcase {
  return {
    ...row,
    completedOn: toDate(row.completedOn),
    galleryUrls: jsonArray<string>(row.galleryUrls),
    stats: jsonArray<{ label: string; value: string }>(row.stats),
  };
}

function mapMedia(row: Row<typeof mediaAssets>): MediaAsset {
  return row;
}

function mapSettings(row: Row<typeof siteSettings>): SiteSettings {
  return {
    ...row,
    addressLines: jsonArray<string>(row.addressLines),
    businessHours: jsonArray(row.businessHours) as SiteSettings['businessHours'],
    socials: jsonArray(row.socials) as SiteSettings['socials'],
    offices: jsonArray(row.offices) as SiteSettings['offices'],
    heroSlides: jsonArray(row.heroSlides) as SiteSettings['heroSlides'],
    stats: jsonArray(row.stats) as SiteSettings['stats'],
    seoKeywords: jsonArray<string>(row.seoKeywords),
    defaultVatRate: toNumber(row.defaultVatRate),
  };
}

/* ------------------------------------------------------- service groups */

export function createServiceCategoryRepository(db: Database): ServiceCategoryRepository {
  return {
    async listAll(includeInactive = false) {
      const rows = await db
        .select()
        .from(serviceCategories)
        .where(includeInactive ? undefined : eq(serviceCategories.isActive, true))
        .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
      return rows.map(mapCategory);
    },

    async findById(id) {
      const [row] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id)).limit(1);
      return row ? mapCategory(row) : null;
    },

    async findBySlug(slug) {
      const [row] = await db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.slug, slug))
        .limit(1);
      return row ? mapCategory(row) : null;
    },

    async create(data) {
      const [row] = await db.insert(serviceCategories).values(data).returning();
      return mapCategory(row!);
    },

    async update(id, data) {
      const [row] = await db
        .update(serviceCategories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(serviceCategories.id, id))
        .returning();
      if (!row) throw new NotFoundError('Service category', id);
      return mapCategory(row);
    },

    async delete(id) {
      await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
    },

    async reorder(order) {
      if (order.length === 0) return;
      // One statement rather than N round trips, which matters on Neon.
      const cases = sql.join(
        order.map((item) => sql`when ${serviceCategories.id} = ${item.id}::uuid then ${item.sortOrder}`),
        sql` `,
      );
      await db
        .update(serviceCategories)
        .set({ sortOrder: sql`case ${cases} else ${serviceCategories.sortOrder} end`, updatedAt: new Date() })
        .where(inArray(serviceCategories.id, order.map((item) => item.id)));
    },
  };
}

export function createServiceRepository(db: Database): ServiceRepository {
  const withCategory = (
    row: Row<typeof services>,
    category: Row<typeof serviceCategories> | null,
  ): ServiceWithCategory => ({
    ...mapService(row),
    category: category ? mapCategory(category) : null,
  });

  const baseSelect = () =>
    db
      .select({ service: services, category: serviceCategories })
      .from(services)
      .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id));

  return {
    async list(filters: ServiceListFilters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.includeInactive ? undefined : eq(services.isActive, true),
        filters.categoryId ? eq(services.categoryId, filters.categoryId) : undefined,
        filters.featuredOnly ? eq(services.isFeatured, true) : undefined,
        filters.search
          ? or(
              ilike(services.name, likeTerm(filters.search)),
              ilike(services.summary, likeTerm(filters.search)),
              ilike(services.tagline, likeTerm(filters.search)),
            )
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        baseSelect()
          .where(where)
          .orderBy(
            orderBy(filters, { name: services.name, createdAt: services.createdAt }, asc(services.sortOrder)),
          )
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(services).where(where),
      ]);

      return page(
        rows.map((row) => withCategory(row.service, row.category)),
        totals?.value ?? 0,
        filters,
      );
    },

    async listActive() {
      const rows = await baseSelect()
        .where(eq(services.isActive, true))
        .orderBy(asc(services.sortOrder), asc(services.name));
      return rows.map((row) => withCategory(row.service, row.category));
    },

    async findById(id) {
      const [row] = await baseSelect().where(eq(services.id, id)).limit(1);
      return row ? withCategory(row.service, row.category) : null;
    },

    async findBySlug(slug) {
      const [row] = await baseSelect().where(eq(services.slug, slug)).limit(1);
      return row ? withCategory(row.service, row.category) : null;
    },

    async slugExists(slug, exceptId) {
      const [row] = await db
        .select({ id: services.id })
        .from(services)
        .where(exceptId ? and(eq(services.slug, slug), ne(services.id, exceptId)) : eq(services.slug, slug))
        .limit(1);
      return Boolean(row);
    },

    async create(data) {
      const [row] = await db.insert(services).values(data).returning();
      return mapService(row!);
    },

    async update(id, data) {
      const [row] = await db
        .update(services)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(services.id, id))
        .returning();
      if (!row) throw new NotFoundError('Service', id);
      return mapService(row);
    },

    async delete(id) {
      await db.delete(services).where(eq(services.id, id));
    },

    async reorder(order) {
      if (order.length === 0) return;
      const cases = sql.join(
        order.map((item) => sql`when ${services.id} = ${item.id}::uuid then ${item.sortOrder}`),
        sql` `,
      );
      await db
        .update(services)
        .set({ sortOrder: sql`case ${cases} else ${services.sortOrder} end`, updatedAt: new Date() })
        .where(inArray(services.id, order.map((item) => item.id)));
    },
  };
}

/* ----------------------------------------------------------- social proof */

export function createTestimonialRepository(db: Database): TestimonialRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const where = filters.publishedOnly ? eq(testimonials.isPublished, true) : undefined;
      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(testimonials)
          .where(where)
          .orderBy(asc(testimonials.sortOrder), asc(testimonials.authorName))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(testimonials).where(where),
      ]);
      return page(rows, totals?.value ?? 0, filters);
    },

    async listPublished(limit = 12) {
      return db
        .select()
        .from(testimonials)
        .where(eq(testimonials.isPublished, true))
        .orderBy(asc(testimonials.sortOrder))
        .limit(limit);
    },

    async findById(id) {
      const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
      return row ?? null;
    },

    async create(data) {
      const [row] = await db.insert(testimonials).values(data).returning();
      return row!;
    },

    async update(id, data) {
      const [row] = await db
        .update(testimonials)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(testimonials.id, id))
        .returning();
      if (!row) throw new NotFoundError('Testimonial', id);
      return row;
    },

    async delete(id) {
      await db.delete(testimonials).where(eq(testimonials.id, id));
    },
  };
}

export function createProjectRepository(db: Database): ProjectRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.publishedOnly ? eq(projects.isPublished, true) : undefined,
        filters.serviceId ? eq(projects.serviceId, filters.serviceId) : undefined,
        filters.search
          ? or(ilike(projects.title, likeTerm(filters.search)), ilike(projects.client, likeTerm(filters.search)))
          : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(projects)
          .where(where)
          .orderBy(asc(projects.sortOrder), asc(projects.title))
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(projects).where(where),
      ]);
      return page(rows.map(mapProject), totals?.value ?? 0, filters);
    },

    async listPublished(limit = 24) {
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.isPublished, true))
        .orderBy(asc(projects.sortOrder))
        .limit(limit);
      return rows.map(mapProject);
    },

    async findById(id) {
      const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
      return row ? mapProject(row) : null;
    },

    async findBySlug(slug) {
      const [row] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
      return row ? mapProject(row) : null;
    },

    async slugExists(slug, exceptId) {
      const [row] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(exceptId ? and(eq(projects.slug, slug), ne(projects.id, exceptId)) : eq(projects.slug, slug))
        .limit(1);
      return Boolean(row);
    },

    async create(data) {
      const [row] = await db
        .insert(projects)
        .values({ ...data, completedOn: toDateString(data.completedOn) })
        .returning();
      return mapProject(row!);
    },

    async update(id, data) {
      const { completedOn, ...rest } = data;
      const [row] = await db
        .update(projects)
        .set({
          ...rest,
          ...(completedOn !== undefined ? { completedOn: toDateString(completedOn) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();
      if (!row) throw new NotFoundError('Project', id);
      return mapProject(row);
    },

    async delete(id) {
      await db.delete(projects).where(eq(projects.id, id));
    },
  };
}

export function createFaqRepository(db: Database): FaqRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const where = filters.publishedOnly ? eq(faqs.isPublished, true) : undefined;
      const [rows, [totals]] = await Promise.all([
        db.select().from(faqs).where(where).orderBy(asc(faqs.sortOrder)).limit(pageSize).offset(offset),
        db.select({ value: count() }).from(faqs).where(where),
      ]);
      return page(rows, totals?.value ?? 0, filters);
    },

    async listPublished() {
      return db.select().from(faqs).where(eq(faqs.isPublished, true)).orderBy(asc(faqs.sortOrder));
    },

    async findById(id) {
      const [row] = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
      return row ?? null;
    },

    async create(data) {
      const [row] = await db.insert(faqs).values(data).returning();
      return row!;
    },

    async update(id, data) {
      const [row] = await db
        .update(faqs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(faqs.id, id))
        .returning();
      if (!row) throw new NotFoundError('FAQ', id);
      return row;
    },

    async delete(id) {
      await db.delete(faqs).where(eq(faqs.id, id));
    },
  };
}

export function createMediaRepository(db: Database): MediaRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const conditions = [
        filters.folder ? eq(mediaAssets.folder, filters.folder) : undefined,
        filters.search ? ilike(mediaAssets.altText, likeTerm(filters.search)) : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(mediaAssets)
          .where(where)
          .orderBy(sql`${mediaAssets.createdAt} desc`)
          .limit(pageSize)
          .offset(offset),
        db.select({ value: count() }).from(mediaAssets).where(where),
      ]);
      return page(rows.map(mapMedia), totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      return row ? mapMedia(row) : null;
    },

    async create(data) {
      const [row] = await db.insert(mediaAssets).values(data).returning();
      return mapMedia(row!);
    },

    async update(id, data) {
      const [row] = await db
        .update(mediaAssets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mediaAssets.id, id))
        .returning();
      if (!row) throw new NotFoundError('Media asset', id);
      return mapMedia(row);
    },

    async delete(id) {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    },

    async listFolders() {
      const rows = await db
        .selectDistinct({ folder: mediaAssets.folder })
        .from(mediaAssets)
        .orderBy(asc(mediaAssets.folder));
      return rows.map((row) => row.folder);
    },
  };
}

/* ------------------------------------------------------------- settings */

export const SETTINGS_ID = 'singleton';

export function createSettingsRepository(db: Database): SettingsRepository {
  return {
    async get() {
      const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, SETTINGS_ID)).limit(1);
      if (!row) throw new NotFoundError('Site settings', 'run the seed script first');
      return mapSettings(row);
    },

    async update(data) {
      const {
        id: _ignored,
        createdAt: _created,
        updatedAt: _updated,
        defaultVatRate,
        ...patch
      } = data;
      const [row] = await db
        .update(siteSettings)
        .set({
          ...patch,
          ...(defaultVatRate !== undefined ? { defaultVatRate: String(defaultVatRate) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.id, SETTINGS_ID))
        .returning();
      if (!row) throw new NotFoundError('Site settings', SETTINGS_ID);
      return mapSettings(row);
    },
  };
}

export type { ListQuery };
