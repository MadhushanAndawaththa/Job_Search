const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
const sharedSource = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(ROOT, 'popup.js'), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPopupHarness() {
  const dom = new JSDOM(popupHtml, {
    url: 'https://extension.test/popup.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const storageListeners = [];
  const calls = {
    permissionRequests: 0,
    permissionRemovals: 0,
    runtimeMessages: [],
    tabMessages: [],
    clipboard: '',
  };
  const data = {
    keywords: [
      { id: 'javascript', term: 'JavaScript', normalized: 'javascript', color: '#FFE082', enabled: true },
      { id: 'remote', term: 'Remote', normalized: 'remote', color: '#90CAF9', enabled: true },
    ],
    settings: {
      paused: false,
      highlightAllSites: false,
      dimStates: { viewed: true, saved: true, applied: true },
    },
  };
  let optionalAccess = false;

  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text) => {
        calls.clipboard = text;
      },
    },
  });

  window.chrome = {
    storage: {
      local: {
        get: async () => clone(data),
        set: async (values) => {
          const changes = {};
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: clone(data[key]), newValue: clone(value) };
            data[key] = clone(value);
          }
          for (const listener of storageListeners) {
            listener(changes, 'local');
          }
        },
      },
      onChanged: {
        addListener: (listener) => storageListeners.push(listener),
      },
    },
    permissions: {
      contains: async () => optionalAccess,
      request: async () => {
        calls.permissionRequests += 1;
        optionalAccess = true;
        return true;
      },
      remove: async () => {
        calls.permissionRemovals += 1;
        optionalAccess = false;
        return true;
      },
    },
    runtime: {
      getManifest: () => ({ version: '1.3.1', version_name: '1.3.1' }),
      sendMessage: async (message) => {
        calls.runtimeMessages.push(clone(message));
        return { ok: true };
      },
    },
    tabs: {
      query: async () => [{ id: 7, url: 'https://www.linkedin.com/jobs/search/' }],
      sendMessage: async (_tabId, message) => {
        calls.tabMessages.push(clone(message));
        if (message.type.endsWith('navigate-match')) {
          return { ok: true, matchCount: 4, activeMatchIndex: 1 };
        }
        return {
          ok: true,
          isLinkedInPage: true,
          isJobsPage: true,
          hasListContainer: true,
          hasDetailContainer: true,
          hasFallbackRoot: true,
          keywordCount: data.keywords.length,
          stateCounts: { viewed: 2, saved: 1, applied: 1 },
          matchCount: 4,
          activeMatchIndex: 0,
          paused: data.settings.paused,
        };
      },
    },
  };

  window.eval(sharedSource);
  window.eval(popupSource);

  return { dom, window, data, calls };
}

