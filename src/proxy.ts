import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'mersam_session';
const LOGIN_PATH = '/admin/login';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'build-phase-placeholder-secret-value-0123456789',
);

/**
 * A cheap first gate (the Next 16 proxy convention, formerly middleware). It only checks that the cookie carries a signature we
 * issued, which is enough to bounce anonymous traffic away from the admin
 * before it reaches a render. The authoritative check still happens in the
 * admin layout, where the account can be looked up and its role confirmed.
 */
async function hasValidSignature(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { issuer: 'mersam', audience: 'mersam-admin' });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await hasValidSignature(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    if (!signedIn) return NextResponse.next();
    // Already signed in, so skip the form.
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (signedIn) return NextResponse.next();

  const target = new URL(LOGIN_PATH, request.url);
  // Remember where they were heading so the login can send them back.
  if (pathname !== '/admin') target.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
