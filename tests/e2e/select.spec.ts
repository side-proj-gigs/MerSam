import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './auth-state';

/**
 * The dropdown is a custom listbox rather than a native select, because the
 * native option list is drawn by the operating system and cannot be styled:
 * on a dark surface it produced unreadable text. These tests cover what that
 * replacement has to get right to be a fair trade.
 */
test.describe('select', () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/services');
    await page.getByRole('button', { name: /Add service/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('opens, shows every option and reports the right roles', async ({ page }) => {
    const category = page.getByRole('combobox', { name: 'Category' });
    await expect(category).toHaveAttribute('aria-expanded', 'false');

    await category.click();
    await expect(category).toHaveAttribute('aria-expanded', 'true');

    const listbox = page.getByRole('listbox', { name: 'Category' });
    await expect(listbox).toBeVisible();

    // The seeded categories, plus the empty choice.
    await expect(listbox.getByRole('option')).toHaveCount(5);
    await expect(listbox.getByRole('option', { name: 'Water Supply and Drilling' })).toBeVisible();

    // The current value is marked, not merely highlighted.
    await expect(listbox.getByRole('option', { selected: true })).toHaveText(/No category/);
  });

  test('the options are actually readable', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Category' }).click();

    const option = page.getByRole('option', { name: 'Treatment and Purification' });
    await expect(option).toBeVisible();

    // The original defect was pale text on the platform's white popup. Both
    // colours now come from the theme, so they must differ meaningfully.
    const { text, background } = await option.evaluate((element) => {
      const style = getComputedStyle(element);
      const panel = getComputedStyle(element.closest('[role="listbox"]')!.parentElement!);
      return { text: style.color, background: panel.backgroundColor };
    });

    const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const [tr, tg, tb] = channels(text);
    const [br, bg, bb] = channels(background);
    const distance = Math.abs(tr! - br!) + Math.abs(tg! - bg!) + Math.abs(tb! - bb!);

    expect(distance, `text ${text} on ${background} must be distinguishable`).toBeGreaterThan(150);
  });

  test('selects with the keyboard and keeps the choice', async ({ page }) => {
    const category = page.getByRole('combobox', { name: 'Category' });
    await category.focus();

    await page.keyboard.press('ArrowDown');

    // The categories arrive over the network, so wait for the real list before
    // arrowing through it. Pressing Down against a list of one goes nowhere,
    // which is correct behaviour and not what this test is about.
    const listbox = page.getByRole('listbox', { name: 'Category' });
    await expect(listbox.getByRole('option')).toHaveCount(5);

    // Opens on the current selection, so two steps reaches the third entry.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(listbox.getByRole('option', { name: 'Water Supply and Drilling' })).toHaveAttribute(
      'id',
      await category.getAttribute('aria-activedescendant').then((id) => id ?? ''),
    );

    await page.keyboard.press('Enter');

    await expect(category).toHaveText(/Water Supply and Drilling/);
    await expect(category).toHaveAttribute('aria-expanded', 'false');
  });

  test('selects with the pointer', async ({ page }) => {
    const category = page.getByRole('combobox', { name: 'Category' });
    await category.click();
    await page.getByRole('option', { name: 'Plumbing and Installation' }).click();

    await expect(category).toHaveText(/Plumbing and Installation/);
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('a long list gets a filter', async ({ page }) => {
    const icon = page.getByRole('combobox', { name: 'Icon' });
    await icon.click();

    const filter = page.getByRole('textbox', { name: 'Filter options' });
    await expect(filter).toBeVisible();

    await filter.fill('wren');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toHaveText(/wrench/);

    await filter.fill('zzzz');
    await expect(page.getByText(/Nothing matches that/i)).toBeVisible();
  });

  test('escape closes the list without closing the dialog', async ({ page }) => {
    // React delegates its listeners to the document in the App Router, which
    // is where the dialog's own key handler lives, so this regressed once.
    const category = page.getByRole('combobox', { name: 'Category' });
    await category.click();
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();

    // A second Escape, with no list open, closes the dialog as it should.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('clicking elsewhere closes the list and leaves the value alone', async ({ page }) => {
    const category = page.getByRole('combobox', { name: 'Category' });
    await category.click();
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.getByLabel('Name').click();

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(category).toHaveText(/No category/);
  });

  test('the list is anchored to its field and stays on screen', async ({ page }) => {
    const category = page.getByRole('combobox', { name: 'Category' });
    await category.click();

    const field = (await category.boundingBox())!;
    const list = (await page.locator('[role="listbox"]').boundingBox())!;
    const viewport = page.viewportSize()!;

    // Directly under the field rather than wherever the platform fancies.
    expect(Math.abs(list.x - field.x)).toBeLessThan(4);
    expect(list.y).toBeGreaterThanOrEqual(field.y);
    expect(list.y).toBeLessThan(field.y + field.height + 24);

    // And never hanging off the edge of the window.
    expect(list.x).toBeGreaterThanOrEqual(0);
    expect(list.x + list.width).toBeLessThanOrEqual(viewport.width + 1);
  });
});
