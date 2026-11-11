import { describe, expect, it } from 'vitest';
import { normaliseMediaUrl } from '../../src/core/entities';

/**
 * The bug this prevents: an address copied out of the media library is a full
 * URL, and `next/image` answers 400 for an absolute URL whose host is not in
 * `remotePatterns`. A site does not list itself, so the picture simply never
 * appeared and nothing said why.
 */
describe('normalising a media address', () => {
  it('reduces a link to our own media to its path', () => {
    expect(normaliseMediaUrl('https://mersam-gamma.vercel.app/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw'))
      .toBe('/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw');
  });

  it('does the same whatever host it was copied from', () => {
    // A preview deployment, a custom domain and localhost all produce a
    // different host for the very same file.
    for (const host of ['https://mersam.com', 'https://mersam-git-main.vercel.app', 'http://localhost:3000']) {
      expect(normaliseMediaUrl(`${host}/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw`)).toBe(
        '/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw',
      );
    }
  });

  it('leaves a path that is already relative alone', () => {
    const path = '/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw';
    expect(normaliseMediaUrl(path)).toBe(path);
  });

  it('leaves an external address alone', () => {
    // These are configured hosts and must keep their protocol and domain.
    for (const url of [
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5',
      'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    ]) {
      expect(normaliseMediaUrl(url)).toBe(url);
    }
  });

  it('is not fooled by another site that happens to have the same path', () => {
    // Only the shape of the path is matched, so this still gets reduced, and
    // that is the right call: we cannot serve someone else's bytes anyway and
    // a relative path points at our own copy or at nothing.
    const foreign = 'https://example.com/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw';
    expect(normaliseMediaUrl(foreign)).toBe('/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw');
  });

  it('ignores a media-looking path that is not actually one', () => {
    for (const url of [
      'https://cdn.example.com/api/media/not-a-uuid/raw',
      'https://cdn.example.com/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/thumbnail',
      'https://cdn.example.com/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw',
    ]) {
      expect(normaliseMediaUrl(url)).toBe(url);
    }
  });

  it('trims, and survives anything that is not a URL at all', () => {
    expect(normaliseMediaUrl('  https://mersam.com/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw  ')).toBe(
      '/api/media/9ced5798-02f7-439f-8ad8-8a0ae86d6bcc/raw',
    );
    expect(normaliseMediaUrl('')).toBe('');
    expect(normaliseMediaUrl('   ')).toBe('');
    expect(normaliseMediaUrl('not a url')).toBe('not a url');
  });
});
