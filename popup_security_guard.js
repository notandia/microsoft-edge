// Security controls for page-derived data handled by the popup.
(function() {
  'use strict';

  function toPrivacySafeUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch (error) {
      return '[unavailable]';
    }
  }

  function isSafeReferenceId(value) {
    return typeof value === 'string' &&
      /^[A-Za-z0-9_.:-]{1,128}$/.test(value.trim());
  }

  window.MDPIFilterPopupSecurity = {
    toPrivacySafeUrl,
    isSafeReferenceId
  };

  document.addEventListener('DOMContentLoaded', () => {
    const reportBtn = document.getElementById('reportIssue');
    const referencesList = document.getElementById('referencesList');
    const status = document.getElementById('status');

    if (referencesList) {
      referencesList.addEventListener('click', event => {
        const clickedLi = event.target.closest('li[data-ref-id]');
        if (clickedLi && !isSafeReferenceId(clickedLi.dataset.refId)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (status) {
            status.textContent = 'Could not open an invalid reference identifier.';
            setTimeout(() => { status.textContent = ''; }, 3000);
          }
        }
      }, true);
    }

    if (!reportBtn) return;

    reportBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs.length || !tabs[0].url) {
          if (status) {
            status.textContent = 'Could not get current tab URL.';
            setTimeout(() => { status.textContent = ''; }, 3000);
          }
          return;
        }

        const reportedUrl = toPrivacySafeUrl(tabs[0].url);
        const githubRepo = 'mdpi-filter/mdpi-filter-microsoft-edge';
        const currentMode =
          document.querySelector('input[name="mode"]:checked')?.value || 'N/A';
        const manifest = chrome.runtime.getManifest();

        const issueTitle = encodeURIComponent(`Filter issue on: ${reportedUrl}`);
        const issueBody = encodeURIComponent(
`**Report a filter issue**

Report filter issues with specific websites to the ${githubRepo} issue tracker. Requires a GitHub account.

Before submitting, please search for an existing report:
https://github.com/${githubRepo}/issues

*Privacy note: the query string and fragment were removed before this page address was sent to GitHub.*

---

**Address of the webpage:**

${reportedUrl}

**Describe the filter issue:**

[Was an MDPI result missed, or was a non-MDPI result incorrectly flagged?]

---
**Troubleshooting information:**

* **Extension name:** ${manifest.name}
* **Extension version:** ${manifest.version}
* **Current filter mode:** ${currentMode}
* **Browser:** ${navigator.userAgent}
* **Operating system:** [Please fill in]

**Screenshots or additional context:**

[Optional]
`);

        chrome.tabs.create({
          url: `https://github.com/${githubRepo}/issues/new?title=${issueTitle}&body=${issueBody}`
        });
      });
    }, true);
  });
})();
