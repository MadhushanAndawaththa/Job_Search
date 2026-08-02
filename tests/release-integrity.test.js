const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { unzipSync } = require('fflate');

const { PACKAGE_FILES, buildExtensionZip } = require('../tools/build-extension-zip.js');

const ROOT = path.resolve(__dirname, '..');

test('manifest uses the minimal supported permission surface and synchronized version', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.version_name, packageJson.version);
  assert.deepEqual(manifest.permissions, ['contextMenus', 'storage', 'activeTab', 'scripting']);
  assert.deepEqual(manifest.host_permissions, ['https://www.linkedin.com/*']);
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
  assert.deepEqual(manifest.commands._execute_action.suggested_key, {
    default: 'Alt+Shift+J',
    mac: 'Alt+Shift+J',
  });
  assert.ok(manifest.description.length <= 132);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
});

test('all manifest references exist and extension pages contain no remote or inline scripts', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const referencedFiles = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css]),
  ];

  for (const relativePath of referencedFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing ${relativePath}`);
  }

  const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf8');
  const scriptTags = [...popupHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptTags.length > 0);

  for (const [, attributes, inlineCode] of scriptTags) {
    assert.match(attributes, /\bsrc="(?!https?:\/\/)[^"]+"/i);
    assert.equal(inlineCode.trim(), '');
  }

  for (const relativePath of PACKAGE_FILES.filter((file) => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /\bnew\s+Function\b/);
  }
});

test('release builder creates a valid archive containing only approved package files', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'job-search-lens-'));

  try {
    const result = buildExtensionZip({ outputDirectory: tempDirectory });
    const archive = unzipSync(fs.readFileSync(result.outputPath));
    assert.deepEqual(Object.keys(archive).sort(), [...PACKAGE_FILES].sort());
    assert.equal(result.files, PACKAGE_FILES.length);

    const archivedManifest = JSON.parse(Buffer.from(archive['manifest.json']).toString('utf8'));
    assert.equal(archivedManifest.version, '1.3.1');
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('store assets have exact required dimensions and mirrored copies match', () => {
  const expected = {
    'small-promo-440x280.png': [440, 280],
    'marquee-1400x560.png': [1400, 560],
    'store-preview-1280x800.png': [1280, 800],
    'popup-screenshot-1280x800.png': [1280, 800],
    'og-image-1200x630.png': [1200, 630],
  };

  for (const [filename, [width, height]] of Object.entries(expected)) {
    const packageAsset = fs.readFileSync(path.join(ROOT, 'assets', 'store', filename));
    const docsAsset = fs.readFileSync(path.join(ROOT, 'docs', 'assets', 'store', filename));
    assert.equal(packageAsset.readUInt32BE(16), width, `${filename} width`);
    assert.equal(packageAsset.readUInt32BE(20), height, `${filename} height`);
    assert.deepEqual(packageAsset, docsAsset, `${filename} copies drifted`);
  }
});

test('documentation pages have no broken local links or assets', () => {
  const docsDirectory = path.join(ROOT, 'docs');
  const htmlFiles = fs.readdirSync(docsDirectory, { recursive: true })
    .filter((entry) => entry.endsWith('.html'));

  for (const relativeHtmlPath of htmlFiles) {
    const htmlPath = path.join(docsDirectory, relativeHtmlPath);
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.doesNotMatch(
      html,
      /<(?:img|script|link)\b[^>]*(?:src|href)="https?:\/\//i,
      `${relativeHtmlPath} loads a remote page asset`,
    );

    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const reference = match[1];

      if (/^(?:https?:|mailto:|data:|#)/i.test(reference)) {
        continue;
      }

      const localReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      const resolvedPath = path.resolve(path.dirname(htmlPath), localReference);
      assert.ok(fs.existsSync(resolvedPath), `${relativeHtmlPath} has a broken reference: ${reference}`);
    }
  }
});

test('privacy and submission guidance disclose local website-content handling', () => {
  const privacyPolicy = fs.readFileSync(path.join(ROOT, 'docs', 'privacy-policy.html'), 'utf8');
  const runbook = fs.readFileSync(path.join(ROOT, 'docs', 'go-live.md'), 'utf8');

  assert.match(privacyPolicy, /Chrome Web Store Limited Use/);
  assert.match(privacyPolicy, /Website content(?: and active-tab information)? (?:is|are) processed transiently/);
  assert.match(privacyPolicy, /extension's own <code>localStorage<\/code>/);
  assert.doesNotMatch(privacyPolicy, /<strong>permissions<\/strong>/);
  assert.match(runbook, /Do \*\*not\*\* select "No user data is collected\."/);
  assert.match(runbook, /Select \*\*Website content\*\*/);
});
