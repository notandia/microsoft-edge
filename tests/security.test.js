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
  context.window = context.window || {};
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
  return context;
}

test('reference identifiers reject selector metacharacters and excessive length', () => {
  const context = loadScript('content/reference_id_extractor.js');
  const normalize = context.window.MDPIFilterReferenceIdExtractor.normalizeReferenceId;

  assert.equal(normalize('ref-CR12'), 'ref-CR12');
  assert.equal(normalize('  B1:section.2  '), 'B1:section.2');
  assert.equal(normalize('bad"] * { display:none }'), null);
  assert.equal(normalize('x'.repeat(129)), null);
});

test('selector guard blocks unsafe identifiers before selector construction', () => {
  let generatedWith = null;
  const window = {
    MDPIFilterUtils: {
      generateInlineFootnoteSelectors(value) {
        generatedWith = value;
        return `a[href="#${value}"]`;
      }
    },
    MDPIFilterReferenceIdExtractor: {
      normalizeReferenceId(value) {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return /^[A-Za-z0-9_.:-]{1,128}$/.test(trimmed) ? trimmed : null;
      }
    }
  };

  loadScript('content/selector_security_guard.js', { window });

  assert.equal(window.MDPIFilterUtils.generateInlineFootnoteSelectors('CR12'), 'a[href="#CR12"]');
  assert.equal(generatedWith, 'CR12');
  generatedWith = null;
  assert.equal(window.MDPIFilterUtils.generateInlineFootnoteSelectors('x"] div'), '');
  assert.equal(generatedWith, null);
});

test('popup reporting removes query strings and fragments', () => {
  const document = { addEventListener() {} };
  const context = loadScript('popup_security_guard.js', { document });
  const safeUrl = context.window.MDPIFilterPopupSecurity.toPrivacySafeUrl(
    'https://example.org/private/article?token=secret&query=mdpi#results'
  );

  assert.equal(safeUrl, 'https://example.org/private/article');
  assert.equal(context.window.MDPIFilterPopupSecurity.isSafeReferenceId('ref-1'), true);
  assert.equal(context.window.MDPIFilterPopupSecurity.isSafeReferenceId('ref"]'), false);
});

test('sanitizer fails closed for old builds and strips all markup for supported builds', () => {
  let outdatedCalls = 0;
  const outdatedPurifier = {
    version: '3.2.6',
    sanitize() {
      outdatedCalls += 1;
      return 'unsafe';
    }
  };
  const outdatedWindow = { DOMPurify: outdatedPurifier };
  loadScript('content/sanitizer.js', {
    window: outdatedWindow,
    DOMPurify: outdatedPurifier
  });

  assert.equal(outdatedWindow.sanitize('<img src=x onerror=alert(1)>'), '');
  assert.equal(outdatedCalls, 0);

  let receivedConfig = null;
  const supportedPurifier = {
    version: '3.4.12',
    sanitize(input, config) {
      receivedConfig = config;
      return input.replace(/<[^>]+>/g, '');
    }
  };
  const supportedWindow = { DOMPurify: supportedPurifier };
  loadScript('content/sanitizer.js', {
    window: supportedWindow,
    DOMPurify: supportedPurifier
  });

  assert.equal(supportedWindow.sanitize('<b>Reference</b>'), 'Reference');
  assert.deepEqual(receivedConfig, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  assert.equal(
    supportedWindow.MDPIFilterSanitizerSecurity.isSupportedVersion('3.5.0'),
    true
  );
});

test('NCBI lookups validate, deduplicate, and enforce the per-page budget', async () => {
  const requestedUrls = [];
  const fetch = async url => {
    requestedUrls.push(String(url));
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

  const ids = Array.from({ length: 800 }, (_, index) => String(index + 1));
  await handler.checkNcbiIdsForMdpi(ids, 'pmid', runCache, persistentCache);

  assert.equal(requestedUrls.length, 3, '600 allowed IDs should produce three 200-ID batches');
  const queriedIds = requestedUrls.flatMap(rawUrl => {
    const parsed = new URL(rawUrl);
    return parsed.searchParams.get('ids').split(',');
  });
  assert.equal(queriedIds.length, 600);
  assert.equal(new Set(queriedIds).size, 600);

  await handler.checkNcbiIdsForMdpi(
    Array.from({ length: 100 }, (_, index) => String(index + 901)),
    'pmid',
    runCache,
    persistentCache
  );
  assert.equal(requestedUrls.length, 3, 'no additional request is allowed after the page budget is exhausted');
});

test('release workflow pins actions and does not embed NCBI secrets', () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github/workflows/build-extension.yml'),
    'utf8'
  );

  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+/);
  assert.doesNotMatch(workflow, /NCBI_(TOOL_NAME|API_EMAIL)_SECRET/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /DOMPurify 3\.4\.12/);
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.match(workflow, /manifest\.version_name = process\.env\.RELEASE_VERSION/);
});
