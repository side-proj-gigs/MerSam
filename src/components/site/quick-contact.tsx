'use client';

import { useState } from 'react';
import { MessageCircle, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrolledPast } from '@/hooks';

/**
 * A floating contact affordance. It stays out of the way until the visitor has
 * scrolled past the hero, which is roughly when they have decided they are
 * interested enough to get in touch.
 */
export function QuickContact({
  phone,
  whatsapp,
}: {
  phone: string;
  whatsapp: string | null;
}) {
  const [open, setOpen] = useState(false);
  const visible = useScrolledPast(520);
  const whatsappHandle = (whatsapp ?? phone).replace(/\D/g, '');

  return (
    <div
      className={cn(
        'fixed bottom-5 right-4 z-70 flex flex-col items-end gap-2.5 transition-all duration-400 ease-[var(--ease-out-expo)] sm:bottom-7 sm:right-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
      )}
    >
      {open && (
        <div className="flex flex-col items-end gap-2">
          <a
            href={`https://wa.me/${whatsappHandle}?text=${encodeURIComponent('Hello MerSam, I would like a quote for')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-full bg-[#25D366] py-2.5 pl-4 pr-5 text-sm font-semibold text-white shadow-[var(--shadow-float)] transition-transform hover:scale-[1.03]"
            style={{ animation: 'pop-in 0.3s var(--ease-spring) both' }}
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp us
          </a>
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            className="flex items-center gap-2.5 rounded-full bg-[var(--surface-raised)] py-2.5 pl-4 pr-5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-float)] ring-1 ring-[var(--border-subtle)] transition-transform hover:scale-[1.03]"
            style={{ animation: 'pop-in 0.3s var(--ease-spring) 60ms both' }}
          >
            <Phone className="size-4 text-[var(--brand)]" aria-hidden />
            {phone}
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Close contact options' : 'Contact us'}
        className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 text-ink-950 shadow-[0_10px_30px_-8px_rgba(201,162,39,0.85)] transition-transform hover:scale-105 active:scale-95"
      >
        {!open && (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-gold-500/45"
            style={{ animationDuration: '2.6s' }}
            aria-hidden
          />
        )}
        <span className="relative">
          {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
        </span>
      </button>

      <style>{`@keyframes pop-in{from{opacity:0;transform:translateY(10px) scale(0.94)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
