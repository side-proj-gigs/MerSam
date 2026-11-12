import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  parsePatch,
  serviceSchema,
  settingsSchema,
} from '../../src/presentation/validation/schemas';

/**
 * That a partial update touches only the fields it was given.
 *
 * This is the guard on a silent data loss bug. Zod's `.partial()` marks every
 * field optional but leaves its default in place, so `schema.partial().parse`
 * answers a one field request with every other field filled in, and the
 * repository writes those defaults over real content. It cost this site its
 * hero slides, statistics, offices, opening hours and address, and emptied the
 * body text of a service, from a request that named none of them.
 *
 * Nothing about it is visible in review: the call reads correctly, the types
 * are satisfied, and the admin forms happen to send every field, so the forms
 * never showed it. Only a request that sends one field does.
 */
describe('parsePatch', () => {
  it('returns only the fields the caller sent', () => {
    const patched = parsePatch(settingsSchema, { tagline: 'Water, done properly' });

    expect(Object.keys(patched)).toEqual(['tagline']);
    expect(patched.tagline).toBe('Water, done properly');
  });

  it('does not invent the fields that would overwrite stored content', () => {
    const patched = parsePatch(settingsSchema, { tagline: 'One field only' }) as Record<
      string,
      unknown
    >;

    // The exact fields the live site lost to this bug.
    for (const field of [
      'heroSlides',
      'stats',
      'offices',
      'socials',
      'businessHours',
      'addressLines',
      'about',
      'mission',
      'defaultVatRate',
      'defaultCurrency',
      'emailEnabled',
      'seoTitle',
    ]) {
      expect(patched, `${field} must stay absent`).not.toHaveProperty(field);
    }
  });

  it('is what plain partial parsing is not', () => {
    // The behaviour being guarded against, stated outright so the reason this
    // helper exists cannot be mistaken for ceremony.
    const naive = settingsSchema.partial().parse({ tagline: 'One field only' });

    expect(Object.keys(naive).length).toBeGreaterThan(20);
    expect(naive.heroSlides).toEqual([]);
    expect(naive.emailEnabled).toBe(false);

    expect(Object.keys(parsePatch(settingsSchema, { tagline: 'One field only' }))).toHaveLength(1);
  });

  it('still validates what it was given', () => {
    expect(() => parsePatch(settingsSchema, { primaryEmail: 'not an address' })).toThrow();
    expect(() => parsePatch(serviceSchema, { name: '' })).toThrow();
  });

  it('still normalises a field that was sent', () => {
    // A media URL copied from the library arrives absolute and has to be cut
    // back to a path, or next/image refuses it.
    const patched = parsePatch(serviceSchema, {
      heroImageUrl: 'https://mersam-gamma.vercel.app/api/media/'
        + '0f2b7c38-9a1e-4c55-8a7d-2c1f5b4e6a90/raw',
    });

    expect(patched.heroImageUrl).toBe('/api/media/0f2b7c38-9a1e-4c55-8a7d-2c1f5b4e6a90/raw');
  });

  it('keeps a field the caller sent as an empty value', () => {
    // Clearing a field is a real intention and must not be mistaken for
    // silence. This is why the keys are taken from the request, not from
    // whether the parsed value looks empty.
    const patched = parsePatch(settingsSchema, { tagline: '', seoKeywords: [] });

    expect(patched).toEqual({ tagline: '', seoKeywords: [] });
  });

  it('fills defaults inside an object the caller did send', () => {
    // The defaults are useful one level down: a slide given only a headline
    // should still come out with a call to action.
    const patched = parsePatch(settingsSchema, {
      heroSlides: [{ headline: 'We find the water before we drill for it' }],
    });

    expect(patched.heroSlides).toHaveLength(1);
    expect(patched.heroSlides?.[0]).toMatchObject({
      headline: 'We find the water before we drill for it',
      ctaLabel: 'Request a quote',
      ctaHref: '/contact',
      eyebrow: '',
    });
  });

  it('rejects a body that is not an object', () => {
    for (const body of ['a string', 42, null, [1, 2, 3], true]) {
      expect(() => parsePatch(settingsSchema, body)).toThrow();
    }
  });

  it('ignores keys the schema does not define', () => {
    const patched = parsePatch(settingsSchema, { tagline: 'Kept', sneaky: 'dropped' }) as Record<
      string,
      unknown
    >;

    expect(patched).toEqual({ tagline: 'Kept' });
  });

  it('works on any object schema, not only the ones in this codebase', () => {
    const schema = z.object({
      kept: z.string().default('a default'),
      absent: z.array(z.string()).default(['also a default']),
    });

    expect(parsePatch(schema, { kept: 'sent' })).toEqual({ kept: 'sent' });
  });
});
