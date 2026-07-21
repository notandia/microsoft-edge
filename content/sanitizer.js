// content/sanitizer.js

(function initializeSanitizer() {
  'use strict';

  const MINIMUM_DOMPURIFY_VERSION = [3, 4, 12];

  function parseVersion(version) {
    if (typeof version !== 'string') return null;
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : null;
  }

  function isSupportedVersion(version) {
    const parsed = parseVersion(version);
    if (!parsed) return false;

    for (let index = 0; index < MINIMUM_DOMPURIFY_VERSION.length; index += 1) {
      if (parsed[index] > MINIMUM_DOMPURIFY_VERSION[index]) return true;
      if (parsed[index] < MINIMUM_DOMPURIFY_VERSION[index]) return false;
    }
    return true;
  }

  const purifier = window.DOMPurify ||
    (typeof DOMPurify !== 'undefined' ? DOMPurify : null);

  if (!purifier || typeof purifier.sanitize !== 'function' ||
      !isSupportedVersion(purifier.version)) {
    console.error(
      '[MDPI Filter] Refusing to sanitize with a missing or outdated DOMPurify build. ' +
      'Run npm ci --ignore-scripts && npm run build before loading the extension.'
    );
    // Fail closed: reference preview text is omitted instead of passing
    // untrusted content through an unsupported sanitizer.
    window.sanitize = () => '';
    return;
  }

  window.sanitize = htmlInput => {
    if (typeof htmlInput !== 'string') return '';

    // This extension only needs plain reference preview text. Explicitly deny
    // all markup and attributes even though current callers use textContent.
    return purifier.sanitize(htmlInput, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  };

  window.MDPIFilterSanitizerSecurity = {
    isSupportedVersion
  };
})();
