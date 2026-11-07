'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/primitives';

/**
 * The replacement for `window.confirm`.
 *
 * The browser's own dialog is the one piece of the admin that never matched
 * the brand: it arrives in the system font, it says "OK" where the action has
 * a name, it cannot explain what is about to happen, and on a phone it is a
 * grey slab from another decade. It also blocks the whole page, which means
 * the thing being deleted is hidden at the moment somebody is deciding.
 *
 * This keeps the one useful property of `confirm`, that a call site reads as
 * a single line, and adds the things it could never do.
 */

export type ConfirmTone = 'danger' | 'warning' | 'neutral';

export interface ConfirmOptions {
  title: string;
  /** What will actually happen. Worth a sentence: this is the whole point. */
  description?: ReactNode;
  /** Names the action, so the button never has to say "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Shown in a tinted panel for the detail somebody should not miss. */
  detail?: ReactNode;
}

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

const TONES: Record<
  ConfirmTone,
  { icon: typeof AlertTriangle; ring: string; glow: string; button: 'danger' | 'gold' | 'primary' }
> = {
  danger: {
    icon: Trash2,
    ring: 'border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]',
    glow: 'from-[color-mix(in_srgb,var(--color-danger)_55%,transparent)]',
    button: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]',
    glow: 'from-[color-mix(in_srgb,var(--color-warning)_55%,transparent)]',
    button: 'gold',
  },
  neutral: {
    icon: Info,
    ring: 'border-gold-500/30 bg-gold-500/10 text-[var(--brand)]',
    glow: 'from-gold-500/50',
    button: 'primary',
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<Resolver | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second ask while one is open answers the first with "no" rather than
    // leaving its promise hanging forever.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }, []);

  // Memoised so every component under the provider is not re-rendered each
  // time a dialog opens or closes.
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && <ConfirmDialog options={options} onSettle={settle} />}
    </ConfirmContext.Provider>
  );
}

/**
 * Asks the person to confirm, and resolves to what they chose.
 *
 * ```tsx
 * if (await confirm({ title: 'Delete this photograph?' })) remove.mutate(id);
 * ```
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used inside a ConfirmProvider');
  }
  return confirm;
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (confirmed: boolean) => void;
}) {
  const tone = TONES[options.tone ?? 'danger'];
  const Icon = options.tone === 'danger' || !options.tone ? ShieldAlert : tone.icon;

  return (
    <Dialog
      open
      size="sm"
      // Closing by Escape, by the backdrop or by the cross all mean the same
      // thing as cancelling, which is what someone reaching for Escape wants.
      onClose={() => onSettle(false)}
      title={options.title}
      footer={
        <>
          {/* The keyboard lands on Cancel, never on the destructive action:
              somebody who hits Enter out of habit should lose nothing. */}
          <Button variant="ghost" onClick={() => onSettle(false)} data-autofocus>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={tone.button} onClick={() => onSettle(true)}>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span
          className={`relative grid size-11 shrink-0 place-items-center rounded-2xl border ${tone.ring}`}
          aria-hidden
        >
          {/* A soft bloom behind the mark, so the dialog reads as part of the
              product rather than a browser control dropped on top of it. */}
          <span
            className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br ${tone.glow} to-transparent opacity-40 blur-md`}
          />
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          {options.description && (
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {options.description}
            </p>
          )}

          {options.detail && (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2.5 text-sm text-[var(--text-primary)]">
              {options.detail}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
