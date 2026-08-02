const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const shared = require('../shared.js');

const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function eventChannel() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
}

function createHarness({ optionalAccess = false } = {}) {
  const data = {};
  const calls = {
    contextMenuCreates: [],
    registeredScripts: [],
    unregisteredScripts: [],
    insertedCss: [],
    executedScripts: [],
  };
  const events = {
    installed: eventChannel(),
    startup: eventChannel(),
    message: eventChannel(),
    permissionAdded: eventChannel(),
    permissionRemoved: eventChannel(),
    contextClicked: eventChannel(),
  };
  let registered = [];

  const chrome = {
    runtime: {
      lastError: null,
      onInstalled: events.installed,
      onStartup: events.startup,
      onMessage: events.message,
    },
    permissions: {
      onAdded: events.permissionAdded,
      onRemoved: events.permissionRemoved,
      contains: async () => optionalAccess,
    },
    contextMenus: {
      create: (options, callback) => {
        calls.contextMenuCreates.push(options);
        callback?.();
      },
      onClicked: events.contextClicked,
    },
    storage: {
      local: {
        get: async () => structuredClone(data),
        set: async (values) => Object.assign(data, structuredClone(values)),
      },
    },
    scripting: {
      getRegisteredContentScripts: async () => registered,
      registerContentScripts: async (scripts) => {
        registered = scripts;
        calls.registeredScripts.push(...scripts);
      },
      unregisterContentScripts: async (options) => {
        registered = [];
        calls.unregisteredScripts.push(options);
      },
      insertCSS: async (options) => calls.insertedCss.push(options),
      executeScript: async (options) => calls.executedScripts.push(options),
    },
    tabs: {
      sendMessage: async () => {
        throw new Error('No helper');
      },
    },
  };

  vm.runInNewContext(backgroundSource, {
    chrome,
    importScripts() {},
    self: { JobHuntVisualizerShared: shared },
    URL,
  }, { filename: 'background.js' });

  return { chrome, calls, data, events };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('background creates the selection menu and stores a selected keyword locally', async () => {
  const harness = createHarness();
  await flush();

  assert.equal(harness.calls.contextMenuCreates.length, 1);
  assert.equal(harness.calls.contextMenuCreates[0].contexts[0], 'selection');

  await harness.events.contextClicked.listeners[0]({
    menuItemId: 'job-hunt-visualizer-add-keyword',
    pageUrl: 'https://example.com/jobs',
    selectionText: '  TypeScript  ',
  });

  assert.equal(harness.data.keywords.length, 1);
  assert.equal(harness.data.keywords[0].term, 'TypeScript');
});

test('background registers the optional all-site helper only after access is granted', async () => {
  const harness = createHarness({ optionalAccess: true });
  await flush();

  assert.equal(harness.calls.registeredScripts.length, 1);
  assert.deepEqual(
    [...harness.calls.registeredScripts[0].matches],
    ['http://*/*', 'https://*/*'],
  );
  assert.deepEqual(
    [...harness.calls.registeredScripts[0].excludeMatches],
    ['https://www.linkedin.com/*'],
  );
  assert.equal(harness.calls.registeredScripts[0].persistAcrossSessions, true);
});
