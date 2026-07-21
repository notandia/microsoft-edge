(function() {
  'use strict';

  if (window.MDPIFilterReferenceIdExtractor) {
    return; // Avoid re-injecting the script
  }

  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

  function normalizeReferenceId(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return SAFE_REFERENCE_ID.test(normalized) ? normalized : null;
  }

  /**
   * Extracts or generates an internal scroll ID for a reference item.
   * It also sets the 'data-mdpi-filter-ref-id' attribute on the item.
   * The returned 'extractedId' is the best guess for an ID that can be used
   * to link to inline citations.
   * @param {HTMLElement} itemElement - The DOM element representing the reference item.
   * @param {number} currentRefIdCounter - The current counter value for generating new IDs.
   * @returns {{extractedId: string, updatedRefIdCounter: number}} An object containing the extracted/generated ID and the updated counter.
   */
  function extractInternalScrollId(itemElement, currentRefIdCounter) {
    let idToUse = null;
    let idSourceForLog = "unknown";
    let nextRefIdCounter = currentRefIdCounter;

    // Priority 1: Frontiers-specific anchor name attribute (for <a name="B1" id="B1">)
    const frontiersAnchor = itemElement.querySelector('a[name][id]');
    if (frontiersAnchor && frontiersAnchor.name && frontiersAnchor.id) {
      idToUse = normalizeReferenceId(frontiersAnchor.name);
      idSourceForLog = "Frontiers anchor name attribute";
    }

    // Priority 2: Nature-specific ID from child <p class="c-article-references__text" id="ref-CR...">
    if (!idToUse) {
      const naturePElement = itemElement.querySelector('p.c-article-references__text[id^="ref-CR"]');
      if (naturePElement && naturePElement.id) {
        idToUse = normalizeReferenceId(naturePElement.id);
        idSourceForLog = "Nature child p.id";
      }
    }

    // Priority 3: Oxford University Press popup reference data-id
    if (!idToUse && itemElement.dataset && itemElement.dataset.id) {
      idToUse = normalizeReferenceId(itemElement.dataset.id);
      idSourceForLog = "item.dataset.id (OUP popup)";
    }

    // Priority 4: ScienceDirect specific ID from child <a id="ref-id-b...">
    if (!idToUse) {
      const sciDirectAnchor = itemElement.querySelector('span.label a.anchor[id^="ref-id-b"]');
      if (sciDirectAnchor && sciDirectAnchor.id) {
        idToUse = normalizeReferenceId(sciDirectAnchor.id);
        idSourceForLog = "ScienceDirect child a.anchor.id";
      }
    }

    // Priority 5: ScienceDirect specific ID from child <span class="reference" id^="rf...">
    if (!idToUse) {
      const sciDirectRefSpan = itemElement.querySelector('span.reference[id^="rf"]');
      if (sciDirectRefSpan && sciDirectRefSpan.id) {
        idToUse = normalizeReferenceId(sciDirectRefSpan.id);
        idSourceForLog = "ScienceDirect child span.reference.id";
      }
    }

    // Priority 5.5: BMJ specific ID from child <a class="rev-xref-ref" id="ref-...">
    if (!idToUse) {
      const bmjRevXrefAnchor = itemElement.querySelector('a.rev-xref-ref[id^="ref-"]');
      if (bmjRevXrefAnchor && bmjRevXrefAnchor.id) {
        idToUse = normalizeReferenceId(bmjRevXrefAnchor.id);
        idSourceForLog = "BMJ child a.rev-xref-ref.id";
      }
    }

    // Priority 6: Standard item.id attribute
    if (!idToUse && itemElement.id) {
      idToUse = normalizeReferenceId(itemElement.id);
      idSourceForLog = "item.id";
    }

    // Priority 7: 'content-id' attribute (common in OUP - academic.oup.com)
    if (!idToUse) {
      const oupContentId = itemElement.getAttribute('content-id');
      if (oupContentId) {
        idToUse = normalizeReferenceId(oupContentId);
        idSourceForLog = "attribute 'content-id'";
      }
    }

    // Priority 8: 'data-legacy-id' attribute (common in OUP)
    if (!idToUse) {
      const oupLegacyId = itemElement.getAttribute('data-legacy-id');
      if (oupLegacyId) {
        idToUse = normalizeReferenceId(oupLegacyId);
        idSourceForLog = "attribute 'data-legacy-id'";
      }
    }

    // Priority 9: 'data-bib-id' attribute (common in Wiley)
    if (!idToUse && itemElement.dataset && itemElement.dataset.bibId) {
      idToUse = normalizeReferenceId(itemElement.dataset.bibId);
      idSourceForLog = "item.dataset.bibId";
    }

    // Priority 10: Existing internal ID
    if (!idToUse && itemElement.dataset.mdpiFilterRefId) {
      idToUse = normalizeReferenceId(itemElement.dataset.mdpiFilterRefId);
      idSourceForLog = "existing data-mdpi-filter-ref-id";
    }

    // Reject page-controlled values that cannot be safely interpolated into
    // selectors. Generate an extension-owned identifier instead.
    if (!idToUse) {
      idToUse = `mdpi-ref-${nextRefIdCounter++}`;
      itemElement.dataset.mdpiFilterRefId = idToUse;
      idSourceForLog = "generated mdpi-ref-X";
      console.log(`[MDPI Filter RefIdExtractor] Generated and set data-mdpi-filter-ref-id='${idToUse}' for:`, itemElement);
    } else {
      if (itemElement.dataset.mdpiFilterRefId !== idToUse) {
        itemElement.dataset.mdpiFilterRefId = idToUse;
        console.log(`[MDPI Filter RefIdExtractor] Adopted ID from ${idSourceForLog} ('${idToUse}') and set data-mdpi-filter-ref-id for:`, itemElement);
      } else if (idSourceForLog !== "generated mdpi-ref-X") {
        console.log(`[MDPI Filter RefIdExtractor] Using ID '${idToUse}' (source: ${idSourceForLog}). data-mdpi-filter-ref-id confirmed. Item:`, itemElement);
      }
    }

    return {
      extractedId: idToUse,
      updatedRefIdCounter: nextRefIdCounter
    };
  }

  window.MDPIFilterReferenceIdExtractor = {
    extractInternalScrollId,
    normalizeReferenceId
  };
})();
