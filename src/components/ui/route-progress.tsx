'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * A page-to-page loading indicator.
 *
 * App Router gives no global "navigation started" event, so the start is taken
 * from the click that causes it: any left click on an internal link, plus a
 * back or forward press. The end is the pathname actually changing. If a
 * navigation turns out to be instant the bar is never shown at all, because a
 * flash of progress on a 40ms transition reads as a glitch rather than feedback.
 */
const SHOW_AFTER_MS = 140;
const CREEP_INTERVAL_MS = 220;

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const timers = useRef<{ show?: ReturnType<typeof setTimeout>; creep?: ReturnType<typeof setInterval>; hide?: ReturnType<typeof setTimeout> }>({});

  function clearTimers() {
    clearTimeout(timers.current.show);
    clearInterval(timers.current.creep);
    clearTimeout(timers.current.hide);
  }

  useEffect(() => {
    function begin() {
      clearTimers();
      timers.current.show = setTimeout(() => {
        setVisible(true);
        setProgress(12);
        // Creep towards, but never reach, the end. The real arrival finishes it.
        timers.current.creep = setInterval(() => {
          setProgress((current) => (current >= 88 ? current : current + (90 - current) * 0.18));
        }, CREEP_INTERVAL_MS);
      }, SHOW_AFTER_MS);
    }

    function onClick(event: MouseEvent) {
      // Only a plain left click navigates; everything else opens a new context.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      // Same page, so nothing will load.
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) {
        return;
      }

      begin();
    }

    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('popstate', begin);

    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('popstate', begin);
      clearTimers();
    };
  }, []);

  // The route changed, so whatever was loading has arrived.
  useEffect(() => {
    clearTimers();
    setProgress((current) => (current > 0 ? 100 : 0));
    timers.current.hide = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 420);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-200" role="status" aria-live="polite">
      <div
        className="h-[3px] origin-left bg-gradient-to-r from-aqua-500 via-gold-400 to-gold-600"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: 'transform 0.35s var(--ease-out-expo), opacity 0.3s ease',
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: '0 0 12px rgba(201, 162, 39, 0.65)',
        }}
      />
      <span className="sr-only">Loading the next page</span>
    </div>
  );
}
