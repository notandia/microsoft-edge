'use strict';

const tabData = new Map();
const MAX_REFERENCES_PER_TAB = 500;
const MAX_REFERENCE_TEXT_LENGTH = 1000;
const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;
const SAFE_COLOR = /^#[0-9A-F]{6}$/i;

function normalizeReference(reference) {
  if (!reference || typeof reference !== 'object') return null;
  if (typeof reference.id !== 'string' || !SAFE_REFERENCE_ID.test(reference.id)) return null;
  if (typeof reference.text !== 'string') return null;

  const normalized = {
    id: reference.id,
    text: reference.text.slice(0, MAX_REFERENCE_TEXT_LENGTH)
  };
  if (Number.isFinite(reference.number)) normalized.number = reference.number;
  if (typeof reference.doi === 'string') normalized.doi = reference.doi.slice(0, 256);
  if (typeof reference.listItemDomId === 'string' && SAFE_REFERENCE_ID.test(reference.listItemDomId)) {
    normalized.listItemDomId = reference.listItemDomId;
  }
  return normalized;
}

function normalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  const unique = new Map();
  for (const reference of references.slice(0, MAX_REFERENCES_PER_TAB)) {
    const normalized = normalizeReference(reference);
    if (!normalized) continue;
    const key = `${normalized.id}\u0000${normalized.text}`;
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return Array.from(unique.values());
}

function setBadge(tabId, count, color = '#E2211C') {
  if (!Number.isInteger(tabId)) return;
  const numericCount = Number.isFinite(count) ? Math.max(0, Math.min(999, Math.trunc(count))) : 0;
  const safeColor = typeof color === 'string' && SAFE_COLOR.test(color) ? color : '#E2211C';
  chrome.action.setBadgeText({ tabId, text: numericCount ? String(numericCount) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: safeColor });
}

function clearTabData(tabId) {
  tabData.delete(tabId);
  setBadge(tabId, 0);
}

function storeTabReferences(tabId, references, requestedCount, color) {
  if (!Number.isInteger(tabId)) return [];
  const normalized = normalizeReferences(references);
  tabData.set(tabId, normalized);
  const count = Number.isFinite(requestedCount) ? requestedCount : normalized.length;
  setBadge(tabId, count, color);
  return normalized;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;

  if (message.type === 'mdpiUpdate') {
    const tabId = sender.tab?.id;
    const data = message.data || {};
    const references = Array.isArray(data.references) ? data.references : [];
    const count = Number.isFinite(data.badgeCount) ? data.badgeCount : references.length;
    storeTabReferences(tabId, references, count, data.color);
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.action === 'updateBadge') {
    const tabId = sender.tab?.id;
    if (Number.isInteger(tabId)) setBadge(tabId, Number(message.count), message.color);
    sendResponse({ success: Number.isInteger(tabId) });
    return false;
  }

  if (message.action === 'updateReferences') {
    const tabId = sender.tab?.id;
    if (Number.isInteger(tabId)) {
      const normalized = storeTabReferences(tabId, message.references, message.references?.length, message.color);
      sendResponse({ success: true, count: normalized.length });
    } else {
      sendResponse({ success: false });
    }
    return false;
  }

  if (message.type === 'getMdpiReferences') {
    getActiveTab()
      .then(tab => sendResponse({ references: Number.isInteger(tab?.id) ? (tabData.get(tab.id) || []) : [] }))
      .catch(() => sendResponse({ references: [] }));
    return true;
  }

  if (message.type === 'scrollToRef') {
    if (typeof message.refId !== 'string' || !SAFE_REFERENCE_ID.test(message.refId)) {
      sendResponse({ success: false, error: 'invalid-reference-id' });
      return false;
    }

    getActiveTab()
      .then(tab => {
        if (!Number.isInteger(tab?.id)) {
          sendResponse({ success: false, error: 'no-active-tab' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, {
          type: 'scrollToRefOnPage',
          refId: message.refId
        }, response => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: 'content-script-unavailable' });
          } else {
            const status = response?.status;
            sendResponse({ success: status === 'scrolled' || status === 'expanded-and-scrolled' });
          }
        });
      })
      .catch(() => sendResponse({ success: false, error: 'tab-query-failed' }));
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') clearTabData(tabId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabData.delete(tabId);
});
