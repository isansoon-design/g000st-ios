const { test, expect, request } = require('@playwright/test');

function attachCollectors(page) {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push(msg.text());
  });

  page.on('pageerror', (err) => {
    state.pageErrors.push(String(err));
  });

  page.on('requestfailed', (req) => {
    state.requestFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`);
  });

  return state;
}

test('Frontend appfg000st loads without runtime errors', async ({ page }) => {
  const c = attachCollectors(page);
  const res = await page.goto('http://127.0.0.1:5173/appfg000st.html', { waitUntil: 'domcontentloaded' });
  expect(res && res.ok()).toBeTruthy();

  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(4000);

  expect.soft(c.pageErrors, `pageErrors: ${JSON.stringify(c.pageErrors, null, 2)}`).toHaveLength(0);
  
  const appErrors = c.consoleErrors.filter((x) => !x.includes('404') && !x.includes('Failed to load') && !x.includes('bad HTTP'));
  expect.soft(appErrors, `critical errors: ${JSON.stringify(appErrors, null, 2)}`).toHaveLength(0);

  const failedLocal = c.requestFailures.filter((x) => !x.includes('firestore.googleapis.com') && !x.includes('cdn.'));
  expect.soft(failedLocal, `local request failures: ${JSON.stringify(failedLocal, null, 2)}`).toHaveLength(0);
});

test('Frontend wweindex loads and ID gate exists', async ({ page }) => {
  const c = attachCollectors(page);
  const res = await page.goto('http://127.0.0.1:5173/wweindex.html', { waitUntil: 'domcontentloaded' });
  expect(res && res.ok()).toBeTruthy();

  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#pasteInput')).toBeVisible();
  await expect(page.locator('#btnPaste')).toBeVisible();
  await page.waitForTimeout(4000);

  expect.soft(c.pageErrors, `pageErrors: ${JSON.stringify(c.pageErrors, null, 2)}`).toHaveLength(0);
  
  const adminErrors = c.consoleErrors.filter((x) => !x.includes('404') && !x.includes('Failed to load') && !x.includes('bad HTTP'));
  expect.soft(adminErrors, `critical errors: ${JSON.stringify(adminErrors, null, 2)}`).toHaveLength(0);

  const failedLocal = c.requestFailures.filter((x) => !x.includes('firestore.googleapis.com') && !x.includes('cdn.'));
  expect.soft(failedLocal, `local request failures: ${JSON.stringify(failedLocal, null, 2)}`).toHaveLength(0);
});

test('Backend endpoints return healthy responses', async () => {
  const ctx = await request.newContext();

  const feed = await ctx.get('http://127.0.0.1:3001/feed');
  expect(feed.ok()).toBeTruthy();
  const feedJson = await feed.json();
  expect(feedJson.ok).toBeTruthy();

  const gen = await ctx.post('http://127.0.0.1:3001/generate-code', { data: {} });
  expect(gen.ok()).toBeTruthy();
  const genJson = await gen.json();
  expect((genJson.code || '').length).toBe(50);

  const check = await ctx.post('http://127.0.0.1:3001/check-code', { data: { code: genJson.code } });
  expect(check.ok()).toBeTruthy();
  const checkJson = await check.json();
  expect(checkJson.valid).toBeTruthy();

  const unified = await ctx.get('http://127.0.0.1:3002/generate-code');
  expect(unified.ok()).toBeTruthy();

  const legacyHealth = await ctx.get('http://127.0.0.1:3003/health');
  expect(legacyHealth.ok()).toBeTruthy();
  const healthJson = await legacyHealth.json();
  expect(healthJson.ok).toBeTruthy();

  await ctx.dispose();
});
