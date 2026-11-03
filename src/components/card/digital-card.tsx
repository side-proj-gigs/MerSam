'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Share2,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StaffCard } from '@core/entities';
import { cn, initials } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks';

interface Tilt {
  rotateX: number;
  rotateY: number;
  /** Pointer position in percent, used to move the specular highlight. */
  glareX: number;
  glareY: number;
  active: boolean;
}

const RESTING: Tilt = { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, active: false };
const MAX_TILT = 13;

export function DigitalCard({
  card,
  company,
  siteUrl,
}: {
  card: StaffCard;
  company: { name: string; tagline: string; phone: string; email: string; logoUrl: string };
  siteUrl: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<Tilt>(RESTING);
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const reduced = usePrefersReducedMotion();

  const cardUrl = `${siteUrl}/card/${card.slug}`;

  /**
   * The tilt is read from the pointer's position over the card and applied as a
   * single transform, so the browser keeps the whole thing on the compositor.
   * Touch devices are left out: there is no hover there, and a card that moves
   * while you are trying to scroll past it is an irritation, not a delight.
   */
  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduced || event.pointerType === 'touch') return;
      const node = surface.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      setTilt({
        rotateX: (0.5 - y) * MAX_TILT * 2,
        rotateY: (x - 0.5) * MAX_TILT * 2,
        glareX: x * 100,
        glareY: y * 100,
        active: true,
      });
    },
    [reduced],
  );

  const onPointerLeave = useCallback(() => setTilt(RESTING), []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      toast.success('Card link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  }

  async function share() {
    // The native sheet is the better experience where it exists.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `${card.name}, ${company.name}`,
          text: `${card.name} ${card.jobTitle ? `| ${card.jobTitle}` : ''}`,
          url: cardUrl,
        });
        return;
      } catch (error) {
        // A cancelled share is not a failure worth reporting.
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  const actions = [
    card.phone && {
      key: 'call',
      label: 'Call',
      href: `tel:${card.phone}`,
      Icon: Phone,
      tone: 'gold' as const,
    },
    card.whatsapp && {
      key: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/${card.whatsapp.replace(/\D/g, '')}`,
      Icon: MessageCircle,
      tone: 'green' as const,
      external: true,
    },
    {
      key: 'email',
      label: 'Email',
      href: `mailto:${card.email}`,
      Icon: Mail,
      tone: 'plain' as const,
    },
    card.linkedinUrl && {
      key: 'linkedin',
      label: 'LinkedIn',
      href: card.linkedinUrl,
      Icon: Linkedin,
      tone: 'plain' as const,
      external: true,
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    href: string;
    Icon: typeof Phone;
    tone: 'gold' | 'green' | 'plain';
    external?: boolean;
  }[];

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {/* The stage. Perspective lives here so the card itself only rotates. */}
      <div
        className="w-full"
        style={{ perspective: '1400px' }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div
          ref={surface}
          className="relative w-full"
          style={{
            aspectRatio: '0.63',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY + (flipped ? 180 : 0)}deg)`,
            transition: tilt.active
              ? 'transform 0.12s ease-out'
              : 'transform 0.75s var(--ease-out-expo)',
          }}
        >
          {/* ------------------------------------------------------- front */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[2rem]"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            aria-hidden={flipped}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950" />

            {/* Brushed metal, drawn as a repeating gradient rather than an image. */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(118deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
              }}
            />

            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  'radial-gradient(ellipse at 18% 8%, rgba(201,162,39,0.42) 0%, transparent 55%), radial-gradient(ellipse at 88% 94%, rgba(30,156,179,0.32) 0%, transparent 52%)',
              }}
            />

            {/* Ripples, echoing the droplet in the mark. */}
            <svg
              className="absolute inset-0 size-full opacity-[0.13]"
              viewBox="0 0 400 640"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden
            >
              {[70, 130, 195, 265].map((radius) => (
                <circle
                  key={radius}
                  cx="330"
                  cy="78"
                  r={radius}
                  fill="none"
                  stroke="#c9a227"
                  strokeWidth="1.2"
                />
              ))}
            </svg>

            {/* The specular sweep. It follows the pointer, which is what sells
                the illusion that the surface has a gloss. */}
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: tilt.active ? 1 : 0,
                background: `radial-gradient(circle 240px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.22), transparent 62%)`,
              }}
            />

            {/* A metallic rim rather than a flat border. */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[2rem]"
              style={{
                padding: 1.5,
                background:
                  'linear-gradient(140deg, #f0dca8, rgba(201,162,39,0.1) 32%, rgba(201,162,39,0.1) 64%, #8a671c)',
                WebkitMask:
                  'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />

            <div
              className="relative flex h-full flex-col p-7"
              style={{ transform: 'translateZ(42px)', transformStyle: 'preserve-3d' }}
            >
              <div className="flex items-start justify-between">
                <Image
                  src={company.logoUrl || '/brand/mersam-mark.png'}
                  alt={company.name}
                  width={96}
                  height={75}
                  className="h-11 w-auto drop-shadow-[0_4px_14px_rgba(201,162,39,0.4)]"
                />
                <span className="rounded-full border border-gold-500/35 bg-ink-950/50 px-2.5 py-1 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-gold-300 backdrop-blur-sm">
                  Water engineering
                </span>
              </div>

              <div className="mt-auto">
                <div className="relative mb-5 size-20 shrink-0">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-gold-300 to-gold-700 opacity-70 blur-[6px]" />
                  {card.avatarUrl ? (
                    <Image
                      src={card.avatarUrl}
                      alt={card.name}
                      fill
                      sizes="80px"
                      className="relative rounded-full object-cover ring-2 ring-gold-400/70"
                    />
                  ) : (
                    <span className="relative grid size-20 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 font-display text-2xl font-bold text-ink-950 ring-2 ring-gold-300/60">
                      {initials(card.name)}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-white">
                  {card.name}
                </h1>
                <p className="mt-1 text-sm font-semibold text-gold-300">{card.jobTitle}</p>

                {card.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-300">
                    <MapPin className="size-3.5" aria-hidden />
                    {card.location}
                  </p>
                )}

                {card.specialities.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {card.specialities.slice(0, 4).map((speciality) => (
                      <li
                        key={speciality}
                        className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[0.6875rem] font-medium text-ink-200 backdrop-blur-sm"
                      >
                        {speciality}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs text-ink-300">
                  {card.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-gold-400" aria-hidden />
                      {card.phone}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Mail className="size-3.5 text-gold-400" aria-hidden />
                    <span className="truncate">{card.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Globe className="size-3.5 text-gold-400" aria-hidden />
                    {siteUrl.replace(/^https?:\/\//, '')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------- back */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 to-ink-950"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            aria-hidden={!flipped}
          >
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 20%, rgba(201,162,39,0.3) 0%, transparent 58%)',
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-[2rem]"
              style={{
                padding: 1.5,
                background:
                  'linear-gradient(140deg, #f0dca8, rgba(201,162,39,0.1) 40%, #8a671c)',
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />

            <div className="relative flex h-full flex-col items-center justify-center gap-5 p-8">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-gold-300">
                Scan to save my details
              </p>

              <div className="rounded-3xl bg-white p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
                {/* Rendered server side, so there is no QR library on the client. */}
                <Image
                  src={`/api/card/${card.slug}/qr?theme=gold&size=560`}
                  alt={`QR code linking to the digital card for ${card.name}`}
                  width={224}
                  height={224}
                  unoptimized
                  className="size-56"
                />
              </div>

              <div className="text-center">
                <p className="font-display text-lg font-semibold text-white">{card.name}</p>
                <p className="text-xs text-gold-300">{card.jobTitle}</p>
              </div>

              <p className="text-center text-[0.625rem] text-ink-400">
                {siteUrl.replace(/^https?:\/\//, '')}/card/{card.slug}
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-ink-200 backdrop-blur-sm transition-colors hover:bg-white/12"
        aria-pressed={flipped}
      >
        <QrCode className="size-3.5" aria-hidden />
        {flipped ? 'Show the card' : 'Show the QR code'}
      </button>

      {card.bio && (
        <p className="text-center text-sm leading-relaxed text-ink-300">{card.bio}</p>
      )}

      <div className="grid w-full gap-2.5">
        <a
          href={`/api/card/${card.slug}/vcf`}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-400 via-gold-500 to-gold-700 px-5 py-3.5 text-sm font-bold text-ink-950 shadow-[0_10px_30px_-10px_rgba(201,162,39,0.85)] transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          <UserPlus className="size-4" aria-hidden />
          Save to contacts
        </a>

        <div className="grid grid-cols-2 gap-2.5">
          {actions.map((action) => (
            <a
              key={action.key}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noopener noreferrer' : undefined}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                action.tone === 'green' && 'bg-[#25D366] text-white hover:brightness-110',
                action.tone === 'gold' &&
                  'border border-gold-500/40 bg-gold-500/12 text-gold-300 hover:bg-gold-500/20',
                action.tone === 'plain' &&
                  'border border-white/12 bg-white/[0.06] text-ink-200 hover:bg-white/12',
              )}
            >
              <action.Icon className="size-4" aria-hidden />
              {action.label}
            </a>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-ink-200 transition-colors hover:bg-white/12"
          >
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-ink-200 transition-colors hover:bg-white/12"
          >
            {copied ? (
              <Check className="size-4 text-[var(--color-success)]" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <WallpaperPanel slug={card.slug} name={card.name} />
    </div>
  );
}

/**
 * Lets the viewer take the code away as a lock screen. The SVG is drawn onto a
 * canvas at device resolution and handed back as a PNG, because phones will not
 * accept an SVG as wallpaper.
 */
function WallpaperPanel({ slug, name }: { slug: string; name: string }) {
  const [theme, setTheme] = useState<'dark' | 'light' | 'gold'>('dark');
  const [busy, setBusy] = useState(false);

  const previewSrc = `/api/card/${slug}/wallpaper?theme=${theme}&width=430&height=932`;

  async function download() {
    setBusy(true);
    try {
      const response = await fetch(`/api/card/${slug}/wallpaper?theme=${theme}`);
      if (!response.ok) throw new Error('request failed');
      const svg = await response.text();

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const image = new window.Image();
      image.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('could not rasterise'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1290;
      canvas.height = 2796;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no canvas context');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!png) throw new Error('could not encode');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(png);
      link.download = `${slug}-wallpaper.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);

      toast.success('Wallpaper saved', { description: 'Set it as your lock screen to share on the go' });
    } catch {
      // Falling back to the SVG still gives them something usable.
      window.open(`/api/card/${slug}/wallpaper?theme=${theme}`, '_blank');
      toast.message('Opened the wallpaper in a new tab', {
        description: 'Long press or right click to save it',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold-500/15 text-gold-300">
          <Smartphone className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-sans text-sm font-semibold text-white">Lock screen wallpaper</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            Put {name.split(' ')[0]}&apos;s code on a phone so it can be scanned without unlocking.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="w-24 shrink-0 overflow-hidden rounded-xl border border-white/12">
          <Image
            src={previewSrc}
            alt="Wallpaper preview"
            width={96}
            height={208}
            unoptimized
            className="h-auto w-full"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div
            className="flex gap-1.5 rounded-lg border border-white/10 bg-ink-950/50 p-1"
            role="group"
            aria-label="Wallpaper style"
          >
            {(['dark', 'light', 'gold'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                aria-pressed={theme === option}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[0.6875rem] font-semibold capitalize transition-colors',
                  theme === option
                    ? 'bg-gold-500 text-ink-950'
                    : 'text-ink-300 hover:bg-white/8',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/12 px-4 py-2.5 text-sm font-semibold text-gold-300 transition-colors hover:bg-gold-500/20 disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden />
            {busy ? 'Preparing' : 'Download wallpaper'}
          </button>
        </div>
      </div>
    </section>
  );
}
