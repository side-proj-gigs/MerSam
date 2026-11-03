import type { FaqEntry, ProjectShowcase, ServiceCategory, Testimonial } from '@core/entities';
import { Slug } from '@core/value-objects/identifiers';
import type { CollectionConfig } from './crud';
import {
  faqSchema,
  projectSchema,
  serviceCategorySchema,
  testimonialSchema,
} from '../validation/schemas';

/**
 * Declarations for the collections that need nothing beyond plain CRUD. The
 * richer resources (services, invoices, reports, leads) keep their own routes
 * because they carry real behaviour rather than just storage.
 */

export const testimonialConfig: CollectionConfig<Testimonial, typeof testimonialSchema> = {
  name: 'testimonial',
  label: 'Testimonial',
  schema: testimonialSchema,
  cachePrefix: 'testimonials:',
  repo: (repos) => repos.testimonials,
  toRecord: (input, { id }) => ({ id, ...input }),
  listFilters: (url) => ({ publishedOnly: url.searchParams.get('published') === 'true' }),
  describe: (entity) => entity.authorName,
};

export const projectConfig: CollectionConfig<ProjectShowcase, typeof projectSchema> = {
  name: 'project',
  label: 'Project',
  schema: projectSchema,
  cachePrefix: 'projects:',
  repo: (repos) => repos.projects,
  toRecord: (input, { id }) => ({
    id,
    ...input,
    // A blank slug is derived from the title rather than rejected.
    ...(input.title ? { slug: input.slug || Slug.create(input.title).value } : {}),
  }),
  listFilters: (url) => ({ publishedOnly: url.searchParams.get('published') === 'true' }),
  describe: (entity) => entity.title,
};

export const faqConfig: CollectionConfig<FaqEntry, typeof faqSchema> = {
  name: 'faq',
  label: 'FAQ',
  schema: faqSchema,
  cachePrefix: 'faqs:',
  repo: (repos) => repos.faqs,
  toRecord: (input, { id }) => ({ id, ...input }),
  listFilters: (url) => ({ publishedOnly: url.searchParams.get('published') === 'true' }),
  describe: (entity) => entity.question.slice(0, 60),
};

export const serviceCategoryConfig: CollectionConfig<ServiceCategory, typeof serviceCategorySchema> = {
  name: 'service_category',
  label: 'Service category',
  schema: serviceCategorySchema,
  cachePrefix: 'services:',
  repo: (repos) => ({
    ...repos.serviceCategories,
    list: async (filters) => {
      const items = await repos.serviceCategories.listAll(true);
      const search = String(filters.search ?? '').toLowerCase();
      const matched = search
        ? items.filter((item) => item.name.toLowerCase().includes(search))
        : items;
      return {
        items: matched,
        total: matched.length,
        page: 1,
        pageSize: matched.length || 1,
        pageCount: 1,
      };
    },
  }),
  toRecord: (input, { id }) => ({
    id,
    ...input,
    ...(input.name ? { slug: input.slug || Slug.create(input.name).value } : {}),
  }),
  describe: (entity) => entity.name,
};
