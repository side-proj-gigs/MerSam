import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { count } from 'drizzle-orm';
import { NotFoundError } from '@core/errors';
import type { User, UserWithSecret } from '@core/entities';
import type { AuditLogRepository, UserRepository } from '@app-layer/ports';
import type { Database } from '../db/client';
import { auditLogs, users } from '../db/schema';
import { likeTerm, page, pagination } from './helpers';

type UserRow = typeof users.$inferSelect;

function toPublicUser(row: UserRow): User {
  const { passwordHash: _hash, tokenVersion: _version, ...rest } = row;
  return { ...rest, specialities: Array.isArray(rest.specialities) ? rest.specialities : [] };
}

function toUserWithSecret(row: UserRow): UserWithSecret {
  const { tokenVersion: _version, ...rest } = row;
  return rest;
}

export function createUserRepository(db: Database): UserRepository {
  return {
    async list(filters) {
      const { pageSize, offset } = pagination(filters);
      const where = filters.search
        ? or(ilike(users.name, likeTerm(filters.search)), ilike(users.email, likeTerm(filters.search)))
        : undefined;

      const [rows, [totals]] = await Promise.all([
        db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
        db.select({ value: count() }).from(users).where(where),
      ]);
      return page(rows.map(toPublicUser), totals?.value ?? 0, filters);
    },

    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ? toPublicUser(row) : null;
    },

    async findByEmail(email) {
      const [row] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
        .limit(1);
      return row ? toUserWithSecret(row) : null;
    },

    async create(data) {
      const [row] = await db.insert(users).values(data).returning();
      return toPublicUser(row!);
    },

    async update(id, data) {
      const [row] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      if (!row) throw new NotFoundError('User', id);
      return toPublicUser(row);
    },

    async delete(id) {
      await db.delete(users).where(eq(users.id, id));
    },

    async findByCardSlug(slug) {
      const [row] = await db.select().from(users).where(eq(users.cardSlug, slug)).limit(1);
      return row ? toPublicUser(row) : null;
    },

    async cardSlugExists(slug, exceptId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(exceptId ? and(eq(users.cardSlug, slug), ne(users.id, exceptId)) : eq(users.cardSlug, slug))
        .limit(1);
      return Boolean(row);
    },

    async recordCardView(id) {
      // A counter must never be the reason a public page fails to render.
      try {
        await db
          .update(users)
          .set({ cardViews: sql`${users.cardViews} + 1` })
          .where(eq(users.id, id));
      } catch (error) {
        console.error('Failed to record a card view', error);
      }
    },

    async count() {
      const [row] = await db.select({ value: count() }).from(users);
      return row?.value ?? 0;
    },
  };
}

export function createAuditLogRepository(db: Database): AuditLogRepository {
  return {
    async record(entry) {
      // Audit writes must never take down the action they are describing.
      try {
        await db.insert(auditLogs).values({
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          summary: entry.summary,
          metadata: entry.metadata ?? null,
        });
      } catch (error) {
        console.error('Failed to write audit entry', error);
      }
    },

    async recent(limit) {
      const rows = await db
        .select({
          id: auditLogs.id,
          actorName: users.name,
          action: auditLogs.action,
          entity: auditLogs.entity,
          summary: auditLogs.summary,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
      return rows;
    },
  };
}
