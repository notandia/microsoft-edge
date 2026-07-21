// content/ncbi_api_handler.js

if (typeof window.MDPIFilterNcbiApiHandler === 'undefined') {
  const MDPI_DOMAINS = ['mdpi.com', 'mdpi.org'];
  const MDPI_DOI_PREFIX = '10.3390';

  // A hostile page can manufacture arbitrary reference-looking elements. Keep
  // cross-origin work and memory bounded for the lifetime of this page.
  const MAX_IDS_PER_PAGE = 600;
  const BATCH_SIZE = 200;
  const PAUSE_MS = 350;
  const REQUEST_TIMEOUT_MS = 10000;
  const MAX_CACHE_ENTRIES = 1000;

  const queriedIdsThisPage = new Set();
  let remainingLookupBudget = MAX_IDS_PER_PAGE;

  function normalizeIdsForQuery(ids, idType) {
    if (!Array.isArray(ids)) return [];

    const normalized = [];
    const seen = new Set();

    for (const rawId of ids) {
      if (rawId === null || typeof rawId === 'undefined') continue;

      let id = String(rawId).trim();
      if (!id) continue;

      if (idType === 'doi') {
        id = id.split('#')[0].split('?')[0].trim().toLowerCase();
        // Commas are excluded because NCBI uses them as the batch delimiter.
        if (!/^10\.\d{4,9}\/[^\s"',<>&]{1,240}$/.test(id)) continue;
      } else if (idType === 'pmid') {
        if (!/^\d{1,12}$/.test(id)) continue;
      } else if (idType === 'pmcid') {
        id = id.toUpperCase();
        if (!/^PMC\d{1,12}$/.test(id)) continue;
      } else {
        return [];
      }

      if (!seen.has(id)) {
        seen.add(id);
        normalized.push(id);
      }
    }

    return normalized;
  }

  function setBoundedCache(cache, key, value) {
    if (!(cache instanceof Map)) return;

    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);

    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function markBatchAsFalse(batchIds, runCache, ncbiApiCache, persist = true) {
    batchIds.forEach(id => {
      runCache.set(id, false);
      if (persist) setBoundedCache(ncbiApiCache, id, false);
    });
  }

  async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });

      if (!response.ok) {
        throw new Error(`NCBI API request failed with HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`NCBI API returned unexpected content type: ${contentType}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function checkNcbiIdsForMdpi(ids, idType, runCache, ncbiApiCache) {
    if (window.MDPIFilterSettings && window.MDPIFilterSettings.ncbiApiEnabled === false) {
      return false;
    }

    if (!(runCache instanceof Map) || !(ncbiApiCache instanceof Map)) {
      return false;
    }

    const normalizedIds = normalizeIdsForQuery(ids, idType);
    if (normalizedIds.length === 0) return false;

    const idsToQueryApi = [];

    for (const id of normalizedIds) {
      if (ncbiApiCache.has(id)) {
        runCache.set(id, ncbiApiCache.get(id));
        continue;
      }

      // Do not repeatedly query an identifier after a failed/empty lookup.
      if (queriedIdsThisPage.has(id)) {
        if (!runCache.has(id)) runCache.set(id, false);
        continue;
      }

      if (remainingLookupBudget <= 0) {
        runCache.set(id, false);
        continue;
      }

      queriedIdsThisPage.add(id);
      remainingLookupBudget -= 1;
      idsToQueryApi.push(id);
    }

    let overallFoundMdpiInBatches = normalizedIds.some(id => runCache.get(id) === true);

    for (let i = 0; i < idsToQueryApi.length; i += BATCH_SIZE) {
      const batchIds = idsToQueryApi.slice(i, i + BATCH_SIZE);
      const apiUrl = new URL('https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/');
      apiUrl.search = new URLSearchParams({
        ids: batchIds.join(','),
        idtype: idType,
        format: 'json',
        versions: 'no',
        tool: 'mdpi-filter-edge'
      }).toString();

      try {
        const data = await fetchJsonWithTimeout(apiUrl.toString());
        const processedInThisBatch = new Set();

        if (Array.isArray(data.records)) {
          for (const record of data.records) {
            if (!record || typeof record !== 'object') continue;

            const queriedId = batchIds.find(qid =>
              (record.pmid && qid === String(record.pmid)) ||
              (record.pmcid && qid === String(record.pmcid).toUpperCase()) ||
              (record.doi && qid === String(record.doi).toLowerCase()) ||
              (record.live && record.versions && record.versions[0] &&
                ((record.versions[0].pmid && qid === String(record.versions[0].pmid)) ||
                 (record.versions[0].pmcid && qid === String(record.versions[0].pmcid).toUpperCase()) ||
                 (record.versions[0].doi && qid === String(record.versions[0].doi).toLowerCase())))
            );

            if (!queriedId) continue;
            processedInThisBatch.add(queriedId);

            let isMdpi = false;
            const effectiveDoi = record.doi ||
              (record.versions && record.versions[0] ? record.versions[0].doi : null);

            if (effectiveDoi) {
              isMdpi = String(effectiveDoi).toLowerCase().startsWith(MDPI_DOI_PREFIX);
            } else if (typeof record.journal === 'string') {
              const journalHost = record.journal.toLowerCase();
              isMdpi = MDPI_DOMAINS.some(
                domain => journalHost === domain || journalHost.endsWith(`.${domain}`)
              );
            }

            runCache.set(queriedId, isMdpi);
            setBoundedCache(ncbiApiCache, queriedId, isMdpi);
            overallFoundMdpiInBatches ||= isMdpi;
          }
        }

        for (const id of batchIds) {
          if (!processedInThisBatch.has(id)) {
            runCache.set(id, false);
            setBoundedCache(ncbiApiCache, id, false);
          }
        }
      } catch (error) {
        // Fail closed for this page and avoid retry storms. Network failures are
        // not persisted in the long-lived cache so a page reload can retry.
        markBatchAsFalse(batchIds, runCache, ncbiApiCache, false);
        console.warn('[MDPI Filter] NCBI lookup failed:', error);
      }

      if (i + BATCH_SIZE < idsToQueryApi.length) {
        await new Promise(resolve => setTimeout(resolve, PAUSE_MS));
      }
    }

    return overallFoundMdpiInBatches ||
      normalizedIds.some(id => runCache.get(id) === true);
  }

  window.MDPIFilterNcbiApiHandler = {
    checkNcbiIdsForMdpi,
    // Exposed for focused regression tests; not a privileged interface.
    normalizeIdsForQuery
  };
}
