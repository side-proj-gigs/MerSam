import { revalidatePath } from 'next/cache';

/**
 * Throws away the prerendered public pages after the office changes content.
 *
 * Every public page sets `export const revalidate`, which on its own is a
 * stale while revalidate cache: an edit stays invisible until the cached copy
 * is older than that window, and the visitor who crosses the line is still
 * handed the old page while the new one is built behind them. From the admin
 * that reads as "my change did not save", and clearing the browser proves
 * nothing, because the copy being served lives on the server and the CDN
 * rather than on the machine looking at it.
 *
 * Worse, the stale copy is self renewing. Whatever the regeneration happens to
 * read gets frozen for another full window, so an edit can appear to be
 * ignored for far longer than the window suggests.
 *
 * Called from a route handler this marks the pages as expired instead of
 * stale, so the next visit renders fresh rather than being served the previous
 * copy first.
 *
 * The whole site is invalidated rather than a chosen list of paths, because
 * this content is shared: the services are read by the home, services, service
 * detail, about, contact and FAQ pages, and the site settings are read by the
 * layout that wraps all of them. Naming the exact set would be bookkeeping
 * that quietly misses a page the next time one is added, which is the bug this
 * exists to prevent. Regenerating a dozen small pages on their next visit
 * costs about a query each.
 */
export function revalidatePublicSite(): void {
  try {
    revalidatePath('/', 'layout');
  } catch (error) {
    // The write already reached the database. Reporting it as a failure
    // because the cache could not be flushed would be a lie, and would invite
    // the office to save again. The timed window still applies as a backstop.
    console.error('[revalidate] could not expire the public pages', error);
  }
}
