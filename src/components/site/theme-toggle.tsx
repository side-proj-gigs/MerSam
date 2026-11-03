'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mersam-theme';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * Writes `data-theme` on the root element, which is what the CSS reads. The
 * `system` option removes the attribute so the media query takes over again.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {
      // Storage blocked, system preference stands.
    }
    setMounted(true);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY);
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem(STORAGE_KEY, next);
        document.documentElement.dataset.theme = next;
      }
    } catch {
      // Apply in memory even when we cannot persist the choice.
      if (next !== 'system') document.documentElement.dataset.theme = next;
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-0.5',
        className,
      )}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          aria-label={`${label} theme`}
          aria-pressed={mounted ? theme === value : undefined}
          className={cn(
            'grid size-7 place-items-center rounded-full transition-colors',
            mounted && theme === value
              ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-lift)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
