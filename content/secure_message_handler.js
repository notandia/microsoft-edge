'use strict';

(() => {
  const SAFE_REFERENCE_ID = /^[A-Za-z0-9_.:-]{1,256}$/;

  function findReferenceElement(referenceId) {
    for (const element of document.querySelectorAll('[data-mdpi-filter-ref-id]')) {
      if (element.getAttribute('data-mdpi-filter-ref-id') === referenceId) return element;
    }
    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    if (message.type !== 'scrollToRefOnPage') return false;

    if (typeof message.refId !== 'string' || !SAFE_REFERENCE_ID.test(message.refId)) {
      sendResponse({ status: 'invalid-reference-id' });
      return false;
    }

    const reference = findReferenceElement(message.refId);
    if (!reference) {
      sendResponse({ status: 'not-found' });
      return false;
    }

    const collapsedControl = reference.closest('div.article-accordion')
      ?.querySelector('.accordion__control[aria-expanded="false"]');
    if (collapsedControl instanceof HTMLElement) collapsedControl.click();

    reference.scrollIntoView({ behavior: 'smooth', block: 'center' });
    reference.classList.add('mdpi-ref-scroll-highlight');
    setTimeout(() => reference.classList.remove('mdpi-ref-scroll-highlight'), 1500);
    sendResponse({ status: collapsedControl ? 'expanded-and-scrolled' : 'scrolled' });
    return false;
  });
})();