async function waitFor(predicate, message = 'condition') {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for ${message}`);
}

test('popup initializes current version, keyword library, and LinkedIn diagnostics', async () => {
  const harness = createPopupHarness();
  try {
    await waitFor(() => harness.window.document.querySelectorAll('#keywordList > li').length === 2, 'keyword rows');
    assert.equal(harness.window.document.getElementById('popupVersion').textContent, 'v1.3.1');
    assert.equal(harness.window.document.querySelector('[data-testid="popup-footer-rate-link"]'), null);
    assert.match(harness.window.document.getElementById('pageStatus').textContent, /Ready on LinkedIn Jobs/i);
    assert.equal(harness.window.document.getElementById('stateCountSummary').textContent, '2 viewed · 1 saved · 1 applied');
  } finally {
    harness.dom.window.close();
  }
});

test('popup adds, disables, recolors, searches, exports, and removes keywords', async () => {
  const harness = createPopupHarness();
  const { document, Event, MouseEvent } = harness.window;
  try {
    await waitFor(() => document.querySelectorAll('#keywordList > li').length === 2);
    document.getElementById('keywordInput').value = 'TypeScript\nPython';
    document.getElementById('keywordForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => harness.data.keywords.length === 4, 'keyword add');

    document.querySelector('button[data-action="toggle-keyword"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => harness.data.keywords[0].enabled === false, 'keyword disable');

    document.querySelector('button[data-action="toggle-color-popover"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('button[data-action="select-keyword-color"][data-color="#FFCC80"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => harness.data.keywords[0].color === '#FFCC80', 'keyword color');

    document.getElementById('keywordSearchInput').value = 'python';
    document.getElementById('keywordSearchInput').dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(document.querySelectorAll('#keywordList > li').length, 1);
    assert.equal(document.querySelector('#keywordList .term').textContent, 'Python');

    document.getElementById('keywordSearchInput').value = '';
    document.getElementById('keywordSearchInput').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('exportKeywords').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => harness.calls.clipboard.includes('Python'), 'keyword export');

    document.querySelector('button[data-action="remove-keyword"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => harness.data.keywords.length === 3, 'keyword remove');
  } finally {
    harness.dom.window.close();
  }
});

test('popup persists pause and dim controls and requests optional all-site access', async () => {
  const harness = createPopupHarness();
  const { document, Event } = harness.window;
  try {
    await waitFor(() => document.querySelectorAll('#keywordList > li').length === 2);
    const pause = document.getElementById('pauseToggle');
    pause.checked = true;
    pause.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => harness.data.settings.paused === true, 'pause state');

    const saved = document.getElementById('dimSavedToggle');
    saved.checked = false;
    saved.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => harness.data.settings.dimStates.saved === false, 'saved dim state');

    const allSites = document.getElementById('highlightAllSitesToggle');
    allSites.checked = true;
    allSites.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => harness.data.settings.highlightAllSites === true, 'all-site state');
    assert.equal(harness.calls.permissionRequests, 1);
    assert.equal(harness.calls.runtimeMessages.at(-1).type, 'job-hunt-visualizer:sync-site-access');
  } finally {
    harness.dom.window.close();
  }
});

test('popup match navigation sends the command to the active content tab', async () => {
  const harness = createPopupHarness();
  const { document, MouseEvent } = harness.window;
  try {
    await waitFor(
      () => document.querySelectorAll('#keywordList > li').length === 2
        && /Ready on LinkedIn Jobs/i.test(document.getElementById('pageStatus').textContent),
      'popup initialization',
    );
    await waitFor(() => document.getElementById('nextMatch').disabled === false, 'enabled match navigation');
    document.getElementById('nextMatch').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(
      () => harness.calls.tabMessages.some((message) => message.type.endsWith('navigate-match')),
      'navigation message',
    );
    assert.equal(document.getElementById('matchStatus').textContent, '2 / 4 matches');
  } finally {
    harness.dom.window.close();
  }
});

test('popup copies privacy-safe page diagnostics without URLs or keyword values', async () => {
  const harness = createPopupHarness();
  const { document, MouseEvent } = harness.window;
  try {
    await waitFor(
      () => /Ready on LinkedIn Jobs/i.test(document.getElementById('pageStatus').textContent),
      'page diagnostics',
    );

    document.getElementById('copyDiagnostics').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(
      () => harness.calls.clipboard.includes('Job Search Lens')
        && document.getElementById('copyDiagnostics').textContent === 'Copied!',
      'diagnostics clipboard feedback',
    );

    const report = JSON.parse(harness.calls.clipboard);
    assert.equal(report.extensionVersion, '1.3.1');
    assert.equal(report.pageScope, 'linkedin');
    assert.equal(report.helperConnected, true);
    assert.deepEqual(report.surfaces, {
      jobList: true,
      jobDetails: true,
      fallback: true,
    });
    assert.deepEqual(report.counts, {
      keywords: 2,
      matches: 4,
      viewed: 2,
      saved: 1,
      applied: 1,
    });
    assert.doesNotMatch(harness.calls.clipboard, /linkedin\.com|JavaScript|Remote/);
    assert.equal(document.getElementById('copyDiagnostics').textContent, 'Copied!');
  } finally {
    harness.dom.window.close();
  }
});
