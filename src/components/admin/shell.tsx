'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Briefcase,
  ChevronDown,
  FileSignature,
  FileText,
  Globe,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Receipt,
  Settings,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Role, SessionPrincipal } from '@core/entities';
import { roleAtLeast } from '@core/entities';
import { api } from '@/lib/api-client';
import { cn, initials } from '@/lib/utils';
import { useScrollLock } from '@/hooks';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/site/theme-toggle';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  minRole: Role;
  exact?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, minRole: 'viewer', exact: true },
      { href: '/admin/enquiries', label: 'Enquiries', Icon: Inbox, minRole: 'viewer' },
      { href: '/admin/clients', label: 'Clients', Icon: Users, minRole: 'viewer' },
      { href: '/admin/jobs', label: 'Jobs', Icon: Briefcase, minRole: 'viewer' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { href: '/admin/proposals', label: 'Proposals', Icon: FileSignature, minRole: 'viewer' },
      { href: '/admin/invoices', label: 'Invoices', Icon: Receipt, minRole: 'viewer' },
      { href: '/admin/reports', label: 'Work reports', Icon: FileText, minRole: 'viewer' },
    ],
  },
  {
    heading: 'Website',
    items: [
      { href: '/admin/services', label: 'Services', Icon: Wrench, minRole: 'admin' },
      { href: '/admin/content', label: 'Content', Icon: MessageSquareQuote, minRole: 'admin' },
      { href: '/admin/media', label: 'Media', Icon: Images, minRole: 'staff' },
      { href: '/admin/settings', label: 'Settings', Icon: Settings, minRole: 'admin' },
    ],
  },
  {
    heading: 'Access',
    items: [{ href: '/admin/team', label: 'Team', Icon: Users, minRole: 'admin' }],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function AdminShell({
  principal,
  children,
}: {
  principal: SessionPrincipal;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useScrollLock(drawerOpen);
  useEffect(() => setDrawerOpen(false), [pathname]);

  async function signOut() {
    try {
      await api.post('/api/auth/logout', {}, { idempotent: false });
      toast.success('Signed out');
      router.replace('/admin/login');
      router.refresh();
    } catch {
      toast.error('Could not sign out, please try again');
    }
  }

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => roleAtLeast(principal.role, item.minRole)),
  })).filter((group) => group.items.length > 0);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Admin">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image src="/brand/mersam-icon.png" alt="" width={40} height={34} className="h-8 w-auto" />
        <span className="font-display text-lg font-semibold text-gradient-gold">MerSam</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5">
            <p className="mb-1.5 px-3 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-500">
              {group.heading}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-gold-500/12 text-gold-300'
                      : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span
                      className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold-400"
                      aria-hidden
                    />
                  )}
                  <item.Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-ink-800 p-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <Globe className="size-4" aria-hidden />
          View the website
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-[var(--surface-sunken)]">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-ink-800 bg-ink-950 lg:block">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-100 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/65 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
            tabIndex={-1}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-ink-950">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-5 grid size-9 place-items-center rounded-lg text-ink-300 hover:bg-ink-800"
              aria-label="Close navigation"
            >
              <X className="size-5" aria-hidden />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 text-xs font-bold text-ink-950">
                  {initials(principal.name)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[0.8125rem] font-semibold leading-tight text-[var(--text-primary)]">
                    {principal.name}
                  </span>
                  <span className="block text-[0.6875rem] capitalize leading-tight text-[var(--text-muted)]">
                    {principal.role}
                  </span>
                </span>
                <ChevronDown className="size-3.5 text-[var(--text-muted)]" aria-hidden />
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-float)]"
                  >
                    <div className="border-b border-[var(--border-subtle)] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {principal.name}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{principal.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={signOut}
                      className="mt-1 w-full justify-start"
                      leadingIcon={<LogOut className="size-4" aria-hidden />}
                    >
                      Sign out
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
