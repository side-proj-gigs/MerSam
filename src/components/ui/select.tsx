'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTROL, CONTROL_BAD, CONTROL_OK, FieldShell } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A select built as an ARIA listbox rather than a native `<select>`.
 *
 * The native control renders its option list through the operating system,
 * which means the page cannot style it. On a dark surface that produced pale
 * text on the browser's white popup, which is to say an unreadable menu, and
 * the list placed itself wherever the platform liked rather than under the
 * field. Neither is fixable from CSS.
 *
 * This keeps the same call signature so existing code does not change: the
 * `onChange` handler still receives an object with `target.value`. That object
 * is typed as exactly what it is rather than pretending to be a DOM event.
 */
export interface SelectProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  options?: SelectOption[];
  /** `<option>` elements, supported so existing call sites keep working. */
  children?: ReactNode;
  onValueChange?: (value: string) => void;
  onChange?: (event: { target: { value: string; name: string } }) => void;
  wrapperClassName?: string;
  className?: string;
  /** Shows a filter box. Enabled automatically once the list gets long. */
  searchable?: boolean;
  'aria-label'?: string;
}

/** Reads `<option>` children so both APIs behave identically. */
function optionsFromChildren(children: ReactNode): SelectOption[] {
  const collected: SelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== 'option') return;
    const props = child.props as { value?: string; children?: ReactNode; disabled?: boolean };

    const label = Children.toArray(props.children)
      .map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : ''))
      .join('')
      .trim();

    collected.push({
      value: props.value ?? '',
      label: label || props.value || '',
      disabled: props.disabled,
    });
  });

  return collected;
}

const SEARCH_THRESHOLD = 8;
const MAX_POPUP_HEIGHT = 288;
const GAP = 6;

interface Placement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  origin: 'top' | 'bottom';
}

