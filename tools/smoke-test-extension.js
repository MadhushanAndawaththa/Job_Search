const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-search-lens-smoke-'));
  let context;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${ROOT}`,
        `--load-extension=${ROOT}`,
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ||= await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;
    assert.equal(
      await serviceWorker.evaluate(() => (
        typeof chrome.contextMenus.create === 'function'
        && typeof chrome.permissions.request === 'function'
        && typeof chrome.scripting.registerContentScripts === 'function'
      )),
      true,
      'required extension APIs are unavailable',
    );
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        keywords: [
          {
            id: 'kw:backend',
            term: 'Backend',
            normalized: 'backend',
            color: '#FFE082',
            enabled: true,
          },
        ],
      });
    });
    await page.reload();

    await page.waitForSelector('#keywordList > li');
    assert.equal(await page.locator('#popupVersion').textContent(), 'v1.3.1');
    await page.locator('#exportKeywords').click();
    assert.equal(await page.locator('#exportKeywords').textContent(), 'Copied!');
    assert.deepEqual(pageErrors, []);

    const linkedInPage = await context.newPage();
    const linkedInErrors = [];
    linkedInPage.on('pageerror', (error) => linkedInErrors.push(error.message));
    await linkedInPage.route('https://www.linkedin.com/jobs/**', (route) => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
        <main>
          <div class="generic-results">
            <div class="scaffold-layout__list-item" data-occludable-job-id="1">
              <div class="job-card-container" data-job-id="1">
                <a class="job-card-container__link job-card-list__title--link" href="/jobs/view/1/">Backend Engineer</a>
                <ul class="job-card-list__footer-wrapper">
                  <li class="job-card-container__footer-job-state">Viewed</li>
                </ul>
              </div>
            </div>
          </div>
          <section class="jobs-search__job-details--container">
            <h1 class="job-details-jobs-unified-top-card__job-title">Backend Engineer</h1>
            <section>
              <h2>About the company</h2>
              <span>201-500 employees</span>
              <span>34,210 on LinkedIn</span>
            </section>
          </section>
        </main>`,
    }));
    await linkedInPage.goto('https://www.linkedin.com/jobs/search/?keywords=backend');
    await linkedInPage.waitForSelector('[data-jhv-state="viewed"]');
    await linkedInPage.waitForSelector('mark[data-job-hunt-mark]');
    await linkedInPage.waitForSelector('[data-jhv-company-stat="company-size"]');
    await linkedInPage.waitForSelector('[data-jhv-company-stat="company-network"]');
    assert.deepEqual(linkedInErrors, []);

    console.log(`Browser smoke test passed for chrome-extension://${extensionId}/`);
    console.log('Verified extension APIs, popup/storage/clipboard, LinkedIn dimming, highlighting, and company stats.');
  } finally {
    await context?.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
