'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadScript(relativePath, additions = {}) {
  const context = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    AbortController,
    Map,
    Set,
    ...additions
  };
  context.window ||= {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), context, {
    filename: relativePath
  });
  return context;
}

test('reference identifiers reject selector metacharacters and excessive length', () => {
  const context = loadScript('content/reference_id_extractor.js');
  const normalize = context.window.MDPIFilterReferenceIdExtractor.normalizeReferenceId;

  assert.equal(normalize('ref-CR12'), 'ref-CR12');
  assert.equal(normalize('  B1:section.2  '), 'B1:section.2');
  assert.equal(normalize('bad"] * { display:none }'), null);
  assert.equal(normalize('x'.repeat(257)), null);
});

test('inline selector construction rejects unsafe page identifiers', () => {
  const window = {
    MDPIFilterReferenceIdExtractor: {
      normalizeReferenceId(value) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim();
        return /^[A-Za-z0-9_.:-]{1,256}$/.test(normalized) ? normalized : null;
      }
    }
  };
  const document = {
    getElementById() { return null; },
    querySelectorAll() { return []; }
  };
  loadScript('content/inline_footnote_selectors.js', { window, document });

  const generate = window.MDPIFilterUtils.generateInlineFootnoteSelectors;
  assert.match(generate('CR12'), /href="#CR12"/);
  assert.equal(generate('x"] div'), '');
});

test('sanitizer preserves only plain string values', () => {
  const window = {};
  loadScript('content/sanitizer.js', { window });
  assert.equal(window.sanitize('<b>Reference</b>'), '<b>Reference</b>');
  assert.equal(window.sanitize({ text: 'Reference' }), '');
});

test('NCBI lookups validate, deduplicate, omit credentials, and enforce page budget', async () => {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      async json() { return { records: [] }; }
    };
  };

  const window = { MDPIFilterSettings: { ncbiApiEnabled: true } };
  loadScript('content/ncbi_api_handler.js', { window, fetch });
  const handler = window.MDPIFilterNcbiApiHandler;
  const runCache = new Map();
  const persistentCache = new Map();

  assert.deepEqual(
    Array.from(handler.normalizeIdsForQuery(['123', '123', 'bad', '456'], 'pmid')),
    ['123', '456']
  );
  assert.deepEqual(
    Array.from(handler.normalizeIdsForQuery(['10.1000/OK', '10.1000/bad,split'], 'doi')),
    ['10.1000/ok']
  );

  await handler.checkNcbiIdsForMdpi(
    Array.from({ length: 800 }, (_, index) => String(index + 1)),
    'pmid',
    runCache,
    persistentCache
  );

  assert.equal(requests.length, 3);
  const queriedIds = requests.flatMap(request => new URL(request.url).searchParams.get('ids').split(','));
  assert.equal(queriedIds.length, 600);
  assert.equal(new Set(queriedIds).size, 600);
  for (const request of requests) {
    const parsed = new URL(request.url);
    assert.equal(parsed.searchParams.get('tool'), 'mdpi-filter');
    assert.equal(parsed.searchParams.has('email'), false);
    assert.equal(request.options.credentials, 'omit');
    assert.equal(request.options.referrerPolicy, 'no-referrer');
  }

  await handler.checkNcbiIdsForMdpi(['901', '902'], 'pmid', runCache, persistentCache);
  assert.equal(requests.length, 3);
});

test('manifest and package maintain the converged least-privilege contract', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(fs.existsSync(path.join(ROOT, 'content', 'dompurify.min.js')), false);
  assert.equal(Object.keys(packageJson.dependencies || {}).length, 0);
  assert.ok(manifest.content_scripts[0].js.includes('content/secure_message_handler.js'));
});

test('workflows pin actions and do not embed NCBI secrets', () => {
  const workflowDirectory = path.join(ROOT, '.github', 'workflows');
  for (const filename of fs.readdirSync(workflowDirectory).filter(name => /\.ya?ml$/i.test(name))) {
    const workflow = fs.readFileSync(path.join(workflowDirectory, filename), 'utf8');
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
      assert.match(match[1], /@[0-9a-f]{40}$/i, `${filename}: ${match[1]}`);
    }
    assert.doesNotMatch(workflow, /NCBI_(?:TOOL_NAME|API_EMAIL)_SECRET/);
  }
});
