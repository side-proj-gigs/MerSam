'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { WaterDroplet } from './water-loader';

const SEEN_KEY = 'mersam-splash-seen';

/** Longest the splash may stay on screen, whatever else is going on. */
const CEILING_MS = 2200;
const MINIMUM_MS = 1000;
const FADE_MS = 600;

function readSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Storage is blocked, which happens in a private window. Treat it as seen
    // so nobody is shown the splash on every single navigation.
    return true;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do; at worst the splash shows again next time.
  }
}

/**
 * The first-visit splash. It is an overlay on top of already-rendered content,
 * never a gate in front of it, so the page is complete for a crawler and for
 * anyone with JavaScript disabled. It shows once per browser session, because
 * a splash on every navigation stops being a welcome and becomes a toll.
 *
 * The "seen" flag is written when the splash *finishes*, never when it starts.
 * Writing it on the way in looks equivalent and is not: React runs effects
 * twice in development, so the second run would read the flag the first run
 * had just written, take the early return, and schedule nothing. The splash
 * would then sit there permanently with no timer left to dismiss it.
 */
export function Preloader() {
  const [state, setState] = useState<'hidden' | 'showing' | 'leaving'>('hidden');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || readSeen()) return;

    setState('showing');

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      markSeen();
      setState('leaving');
      // Not guarded by `cancelled`, because this one must always land or the
      // overlay stays in the tree.
      timers.push(setTimeout(() => setState('hidden'), FADE_MS));
    };

    const onLoad = () => {
      // Hold the floor so the animation does not flash past on a fast
      // connection, then leave.
      timers.push(setTimeout(finish, Math.max(0, MINIMUM_MS - (performance.now() - started))));
    };

    const started = performance.now();

    if (document.readyState === 'complete') {
      timers.push(setTimeout(finish, MINIMUM_MS));
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }

    // The ceiling is the safety net: a slow third-party image, a stalled
    // font, or a load event that never arrives can never pin the splash.
    timers.push(setTimeout(finish, CEILING_MS));

    return () => {
      cancelled = true;
      window.removeEventListener('load', onLoad);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (state === 'hidden') return null;

  return (
    <div
      // The overlay is aria-hidden, so it is invisible to role based queries.
      // This attribute gives the tests something stable to assert on.
      data-splash={state}
      className="pointer-events-none fixed inset-0 z-200 grid place-items-center overflow-hidden bg-ink-950"
      style={{
        opacity: state === 'leaving' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms var(--ease-out-expo)`,
      }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, #c9a22744 0%, transparent 62%)' }}
      />

      {/* Rings spreading from the point the droplet lands. */}
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="absolute rounded-full border border-gold-500/25"
          style={{
            width: 160 + index * 120,
            height: 160 + index * 120,
            animation: `splash-ring 3s ease-out ${index * 0.45}s infinite`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-6">
        <Image
          src="/brand/mersam-mark.png"
          alt=""
          width={168}
          height={131}
          priority
          className="h-auto w-32 drop-shadow-[0_8px_30px_rgba(201,162,39,0.35)]"
          style={{ animation: 'splash-in 0.9s var(--ease-out-expo) both' }}
        />

        <div style={{ animation: 'splash-in 0.9s var(--ease-out-expo) 160ms both' }}>
          <WaterDroplet size="md" label="Loading MerSam" />
        </div>

        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold-400"
          style={{ animation: 'splash-in 0.9s var(--ease-out-expo) 260ms both' }}
        >
          Water engineering
        </p>
      </div>

      <style>{`
        @keyframes splash-in { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: none; } }
        @keyframes splash-ring { 0% { transform: scale(0.35); opacity: 0.55; } 100% { transform: scale(1.25); opacity: 0; } }
      `}</style>
    </div>
  );
}
