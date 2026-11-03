import type { Timestamped, UUID } from './common';

/** Roles are ordered: a higher rank implies every permission of the ranks below. */
export const ROLES = ['viewer', 'staff', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2, owner: 3 };

export function roleAtLeast(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}

export interface User extends Timestamped {
  id: UUID;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;

  /* Digital business card */
  jobTitle: string | null;
  cardSlug: string | null;
  cardPublished: boolean;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  location: string | null;
  linkedinUrl: string | null;
  specialities: string[];
  cardViews: number;
}

/** What the public card page is allowed to see. No email beyond the work one. */
export interface StaffCard {
  slug: string;
  name: string;
  jobTitle: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  location: string | null;
  linkedinUrl: string | null;
  specialities: string[];
  avatarUrl: string | null;
}

export interface UserWithSecret extends User {
  passwordHash: string;
}

export interface SessionPrincipal {
  userId: UUID;
  email: string;
  name: string;
  role: Role;
}

export function toPrincipal(user: User): SessionPrincipal {
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}
