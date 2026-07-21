'use strict';

(() => {
  if (window.MDPIFilterNcbiApiHandler) return;

  const ENDPOINT = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/';
  const MDPI_DOI_PREFIX = '10.3390/';
  const TOOL_NAME = 'mdpi-filter';
  const BATCH_SIZE = 200;
  const MAX_IDS_PER_PAGE = 600;
  const MAX_CACHE_ENTRIES = 1000;
  const REQUEST_TIMEOUT_MS = 10000;

  const queriedIdsThisPage = new Set();
  let remainingLookupBudget = MAX_IDS_PER_PAGE;

  function normalizeId(id, idType) {
    if (typeof id !== 'string' && typeof id !== 'number') return null;
    let value = String(id).trim();
    if (!value) return null;

    if (idType === 'pmid') {
      return /^\d{1,12}$/.test(value) ? value : null;
    }
    if (idType === 'pmcid') {
      value = value.toUpperCase();
      return /^PMC\d{1,12}$/.test(value) ? value : null;
    }
    if (idType === 'doi') {
      value = value.split('#', 1)[0].split('?', 1)[0].trim().toLowerCase();
      return /^10\.\d{4,9}\/[^\s"',<>&]{1,240}$/.test(value) ? value : null;
    }
    return null;
  }

  function normalizeIdsForQuery(ids, idType) {
    if (!Array.isArray(ids)) return [];
    const unique = new Set();
    for (const rawId of ids) {
      const normalized = normalizeId(rawId, idType);
      if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
  }

  function candidateRecordIds(record) {
    const versions = Array.isArray(record?.versions) ? record.versions : [];
    const values = new Set();
    for (const candidate of [record, ...versions]) {
      if (!candidate || typeof candidate !== 'object') continue;
      if (candidate.pmid) values.add(String(candidate.pmid));
      if (candidate.pmcid) values.add(String(candidate.pmcid).toUpperCase());
      if (candidate.doi) values.add(String(candidate.doi).toLowerCase());
    }
    return values;
  }

  function recordIsMdpi(record) {
    const versions = Array.isArray(record?.versions) ? record.versions : [];
    return [record, ...versions].some(candidate => {
      const doi = typeof candidate?.doi === 'string' ? candidate.doi.toLowerCase() : '';
      return doi.startsWith(MDPI_DOI_PREFIX);
    });
  }

  function setBoundedCache(cache, key, value) {
    if (!(cache instanceof Map)) return;
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > MAX_CACHE_ENTRIES) {
      cache.delete(cache.keys().next().value);
    }
  }

  function writeResult(id, value, aliases, runCache, ncbiApiCache, persist) {
    const keys = new Set([id, ...(aliases.get(id) || [])]);
    for (const key of keys) {
      runCache.set(key, value);
      if (persist) setBoundedCache(ncbiApiCache, key, value);
    }
  }

  function createRequestUrl(batch, idType) {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({
      ids: batch.join(','),
      idtype: idType,
      format: 'json',
      versions: 'no',
      tool: TOOL_NAME
    }).toString();
    return url.toString();
  }

  async function fetchBatch(batch, idType) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(createRequestUrl(batch, idType), {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) return null;
      const data = await response.json();
      return Array.isArray(data?.records) ? data.records : [];
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function checkNcbiIdsForMdpi(ids, idType, runCache, ncbiApiCache) {
    if (window.MDPIFilterSettings?.ncbiApiEnabled === false) return false;
    if (!(runCache instanceof Map) || !(ncbiApiCache instanceof Map)) return false;
    if (!['pmid', 'pmcid', 'doi'].includes(idType) || !Array.isArray(ids)) return false;

    const aliases = new Map();
    for (const rawId of ids) {
      const normalized = normalizeId(rawId, idType);
      if (!normalized) continue;
      if (!aliases.has(normalized)) aliases.set(normalized, new Set());
      aliases.get(normalized).add(rawId);
      aliases.get(normalized).add(String(rawId).trim());
    }

    const normalizedIds = Array.from(aliases.keys());
    if (!normalizedIds.length) return false;

    const uncachedIds = [];
    for (const id of normalizedIds) {
      let cachedValue;
      let found = false;
      for (const candidate of [id, ...(aliases.get(id) || [])]) {
        if (ncbiApiCache.has(candidate)) {
          cachedValue = ncbiApiCache.get(candidate) === true;
          found = true;
          break;
        }
      }

      if (found) {
        writeResult(id, cachedValue, aliases, runCache, ncbiApiCache, true);
      } else if (queriedIdsThisPage.has(id) || remainingLookupBudget <= 0) {
        writeResult(id, false, aliases, runCache, ncbiApiCache, false);
      } else {
        queriedIdsThisPage.add(id);
        remainingLookupBudget -= 1;
        uncachedIds.push(id);
      }
    }

    for (let offset = 0; offset < uncachedIds.length; offset += BATCH_SIZE) {
      const batch = uncachedIds.slice(offset, offset + BATCH_SIZE);
      const records = await fetchBatch(batch, idType);

      if (records === null) {
        for (const id of batch) writeResult(id, false, aliases, runCache, ncbiApiCache, false);
        continue;
      }

      const results = new Map(batch.map(id => [id, false]));
      for (const record of records) {
        const isMdpi = recordIsMdpi(record);
        for (const candidateId of candidateRecordIds(record)) {
          if (results.has(candidateId)) results.set(candidateId, isMdpi);
        }
      }

      for (const [id, isMdpi] of results) {
        writeResult(id, isMdpi, aliases, runCache, ncbiApiCache, true);
      }
    }

    return normalizedIds.some(id => runCache.get(id) === true);
  }

  window.MDPIFilterNcbiApiHandler = {
    checkNcbiIdsForMdpi,
    normalizeIdsForQuery
  };
})();
