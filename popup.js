'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const radios = Array.from(document.querySelectorAll('input[name="mode"]'));
  const saveBtn = document.getElementById('save');
  const status = document.getElementById('status');
  const reportBtn = document.getElementById('reportIssue');
  const referencesList = document.getElementById('referencesList');
  const referencesPlaceholder = document.getElementById('referencesPlaceholder');
  const referencesCountSpan = document.getElementById('referencesCount');
  const settingsIcon = document.getElementById('settingsIcon');
  const settingsPanel = document.getElementById('settingsPanel');
  const highlightPotentialCheckbox = document.getElementById('highlightPotentialMdpi');
  const potentialColorInput = document.getElementById('potentialMdpiColor');
  const loggingEnabledCheckbox = document.getElementById('loggingEnabled');
  const ncbiApiCheckbox = document.getElementById('ncbiApiEnabledPopup');

  const setStatus = (message, timeoutMs = 3500) => {
    status.textContent = message;
    if (timeoutMs > 0) setTimeout(() => { status.textContent = ''; }, timeoutMs);
  };

  settingsIcon.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
  });

  document.addEventListener('mousedown', event => {
    if (settingsPanel.classList.contains('open') &&
        !settingsPanel.contains(event.target) &&
        !settingsIcon.contains(event.target)) {
      settingsPanel.classList.remove('open');
    }
  });

  chrome.storage.sync.get({
    mode: 'highlight',
    highlightPotentialMdpiSites: false,
    potentialMdpiHighlightColor: '#FFFF99',
    loggingEnabled: false,
    ncbiApiEnabled: true
  }, settings => {
    if (chrome.runtime.lastError) {
      setStatus('Error loading settings.');
      return;
    }
    radios.forEach(radio => { radio.checked = radio.value === settings.mode; });
    highlightPotentialCheckbox.checked = Boolean(settings.highlightPotentialMdpiSites);
    potentialColorInput.value = settings.potentialMdpiHighlightColor || '#FFFF99';
    loggingEnabledCheckbox.checked = Boolean(settings.loggingEnabled);
    ncbiApiCheckbox.checked = settings.ncbiApiEnabled !== false;
  });

  saveBtn.addEventListener('click', () => {
    const selectedMode = radios.find(radio => radio.checked)?.value || 'highlight';
    const ncbiEnabled = ncbiApiCheckbox.checked;
    if (!ncbiEnabled && !confirm('Disabling NCBI API lookups reduces detection accuracy. Continue?')) {
      return;
    }

    chrome.storage.sync.set({
      mode: selectedMode,
      highlightPotentialMdpiSites: highlightPotentialCheckbox.checked,
      potentialMdpiHighlightColor: potentialColorInput.value || '#FFFF99',
      loggingEnabled: loggingEnabledCheckbox.checked,
      ncbiApiEnabled: ncbiEnabled
    }, () => {
      if (chrome.runtime.lastError) {
        setStatus('Error saving settings.');
      } else {
        setStatus('Settings saved.');
      }
    });
  });

  reportBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const activeUrl = tabs[0]?.url;
      if (!activeUrl) {
        setStatus('Could not read the current page address.');
        return;
      }

      let reportedAddress;
      try {
        const parsed = new URL(activeUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Unsupported page protocol');
        }
        reportedAddress = `${parsed.origin}${parsed.pathname}`;
      } catch {
        setStatus('Issue reports are available only for web pages.');
        return;
      }

      const repository = 'mdpi-filter/mdpi-filter-microsoft-edge';
      const manifest = chrome.runtime.getManifest();
      const currentMode = radios.find(radio => radio.checked)?.value || 'N/A';
      const title = encodeURIComponent(`Filter issue on ${new URL(reportedAddress).hostname}`);
      const body = encodeURIComponent(`**Report a filter issue**

Before submitting, please remove any information you do not want to publish publicly.

**Webpage address (query parameters and fragments omitted):**
${reportedAddress}

**Describe the filter issue:**
[Was an MDPI result missed, or was a non-MDPI result incorrectly flagged?]

---
**Troubleshooting information:**
- Extension: ${manifest.name}
- Version: ${manifest.version}
- Filter mode: ${currentMode}
- Browser: ${navigator.userAgent}

**Screenshots or additional context:**
[Optional]
`);

      chrome.tabs.create({
        url: `https://github.com/${repository}/issues/new?title=${title}&body=${body}`
      });
    });
  });

  function displayReferences(references, isLoading = false, errorMessage = '') {
    referencesList.querySelectorAll('li:not(#referencesPlaceholder)').forEach(item => item.remove());

    if (isLoading) {
      referencesCountSpan.textContent = 'Loading';
      referencesPlaceholder.textContent = 'Loading references...';
      referencesPlaceholder.classList.remove('error');
      referencesPlaceholder.style.display = 'block';
      return;
    }

    if (errorMessage) {
      referencesCountSpan.textContent = 'No';
      referencesPlaceholder.textContent = errorMessage;
      referencesPlaceholder.classList.add('error');
      referencesPlaceholder.style.display = 'block';
      return;
    }

    const unique = new Map();
    for (const ref of Array.isArray(references) ? references : []) {
      if (!ref || typeof ref !== 'object' || typeof ref.id !== 'string' || typeof ref.text !== 'string') continue;
      const key = (ref.doi || ref.text).replace(/\s+/g, ' ').trim().toLowerCase();
      if (key && !unique.has(key)) unique.set(key, ref);
    }

    const validReferences = Array.from(unique.values());
    referencesCountSpan.textContent = validReferences.length ? String(validReferences.length) : 'No';
    referencesPlaceholder.classList.remove('error');

    if (!validReferences.length) {
      referencesPlaceholder.textContent = 'No MDPI references detected on this page.';
      referencesPlaceholder.style.display = 'block';
      return;
    }

    referencesPlaceholder.style.display = 'none';
    for (const ref of validReferences) {
      const item = document.createElement('li');
      item.dataset.refId = ref.id;
      item.title = 'Click to scroll to reference';

      if (ref.number) {
        const number = document.createElement('span');
        number.className = 'ref-number';
        number.textContent = `${String(ref.number)}. `;
        item.appendChild(number);
      }

      const text = document.createElement('span');
      text.className = 'ref-text';
      text.textContent = ref.text;
      item.appendChild(text);
      referencesList.appendChild(item);
    }
  }

  referencesList.addEventListener('click', event => {
    const item = event.target.closest('li[data-ref-id]');
    if (!item) return;

    chrome.runtime.sendMessage({ type: 'scrollToRef', refId: item.dataset.refId }, response => {
      if (chrome.runtime.lastError || !response?.success) {
        setStatus('Could not locate that reference on the page.');
      }
    });
  });

  function loadReferences(attempt = 0, requestedRefresh = false) {
    if (attempt === 0) displayReferences([], true);

    chrome.runtime.sendMessage({ type: 'getMdpiReferences' }, response => {
      if (chrome.runtime.lastError) {
        displayReferences([], false, 'Error loading references.');
        return;
      }

      const references = Array.isArray(response?.references) ? response.references : [];
      if (references.length) {
        displayReferences(references);
        return;
      }

      if (attempt < 3) {
        setTimeout(() => loadReferences(attempt + 1, requestedRefresh), 300);
        return;
      }

      if (!requestedRefresh) {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          const tabId = tabs[0]?.id;
          if (!tabId) {
            displayReferences([]);
            return;
          }
          chrome.tabs.sendMessage(tabId, { type: 'forceResendMdpiReferences' }, () => {
            void chrome.runtime.lastError;
            setTimeout(() => loadReferences(0, true), 350);
          });
        });
        return;
      }

      displayReferences([]);
    });
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.action === 'updateReferences' && Array.isArray(message.references)) {
      displayReferences(message.references);
    }
  });

  loadReferences();
});
