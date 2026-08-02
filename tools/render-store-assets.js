const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DOCS_STORE_DIR = path.join(ROOT, 'docs', 'assets', 'store');
const PACKAGE_STORE_DIR = path.join(ROOT, 'assets', 'store');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requestedPath = pathname === '/' ? '/docs/index.html' : pathname;
    const absolutePath = path.resolve(ROOT, `.${requestedPath}`);

    if (!absolutePath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(absolutePath)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const filePath = fs.statSync(absolutePath).isDirectory()
      ? path.join(absolutePath, 'index.html')
      : absolutePath;

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function popupChromeMock() {
  const data = {
    keywords: [
      { id: 'javascript', term: 'JavaScript', normalized: 'javascript', color: '#FFE082', enabled: true },
      { id: 'remote', term: 'Remote', normalized: 'remote', color: '#90CAF9', enabled: true },
      { id: 'senior', term: 'Senior', normalized: 'senior', color: '#EF9A9A', enabled: false },
    ],
    settings: {
      paused: false,
      highlightAllSites: true,
      dimStates: { viewed: true, saved: true, applied: true },
    },
  };

  globalThis.chrome = {
    storage: {
      local: {
        get: async () => structuredClone(data),
        set: async (values) => Object.assign(data, values),
      },
      onChanged: { addListener() {} },
    },
    permissions: {
      contains: async () => true,
      request: async () => true,
      remove: async () => true,
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://www.linkedin.com/jobs/search/' }],
      sendMessage: async (_tabId, message) => message.type.endsWith('ping')
        ? {
            ok: true,
            isLinkedInPage: true,
            isJobsPage: true,
            hasListContainer: true,
            hasDetailContainer: true,
            hasFallbackRoot: true,
            keywordCount: data.keywords.length,
            stateCounts: { viewed: 3, saved: 2, applied: 1 },
            matchCount: 7,
            activeMatchIndex: 0,
            paused: false,
          }
        : { ok: true, matchCount: 7, activeMatchIndex: 1 },
    },
    runtime: {
      getManifest: () => ({ version: '1.3.1', version_name: '1.3.1' }),
      sendMessage: async () => ({ ok: true }),
    },
  };
}

async function newContext(browser, viewport, colorScheme = 'light') {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme,
  });
  await context.addInitScript(popupChromeMock);
  return context;
}

async function screenshotPage(browser, { url, outputPath, width, height, colorScheme = 'light' }) {
  const context = await newContext(browser, { width, height }, colorScheme);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: outputPath, fullPage: false, scale: 'css' });
  await context.close();

  if (pageErrors.length) {
    throw pageErrors[0];
  }
}

