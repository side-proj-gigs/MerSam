import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Role, SessionPrincipal } from '@core/entities';
import { requireRole, resolvePrincipal } from '@app-layer/use-cases/auth';
import { getContainer } from '@infra/container';
import { env } from '@infra/config/env';

export const SESSION_COOKIE = 'mersam_session';

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  };
}

/** Returns the signed-in user, or null for an anonymous visitor. */
export async function currentPrincipal(): Promise<SessionPrincipal | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const { tokens, repos } = getContainer();
  return resolvePrincipal({ tokens, users: repos.users }, token);
}

/** Throws Unauthorized or Forbidden, which the route wrapper maps to 401/403. */
export async function requirePrincipal(role: Role = 'staff'): Promise<SessionPrincipal> {
  return requireRole(await currentPrincipal(), role);
}

/**
 * A stable-enough client identifier for rate limiting. Proxy headers are not
 * trustworthy on their own, so the value is only ever used as a bucket key.
 */
export async function clientFingerprint(): Promise<string> {
  const headerBag = await headers();
  const forwarded = headerBag.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    headerBag.get('x-real-ip') ||
    headerBag.get('cf-connecting-ip') ||
    'unknown';
  return ip.slice(0, 64);
}