export function Select({
  label,
  hint,
  error,
  required,
  disabled,
  id,
  name,
  value,
  placeholder = 'Choose an option',
  options,
  children,
  onValueChange,
  onChange,
  wrapperClassName,
  className,
  searchable,
  'aria-label': ariaLabel,
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;

  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ buffer: '', timer: 0 });

  /**
   * Open state is mirrored into a ref for the same reason the highlight is.
   * Key presses can arrive faster than React commits a new handler closure, so
   * a second arrow press would otherwise still see the list as closed and
   * reopen it, swallowing the movement.
   */
  const [open, setOpenState] = useState(false);
  const openRef = useRef(false);
  const setOpen = useCallback((next: boolean) => {
    openRef.current = next;
    setOpenState(next);
  }, []);

  /**
   * The highlighted row is held in a ref as well as in state. Several key
   * presses can arrive before React re-renders, and a handler reading the
   * state variable would then act on a stale index: pressing Down twice and
   * Enter would commit the wrong option. The ref is always current.
   */
  const [activeIndex, setActiveIndexState] = useState(-1);
  const activeRef = useRef(-1);
  const setActiveIndex = useCallback((index: number) => {
    activeRef.current = index;
    setActiveIndexState(index);
  }, []);
  const [query, setQuery] = useState('');
  const [placement, setPlacement] = useState<Placement | null>(null);

  const allOptions = useMemo(
    () => (options && options.length > 0 ? options : optionsFromChildren(children)),
    [options, children],
  );

  const withSearch = searchable ?? allOptions.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    if (!withSearch || !query.trim()) return allOptions;
    const needle = query.trim().toLowerCase();
    return allOptions.filter((option) => option.label.toLowerCase().includes(needle));
  }, [allOptions, query, withSearch]);

  const selected = allOptions.find((option) => option.value === value);

  const commit = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onValueChange?.(option.value);
      onChange?.({ target: { value: option.value, name: name ?? fieldId } });
      setOpen(false);
      setQuery('');
      trigger.current?.focus();
    },
    [onValueChange, onChange, name, fieldId],
  );

  /** Positions the popup against the trigger, flipping up when space is tight. */
  const measure = useCallback(() => {
    const node = trigger.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP * 2;
    const above = rect.top - GAP * 2;
    const flip = below < Math.min(MAX_POPUP_HEIGHT, 180) && above > below;
    const maxHeight = Math.min(MAX_POPUP_HEIGHT, Math.max(120, flip ? above : below));

    setPlacement({
      top: flip ? rect.top - GAP : rect.bottom + GAP,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight,
      origin: flip ? 'bottom' : 'top',
    });
  }, []);

  // Measured before paint so the popup never appears in the wrong spot first.
  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    // `true` so the popup also follows a scrolling dialog body, not just the page.
    const reposition = () => measure();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || popup.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, measure]);

  /**
   * Opens the list and places the highlight on the current selection in the
   * same update. Doing the positioning in an effect instead would let a quick
   * second arrow press be overwritten when the effect finally ran.
   */
  const openList = useCallback(() => {
    const index = visible.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : visible.findIndex((option) => !option.disabled));
    setOpen(true);
  }, [visible, value]);

  useEffect(() => {
    if (open && withSearch) requestAnimationFrame(() => searchInput.current?.focus());
  }, [open, withSearch]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    popup.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const step = (direction: 1 | -1) => {
    if (visible.length === 0) return;
    let next = activeRef.current;
    for (let attempt = 0; attempt < visible.length; attempt += 1) {
      next = (next + direction + visible.length) % visible.length;
      if (!visible[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  /** Jumps to the first match as the person types, the way a native select does. */
  const jumpTo = (character: string) => {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.buffer += character.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.buffer = '';
    }, 600);

    const found = visible.findIndex(
      (option) => !option.disabled && option.label.toLowerCase().startsWith(state.buffer),
    );
    if (found >= 0) setActiveIndex(found);
  };

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!openRef.current) {
          openList();
          return;
        }
        step(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      case 'Home':
      case 'End': {
        if (!openRef.current) return;
        event.preventDefault();
        setActiveIndex(event.key === 'Home' ? 0 : visible.length - 1);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        if (!openRef.current) {
          openList();
          return;
        }
        const option = visible[activeRef.current];
        if (option) commit(option);
        return;
      }
      case ' ': {
        // While filtering, a space is part of the query rather than a command.
        if (openRef.current && withSearch) return;
        event.preventDefault();
        if (!openRef.current) openList();
        else {
          const option = visible[activeRef.current];
          if (option) commit(option);
        }
        return;
      }
      case 'Escape': {
        if (!openRef.current) return;
        event.preventDefault();

        // Escape has to close the popup without also closing the dialog around
        // it. In the App Router React delegates its listeners to `document`,
        // which is where a dialog's own key handler also sits, so plain
        // stopPropagation cannot help: it does not stop other listeners on the
        // same target. Stopping immediate propagation does.
        event.stopPropagation();
        (event.nativeEvent as Event).stopImmediatePropagation();

        setOpen(false);
        setQuery('');
        trigger.current?.focus();
        return;
      }
      case 'Tab': {
        if (openRef.current) {
          setOpen(false);
          setQuery('');
        }
        return;
      }
      default: {
        if (!withSearch && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          if (!openRef.current) openList();
          jumpTo(event.key);
        }
      }
    }
  }

  const activeId = activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
      className={wrapperClassName}
    >
      <button
        ref={trigger}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? activeId : undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (openRef.current) {
            setOpen(false);
            setQuery('');
          } else {
            openList();
          }
        }}
        onKeyDown={onKeyDown}
        className={cn(
          CONTROL,
          error ? CONTROL_BAD : CONTROL_OK,
          'flex items-center justify-between gap-2 text-left',
          open && 'border-[var(--ring)]',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-[var(--text-muted)]')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open &&
        placement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popup}
            // Rendered to the body so a dialog's own scroll area cannot clip it.
            style={{
              position: 'fixed',
              top: placement.origin === 'top' ? placement.top : undefined,
              bottom:
                placement.origin === 'bottom'
                  ? window.innerHeight - placement.top
                  : undefined,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              transformOrigin: placement.origin === 'top' ? 'top center' : 'bottom center',
            }}
            className="z-[120] flex animate-[select-in_0.14s_var(--ease-out-expo)] flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow-float)]"
          >
            {withSearch && (
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                <Search className="size-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Filter"
                  aria-label="Filter options"
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </div>
            )}

            <ul
              id={listboxId}
              role="listbox"
              aria-label={label ?? ariaLabel ?? 'Options'}
              className="flex-1 overflow-y-auto p-1"
            >
              {visible.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                  Nothing matches that
                </li>
              )}

              {visible.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;

                return (
                  <li
                    key={`${option.value}-${index}`}
                    id={`${listboxId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    // Pointer down would blur the trigger before the click lands.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commit(option)}
                    onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      option.disabled && 'cursor-not-allowed opacity-45',
                      isActive && !option.disabled
                        ? 'bg-[var(--surface-sunken)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)]',
                      isSelected && 'font-semibold text-[var(--text-primary)]',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </FieldShell>
  );
}
