// Read-only requests: gameplay is signed out, so no synthetic account is needed.
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium, preparePage, testOrigin, openNextStep } = require('../browser/helpers.cjs');

(async () => {
  const origin = new URL(process.env.PH_BACKEND_ORIGIN);
  // Node fetch replaces Host; the HTTP client preserves the real published origin
  // while connecting through this run's private Docker network.
  const get = (path) =>
    new Promise((resolve, reject) => {
      const request = http.get(
        `http://app${path}`,
        { headers: { Host: origin.host } },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (body += chunk));
          response.on('error', reject);
          response.on('end', () => resolve({ status: response.statusCode, body }));
        },
      );
      request.setTimeout(10000, () => request.destroy(new Error('Backend request timed out')));
      request.on('error', reject);
    });
  const response = await get('/api/health');
  assert.equal(response.status, 200, 'Backend readiness must reach the migrated database');
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  const account = await get('/api/v1/account');
  assert.equal(account.status, 401, 'Anonymous account access must be rejected');
  console.log('PASS: HTTP readiness reaches the database; anonymous account returns 401.');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: 'en-US' });
    await page.addInitScript(preparePage, { webgl: false });
    await page.goto(testOrigin() + '/play', { timeout: 120000 });
    await openNextStep(page, 1);
    await page.locator('.town-tab-village').click();
    await page.getByRole('button', { name: /, save status: On this device$/ }).click();
    await page.getByRole('button', { name: 'Save online · Sign in', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Email me a sign-in link', exact: true }).waitFor();
    console.log(
      'PASS: playable signed-out town and login form. Email delivery/sign-in are outside this gameplay map.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
