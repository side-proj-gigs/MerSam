import { ConflictError, NotFoundError, ValidationError } from '@core/errors';
import type { SessionPrincipal, StaffCard, User, UUID } from '@core/entities';
import { EmailAddress, PhoneNumber } from '@core/value-objects/contact';
import { Slug } from '@core/value-objects/identifiers';
import type { AuditLogRepository, SettingsRepository, UserRepository } from '../ports';
import { requireRole } from './auth';

export interface StaffCardDeps {
  users: UserRepository;
  settings: SettingsRepository;
  audit: AuditLogRepository;
}

export interface CardProfileInput {
  jobTitle?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  bio?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  specialities?: string[];
  avatarUrl?: string | null;
  cardPublished?: boolean;
  cardSlug?: string | null;
}

/** Derives a readable, unique slug from the person's name. */
async function allocateSlug(
  deps: StaffCardDeps,
  desired: string,
  exceptId: UUID,
): Promise<string> {
  const base = Slug.create(desired).value;
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    if (!(await deps.users.cardSlugExists(candidate, exceptId))) return candidate;
  }
  throw new ConflictError('Could not derive a unique card address for that name');
}

export async function updateCardProfile(
  deps: StaffCardDeps,
  actor: SessionPrincipal,
  userId: UUID,
  input: CardProfileInput,
): Promise<User> {
  // Anyone may edit their own card; editing somebody else's needs admin.
  if (actor.userId !== userId) requireRole(actor, 'admin');

  const existing = await deps.users.findById(userId);
  if (!existing) throw new NotFoundError('User', userId);

  // Publishing without a job title produces a card with a hole in it.
  const jobTitle = input.jobTitle !== undefined ? input.jobTitle : existing.jobTitle;
  if (input.cardPublished && !jobTitle?.trim()) {
    throw new ValidationError('A card needs a job title before it can be published');
  }

  const slug =
    input.cardSlug !== undefined && input.cardSlug
      ? await allocateSlug(deps, input.cardSlug, userId)
      : (existing.cardSlug ?? (await allocateSlug(deps, existing.name, userId)));

  const phone = input.phone ? PhoneNumber.create(input.phone).e164 : (input.phone ?? existing.phone);
  const whatsapp = input.whatsapp
    ? PhoneNumber.create(input.whatsapp).e164
    : (input.whatsapp ?? existing.whatsapp);

  if (input.linkedinUrl) {
    try {
      const parsed = new URL(input.linkedinUrl);
      if (parsed.protocol !== 'https:') throw new Error('insecure');
    } catch {
      throw new ValidationError('Enter the full https address of the LinkedIn profile');
    }
  }

  const updated = await deps.users.update(userId, {
    ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl } : {}),
    ...(input.specialities !== undefined ? { specialities: input.specialities } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.cardPublished !== undefined ? { cardPublished: input.cardPublished } : {}),
    phone,
    whatsapp,
    cardSlug: slug,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'staff_card',
    entityId: userId,
    summary:
      input.cardPublished === undefined
        ? `${actor.name} updated the digital card for ${existing.name}`
        : `${actor.name} ${input.cardPublished ? 'published' : 'unpublished'} the digital card for ${existing.name}`,
  });

  return updated;
}

/** The public projection. Only published cards resolve. */
export async function getPublishedCard(
  deps: StaffCardDeps,
  slug: string,
): Promise<{ card: StaffCard; user: User }> {
  const user = await deps.users.findByCardSlug(slug);
  if (!user || !user.cardPublished || !user.isActive) {
    throw new NotFoundError('Digital card', slug);
  }

  return {
    user,
    card: {
      slug: user.cardSlug!,
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      email: user.email,
      phone: user.phone,
      whatsapp: user.whatsapp,
      bio: user.bio,
      location: user.location,
      linkedinUrl: user.linkedinUrl,
      specialities: user.specialities,
      avatarUrl: user.avatarUrl,
    },
  };
}

/**
 * vCard 3.0, which is the version every phone and desktop client still reads
 * without complaint. Long lines are not folded because none of these fields
 * realistically reaches the 75 octet limit.
 */
export function buildVCard(
  card: StaffCard,
  company: { name: string; url: string; address: string },
): string {
  const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const [firstName = '', ...rest] = card.name.split(/\s+/);
  const lastName = rest.join(' ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escape(lastName)};${escape(firstName)};;;`,
    `FN:${escape(card.name)}`,
    `ORG:${escape(company.name)}`,
    card.jobTitle && `TITLE:${escape(card.jobTitle)}`,
    `EMAIL;TYPE=INTERNET,WORK:${card.email}`,
    card.phone && `TEL;TYPE=CELL,WORK:${card.phone}`,
    card.whatsapp && card.whatsapp !== card.phone && `TEL;TYPE=VOICE,WORK:${card.whatsapp}`,
    card.location && `ADR;TYPE=WORK:;;${escape(card.location)};;;;`,
    !card.location && company.address && `ADR;TYPE=WORK:;;${escape(company.address)};;;;`,
    `URL:${company.url}/card/${card.slug}`,
    card.linkedinUrl && `URL;TYPE=LinkedIn:${card.linkedinUrl}`,
    card.bio && `NOTE:${escape(card.bio)}`,
    `REV:${new Date().toISOString()}`,
    'END:VCARD',
  ].filter(Boolean);

  // CRLF is what the specification requires, and some clients enforce it.
  return `${lines.join('\r\n')}\r\n`;
}
