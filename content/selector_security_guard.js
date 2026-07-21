// Prevent page-controlled reference identifiers from becoming CSS selectors.
(function() {
  'use strict';

  if (!window.MDPIFilterUtils ||
      typeof window.MDPIFilterUtils.generateInlineFootnoteSelectors !== 'function') {
    return;
  }

  const originalGenerator = window.MDPIFilterUtils.generateInlineFootnoteSelectors;

  window.MDPIFilterUtils.generateInlineFootnoteSelectors = function(referenceId) {
    const normalizer = window.MDPIFilterReferenceIdExtractor &&
      window.MDPIFilterReferenceIdExtractor.normalizeReferenceId;

    const safeReferenceId = typeof normalizer === 'function'
      ? normalizer(referenceId)
      : (typeof referenceId === 'string' &&
         /^[A-Za-z0-9_.:-]{1,128}$/.test(referenceId.trim())
          ? referenceId.trim()
          : null);

    if (!safeReferenceId) return '';
    return originalGenerator(safeReferenceId);
  };
})();