function popupComposite(baseUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin:0; width:1280px; height:800px; overflow:hidden; font-family:"Aptos","Segoe UI",Arial,sans-serif; }
    body { background:linear-gradient(90deg,#07142d 0 52%,#e8eff8 52% 100%); display:grid; grid-template-columns:1.04fr .96fr; align-items:center; padding:30px 72px; color:#fff; }
    .left { padding-right:24px; }
    .brand-row { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
    .icon { width:48px; height:48px; border-radius:12px; background:#0d2044; border:1px solid rgba(255,255,255,.14); color:#ffd21a; display:grid; place-items:center; }
    .icon svg { width:26px; height:26px; }
    .brand { font-size:22px; font-weight:800; letter-spacing:-.025em; }
    h1 { font-family:"Arial Black","Aptos Display","Segoe UI",sans-serif; font-size:55px; font-weight:900; letter-spacing:-.05em; line-height:1.04; max-width:580px; }
    h1 .hl { display:inline-block; margin-top:11px; background:#ffd21a; color:#07142d; border-radius:5px; padding:0 .12em .08em; line-height:1.02; }
    .lede { margin-top:20px; font-size:18px; color:#bdc7df; line-height:1.5; max-width:520px; }
    .tags { margin-top:26px; display:flex; gap:8px; flex-wrap:wrap; }
    .tag { padding:7px 12px; border-radius:7px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); color:#d5dcef; font-family:"Cascadia Mono",Consolas,monospace; font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; }
    .tag.y { background:#ffd21a; color:#07142d; border-color:#ffd21a; }
    .stage { display:flex; align-items:center; justify-content:center; }
    .frame { border-radius:26px; background:rgba(255,255,255,.76); padding:16px; border-left:12px solid #ffd21a; box-shadow:0 40px 80px -20px rgba(7,20,45,.34),0 16px 32px -16px rgba(7,20,45,.16); }
    iframe { width:380px; height:660px; border:1px solid #e5e7ec; border-radius:16px; background:#fff; display:block; box-shadow:0 6px 18px rgba(11,18,32,.1); }
    .caption { margin-top:14px; text-align:center; font-size:12.5px; color:#5b6478; font-weight:500; }
  </style></head><body>
    <div class="left"><div class="brand-row"><span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span><span class="brand">Job Search Lens</span></div>
    <h1>Actual controls.<br><span class="hl">No setup maze.</span></h1><p class="lede">Save keywords, control Viewed / Saved / Applied dimming, and move through matches from one compact popup.</p>
    <div class="tags"><span class="tag y">Production UI</span><span class="tag">Chrome MV3</span><span class="tag">Local-only</span><span class="tag">LinkedIn-first</span></div></div>
    <div class="stage"><div><div class="frame"><iframe src="${baseUrl}/popup.html"></iframe></div><p class="caption">The production popup at its native 380 × 660 size</p></div></div>
  </body></html>`;
}

async function renderPopupComposite(browser, baseUrl, outputPath) {
  const context = await newContext(browser, { width: 1280, height: 800 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.setContent(popupComposite(baseUrl), { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: outputPath, scale: 'css' });
  await context.close();

  if (pageErrors.length) {
    throw pageErrors[0];
  }
}

async function main() {
  fs.mkdirSync(DOCS_STORE_DIR, { recursive: true });
  fs.mkdirSync(PACKAGE_STORE_DIR, { recursive: true });
  const { server, baseUrl } = await startStaticServer();
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    const targets = [
      ['docs/marketing/small-promo.html', 'small-promo-440x280.png', 440, 280],
      ['docs/marketing/marquee.html', 'marquee-1400x560.png', 1400, 560],
      ['docs/marketing/store-preview.html', 'store-preview-1280x800.png', 1280, 800],
    ];

    for (const [source, filename, width, height] of targets) {
      const outputPath = path.join(DOCS_STORE_DIR, filename);
      await screenshotPage(browser, { url: `${baseUrl}/${source}`, outputPath, width, height });
      console.log(`wrote docs/assets/store/${filename} (${width}x${height})`);
    }

    await screenshotPage(browser, {
      url: `${baseUrl}/popup.html`,
      outputPath: path.join(DOCS_STORE_DIR, 'popup-dark-preview.png'),
      width: 380,
      height: 660,
      colorScheme: 'dark',
    });
    await renderPopupComposite(browser, baseUrl, path.join(DOCS_STORE_DIR, 'popup-screenshot-1280x800.png'));
    await screenshotPage(browser, {
      url: `${baseUrl}/docs/marketing/og-image.html`,
      outputPath: path.join(DOCS_STORE_DIR, 'og-image-1200x630.png'),
      width: 1200,
      height: 630,
    });

    for (const filename of [
      'small-promo-440x280.png',
      'marquee-1400x560.png',
      'store-preview-1280x800.png',
      'popup-screenshot-1280x800.png',
      'og-image-1200x630.png',
    ]) {
      fs.copyFileSync(path.join(DOCS_STORE_DIR, filename), path.join(PACKAGE_STORE_DIR, filename));
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { startStaticServer, popupChromeMock, popupComposite };
