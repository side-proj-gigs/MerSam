import { ForbiddenError, UnauthorizedError, ValidationError } from '@core/errors';
import { roleAtLeast, toPrincipal, type Role, type SessionPrincipal, type User } from '@core/entities';
import { EmailAddress } from '@core/value-objects/contact';
import type {
  AuditLogRepository,
  PasswordHasher,
  RateLimiter,
  SessionToken,
  TokenService,
  UserRepository,
} from '../ports';

export interface AuthDeps {
  users: UserRepository;
  audit: AuditLogRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  rateLimiter: RateLimiter;
  sessionTtlHours: number;
}

export interface LoginInput {
  email: string;
  password: string;
  /** Client address, used only to scope the brute-force counter. */
  fingerprint: string;
}

export interface LoginResult {
  user: User;
  session: SessionToken;
}

const LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export async function login(deps: AuthDeps, input: LoginInput): Promise<LoginResult> {
  const email = EmailAddress.create(input.email);

  // Two counters: one per account so a single target cannot be ground down,
  // one per client so a spray across many accounts is also capped.
  for (const key of [`login:user:${email.value}`, `login:ip:${input.fingerprint}`]) {
    const verdict = await deps.rateLimiter.consume(key, LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS);
    if (!verdict.allowed) {
      throw new UnauthorizedError('Too many sign in attempts, please try again shortly');
    }
  }

  const record = await deps.users.findByEmail(email.value);

  // A missing account still pays the hashing cost, so response timing does not
  // reveal which addresses exist.
  const passwordMatches = record
    ? await deps.hasher.verify(input.password, record.passwordHash)
    : await deps.hasher
        .verify(input.password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva')
        .then(() => false);

  if (!record || !passwordMatches) {
    throw new UnauthorizedError('That email and password combination was not recognised');
  }
  if (!record.isActive) {
    throw new ForbiddenError('This account has been suspended');
  }

  const now = new Date();
  await deps.users.update(record.id, { lastLoginAt: now });
  await deps.audit.record({
    actorId: record.id,
    action: 'login',
    entity: 'user',
    entityId: record.id,
    summary: `${record.name} signed in`,
  });

  const session = await deps.tokens.issue(
    { sub: record.id, email: record.email, name: record.name, role: record.role },
    deps.sessionTtlHours * 3600,
  );

  const { passwordHash: _secret, ...user } = record;
  return { user: { ...user, lastLoginAt: now }, session };
}

export async function resolvePrincipal(
  deps: Pick<AuthDeps, 'tokens' | 'users'>,
  token: string | undefined,
): Promise<SessionPrincipal | null> {
  if (!token) return null;
  const payload = await deps.tokens.verify<{ sub: string; role: Role }>(token);
  if (!payload?.sub) return null;

  // The token carries the role, but the account is checked on every request so
  // a suspension or a demotion takes effect immediately.
  const user = await deps.users.findById(payload.sub);
  if (!user || !user.isActive) return null;
  return toPrincipal(user);
}

export function requireRole(principal: SessionPrincipal | null, required: Role): SessionPrincipal {
  if (!principal) throw new UnauthorizedError();
  if (!roleAtLeast(principal.role, required)) {
    throw new ForbiddenError(`This action needs the ${required} role or higher`);
  }
  return principal;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

const MIN_PASSWORD_LENGTH = 10;

export function assertPasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password));
  if (classes.length < 3) {
    throw new ValidationError(
      'Passwords need at least three of: lowercase, uppercase, a digit and a symbol',
    );
  }
}

export async function createUser(
  deps: AuthDeps,
  actor: SessionPrincipal,
  input: CreateUserInput,
): Promise<User> {
  requireRole(actor, 'admin');
  if (input.role === 'owner' && actor.role !== 'owner') {
    throw new ForbiddenError('Only an owner can create another owner');
  }

  const email = EmailAddress.create(input.email);
  assertPasswordStrength(input.password);

  if (await deps.users.findByEmail(email.value)) {
    throw new ValidationError('An account already exists for that email address');
  }

  const user = await deps.users.create({
    id: crypto.randomUUID(),
    email: email.value,
    name: input.name.trim(),
    passwordHash: await deps.hasher.hash(input.password),
    role: input.role,
    avatarUrl: null,
    isActive: true,
    lastLoginAt: null,
    jobTitle: null,
    cardSlug: null,
    cardPublished: false,
    phone: null,
    whatsapp: null,
    bio: null,
    location: null,
    linkedinUrl: null,
    specialities: [],
    cardViews: 0,
  });

  await deps.audit.record({
    actorId: actor.userId,
    action: 'create',
    entity: 'user',
    entityId: user.id,
    summary: `${actor.name} created the ${input.role} account ${user.email}`,
  });

  return user;
}

export async function changePassword(
  deps: AuthDeps,
  actor: SessionPrincipal,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const record = await deps.users.findByEmail(actor.email);
  if (!record) throw new UnauthorizedError();

  if (!(await deps.hasher.verify(input.currentPassword, record.passwordHash))) {
    throw new UnauthorizedError('Your current password was not correct');
  }
  assertPasswordStrength(input.newPassword);

  await deps.users.update(record.id, { passwordHash: await deps.hasher.hash(input.newPassword) });
  await deps.audit.record({
    actorId: actor.userId,
    action: 'update',
    entity: 'user',
    entityId: record.id,
    summary: `${actor.name} changed their password`,
  });
}
