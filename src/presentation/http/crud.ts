import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { NotFoundError } from '@core/errors';
import type { Page, Role, SessionPrincipal, UUID } from '@core/entities';
import type { ListQuery } from '@app-layer/ports';
import { invalidateContentCache } from '@infra/services';
import { repositories } from '@infra/deps';
import { withIdempotency } from './idempotency';
import { revalidatePublicSite } from './revalidate';
import { ok, noContent, route } from './respond';
import { requirePrincipal } from './session';
import { parseListQuery, parsePatch, uuidSchema } from '../validation/schemas';

/**
 * The content collections (testimonials, projects, FAQs, categories) all behave
 * identically: list with paging, create, patch, delete, with an audit entry and
 * a cache flush on every write. Rather than repeat that five times, each
 * collection declares its repository and its schema and gets the handlers back.
 *
 * Two caches are flushed on a write, and both are needed: the read through
 * cache in front of the queries, and the prerendered public pages.
 */
export interface CollectionConfig<TEntity, TSchema extends z.ZodTypeAny> {
  /** Used for audit entries, cache keys and idempotency scoping. */
  name: string;
  /** Human label for error messages, for example "Testimonial". */
  label: string;
  schema: TSchema;
  role?: Role;
  cachePrefix?: string;
  repo: (repos: ReturnType<typeof repositories>) => {
    list: (filters: ListQuery & Record<string, unknown>) => Promise<Page<TEntity>>;
    findById: (id: UUID) => Promise<TEntity | null>;
    create: (data: never) => Promise<TEntity>;
    update: (id: UUID, data: never) => Promise<TEntity>;
    delete: (id: UUID) => Promise<void>;
  };
  /** Turns validated input into the shape the repository stores. */
  toRecord: (input: z.infer<TSchema>, context: { id: UUID; actor: SessionPrincipal }) => unknown;
  /** Extra filters read from the query string on a list request. */
  listFilters?: (url: URL) => Record<string, unknown>;
  describe?: (entity: TEntity) => string;
}

export function collectionRoutes<TEntity, TSchema extends z.ZodTypeAny>(
  config: CollectionConfig<TEntity, TSchema>,
) {
  const role: Role = config.role ?? 'admin';
  const cachePrefix = config.cachePrefix ?? `${config.name}:`;

  const GET = route(async (request: Request) => {
    await requirePrincipal('viewer');
    const url = new URL(request.url);
    const repos = repositories();
    const page = await config.repo(repos).list({
      ...parseListQuery(url),
      ...(config.listFilters?.(url) ?? {}),
    });
    return ok(page);
  });

  const POST = route(async (request: Request) => {
    const actor = await requirePrincipal(role);
    const body = await request.json();
    const input = config.schema.parse(body) as z.infer<TSchema>;

    return withIdempotency(request, `${config.name}.create`, async () => {
      const repos = repositories();
      const id = crypto.randomUUID();
      const entity = await config.repo(repos).create(
        config.toRecord(input, { id, actor }) as never,
      );

      await invalidateContentCache(cachePrefix);
      revalidatePublicSite();
      await repos.audit.record({
        actorId: actor.userId,
        action: 'create',
        entity: config.name,
        entityId: id,
        summary: `${actor.name} created a ${config.label.toLowerCase()}${
          config.describe ? `: ${config.describe(entity)}` : ''
        }`,
      });

      return { status: 201, body: entity };
    });
  });

  return { GET, POST };
}

export function itemRoutes<TEntity, TSchema extends z.ZodTypeAny>(
  config: CollectionConfig<TEntity, TSchema>,
) {
  const role: Role = config.role ?? 'admin';
  const cachePrefix = config.cachePrefix ?? `${config.name}:`;

  type Context = { params: Promise<{ id: string }> };

  const GET = route(async (_request: Request, context: Context) => {
    await requirePrincipal('viewer');
    const id = uuidSchema.parse((await context.params).id);

    const entity = await config.repo(repositories()).findById(id);
    if (!entity) throw new NotFoundError(config.label, id);
    return ok(entity);
  });

  const PATCH = route(async (request: Request, context: Context) => {
    const actor = await requirePrincipal(role);
    const id = uuidSchema.parse((await context.params).id);
    const body = await request.json();
    // Partial so a form can send only what changed.
    const input = parsePatch(config.schema as unknown as z.ZodObject<z.ZodRawShape>, body);

    const repos = repositories();
    const existing = await config.repo(repos).findById(id);
    if (!existing) throw new NotFoundError(config.label, id);

    const entity = await config.repo(repos).update(
      id,
      config.toRecord(input as z.infer<TSchema>, { id, actor }) as never,
    );

    await invalidateContentCache(cachePrefix);
    revalidatePublicSite();
    await repos.audit.record({
      actorId: actor.userId,
      action: 'update',
      entity: config.name,
      entityId: id,
      summary: `${actor.name} updated a ${config.label.toLowerCase()}${
        config.describe ? `: ${config.describe(entity)}` : ''
      }`,
    });

    return ok(entity);
  });

  const DELETE = route(async (_request: Request, context: Context) => {
    const actor = await requirePrincipal(role);
    const id = uuidSchema.parse((await context.params).id);

    const repos = repositories();
    const existing = await config.repo(repos).findById(id);
    if (!existing) throw new NotFoundError(config.label, id);

    await config.repo(repos).delete(id);
    await invalidateContentCache(cachePrefix);
    revalidatePublicSite();
    await repos.audit.record({
      actorId: actor.userId,
      action: 'delete',
      entity: config.name,
      entityId: id,
      summary: `${actor.name} deleted a ${config.label.toLowerCase()}${
        config.describe ? `: ${config.describe(existing)}` : ''
      }`,
    });

    return noContent();
  });

  return { GET, PATCH, DELETE };
}

export type { NextResponse };
