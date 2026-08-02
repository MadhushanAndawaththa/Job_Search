const fs = require('node:fs');
const path = require('node:path');
const { zipSync, unzipSync } = require('fflate');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const FIXED_MTIME = new Date('2026-01-01T00:00:00Z');

const PACKAGE_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'dom-heuristics.js',
  'shared.js',
  'popup.html',
  'popup.js',
  'theme-init.js',
  'styles.css',
  'LICENSE',
  'assets/icons/icon128.png',
  'assets/icons/icon16.png',
  'assets/icons/icon32.png',
  'assets/icons/icon48.png',
];

function collectPackageFiles(root = ROOT) {
  const entries = {};

  for (const relativePath of PACKAGE_FILES) {
    const absolutePath = path.join(root, ...relativePath.split('/'));

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`Missing package file: ${relativePath}`);
    }

    entries[relativePath] = [fs.readFileSync(absolutePath), { mtime: FIXED_MTIME }];
  }

  return entries;
}

function buildExtensionZip({ root = ROOT, outputDirectory = DIST_DIR } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const outputPath = path.join(outputDirectory, `job-search-lens-v${manifest.version}.zip`);
  const archive = zipSync(collectPackageFiles(root), { level: 9 });
  const unpacked = unzipSync(archive);

  for (const relativePath of PACKAGE_FILES) {
    if (!unpacked[relativePath]) {
      throw new Error(`Archive validation failed: ${relativePath} is missing`);
    }
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(outputPath, archive);

  return {
    outputPath,
    bytes: archive.length,
    files: Object.keys(unpacked).length,
  };
}

if (require.main === module) {
  const result = buildExtensionZip();
  console.log(`wrote ${path.relative(ROOT, result.outputPath)} (${result.bytes} bytes, ${result.files} files)`);
}

module.exports = {
  PACKAGE_FILES,
  collectPackageFiles,
  buildExtensionZip,
};
