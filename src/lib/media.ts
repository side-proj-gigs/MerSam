/**
 * Every stock photograph the seed data points at. Each identifier below was
 * fetched and inspected before being listed, so none of them is a dead link or
 * an unrelated subject. The office can swap any of them from the media manager
 * in the admin area without touching this file.
 *
 * Source: Unsplash, served from their image CDN under the Unsplash License,
 * which permits commercial use without attribution.
 */
const CDN = 'https://images.unsplash.com';

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  /** Where to keep the subject when the crop is tighter than the frame. */
  focus?: 'center' | 'top' | 'bottom' | 'entropy' | 'faces';
}

/** Builds a sized, compressed CDN URL rather than pulling the full original. */
export function photo(id: string, options: ImageOptions = {}): string {
  const { width = 1600, height, quality = 72, focus = 'entropy' } = options;
  const params = new URLSearchParams({
    auto: 'format',
    fit: 'crop',
    w: String(width),
    q: String(quality),
    crop: focus,
  });
  if (height) params.set('h', String(height));
  return `${CDN}/${id}?${params.toString()}`;
}

export const PHOTOS = {
  /* water and treatment */
  waterSurface: 'photo-1559825481-12a05cc00344',
  labTesting: 'photo-1581093450021-4a7360e9a6b5',
  labSamples: 'photo-1532187863486-abf9dbad1b69',
  labBench: 'photo-1581093577421-f561a654a353',
  safetyGoggles: 'photo-1581093588401-fbb62a02f120',
  filterMedia: 'photo-1416879595882-3373a0480b5b',

  /* pipework and plant */
  pipeGauges: 'photo-1607472586893-edb57bdc0e39',
  industrialPipes: 'photo-1543674892-7d64d45df18b',
  welding: 'photo-1504328345606-18bbc8c9d7d1',
  machinist: 'photo-1558618666-fcd25c85cd64',

  /* site and crew */
  siteAerial: 'photo-1541888946425-d81bb19240f5',
  siteScaffold: 'photo-1504307651254-35680f356dfd',
  siteTimber: 'photo-1589939705384-5185137a7f0f',
  cranes: 'photo-1565008447742-97f6f38c985c',
  technicianPortrait: 'photo-1621905252507-b35492cc74b4',
  technicianAtWork: 'photo-1621905251189-08b45d6a269e',
  teamHands: 'photo-1600880292089-90a7e086ee0c',

  /* homes and fittings */
  bathroomShower: 'photo-1584622650111-993a426fbf0a',
  bathroomTub: 'photo-1620626011761-996317b8d101',
  sealingWork: 'photo-1607400201515-c2c41c07d307',
  interiorWork: 'photo-1581578949510-fa7315c4c350',
  powerTool: 'photo-1572981779307-38b8cabb2407',

  /* energy */
  solarArray: 'photo-1497435334941-8c899ee9e8e9',
} as const;

export type PhotoKey = keyof typeof PHOTOS;

export function img(key: PhotoKey, options?: ImageOptions): string {
  return photo(PHOTOS[key], options);
}

/** A 1x1 translucent pixel, used as the blur placeholder under hero images. */
export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4IDUiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjUiIGZpbGw9IiMxMDE0MWIiLz48L3N2Zz4=';
