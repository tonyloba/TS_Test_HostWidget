import { test, expect, Page, Frame } from '@playwright/test';

const HOST_URL = 'http://localhost:8000/host.html';
const WIDGET_ORIGIN = 'http://localhost:8001';
const WIDGET_URL = `${WIDGET_ORIGIN}/widget.html`;

type WidgetEvent =
  | { type: 'searchMetrics'; totalResults: number; query: string }
  | { type: 'resultClick'; id: number }
  | { type: string; [k: string]: unknown };

async function installMessageCollector(page: Page) {
  await page.addInitScript(() => {
    (window as any).__pwMessages = [];
    window.addEventListener('message', (event) => {
      (window as any).__pwMessages.push({ origin: event.origin, data: event.data });
    });
  });
}

async function getMessages(page: Page): Promise<Array<{ origin: string; data: WidgetEvent }>> {
  return (await page.evaluate(() => (window as any).__pwMessages || [])) as any;
}

async function waitForWidgetMessage(
  page: Page,
  predicate: (m: { origin: string; data: WidgetEvent }) => boolean
) {
  await expect
    .poll(async () => {
      const msgs = await getMessages(page);
      return msgs.find(predicate) ?? null;
    })
    .not.toBeNull();
}

async function getWidgetFrame(page: Page): Promise<Frame> {
  await page.goto(HOST_URL);
  await expect(page.locator('#widget-frame')).toBeVisible();

  const frame = page.frame({ url: new RegExp(`^${WIDGET_ORIGIN.replace(/\./g, '\\.')}/widget\\.html`) });
  if (!frame) throw new Error('Widget frame not found');
  return frame;
}

test.describe('Host - Widget (cross-origin iframe) integration', () => {
  test.beforeEach(async ({ page }) => {
    await installMessageCollector(page);
  });

  test('valid search shows results + emits searchMetrics', async ({ page }) => {
    const frame = await getWidgetFrame(page);

    await frame.locator('#query').fill('playwright');
    await frame.locator('#searchBtn').click();

    await expect(frame.locator('.result-item', { hasText: 'Playwright Testing Framework' })).toBeVisible();

    await waitForWidgetMessage(page, (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'searchMetrics');

    const metrics = (await getMessages(page)).find(
      (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'searchMetrics'
    )!.data as any;

    expect(metrics.query).toBe('playwright');
    expect(metrics.totalResults).toBeGreaterThan(0);
  });

  test('invalid search shows "No results found" + emits searchMetrics(totalResults=0)', async ({ page }) => {
    const frame = await getWidgetFrame(page);

    await frame.locator('#query').fill('xyz');
    await frame.locator('#searchBtn').click();

    await expect(frame.locator('.no-results')).toHaveText('No results found');

    await waitForWidgetMessage(page, (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'searchMetrics');

    const metrics = (await getMessages(page)).find(
      (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'searchMetrics'
    )!.data as any;

    expect(metrics.query).toBe('xyz');
    expect(metrics.totalResults).toBe(0);
  });

  test('clicking a result sends resultClick(id=1) to host', async ({ page }) => {
    const frame = await getWidgetFrame(page);

    await frame.locator('#query').fill('playwright');
    await frame.locator('#searchBtn').click();

    const result = frame.locator('.result-item', { hasText: 'Playwright Testing Framework' });
    await expect(result).toBeVisible();
    await result.click();

    await waitForWidgetMessage(page, (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'resultClick');

    const click = (await getMessages(page)).find(
      (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'resultClick'
    )!.data as any;

    expect(click.id).toBe(1);
  });

  test('keyboard: Enter on focused result triggers resultClick', async ({ page }) => {
    const frame = await getWidgetFrame(page);

    await frame.locator('#query').fill('playwright');
    await frame.locator('#searchBtn').click();

    const result = frame.locator('.result-item', { hasText: 'Playwright Testing Framework' });
    await expect(result).toBeVisible();

    await result.focus();
    await result.press('Enter');

    await waitForWidgetMessage(page, (m) => m.origin === WIDGET_ORIGIN && m.data.type === 'resultClick');
  });

  test('cross-origin sanity: host origin != widget origin', async ({ page }) => {
    const frame = await getWidgetFrame(page);

    expect(new URL(page.url()).origin).toBe('http://localhost:8000');
    expect(new URL(frame.url()).origin).toBe(WIDGET_ORIGIN);
    expect(frame.url()).toBe(WIDGET_URL);
  });
});
