# Privacy Policy for MDPI Filter Microsoft Edge Extension

**Last Updated:** July 21, 2026

MDPI Filter (the “Extension”) identifies MDPI publications in search results, bibliographies, inline citations, cited-by lists, and similar-article lists. Most processing occurs locally in the browser.

## 1. Information the Extension Handles

### User preferences

The Extension stores settings such as highlight or hide mode, potential-site highlighting, highlight color, diagnostic logging preference, and whether NCBI lookups are enabled. These settings are stored with `chrome.storage.sync`; Microsoft may synchronize them between Edge installations when Edge Sync is enabled.

### Website content

To identify publications, content scripts inspect text, links, citation identifiers, and the document structure of HTTPS pages you visit. This requires access to HTTPS websites because scholarly articles and references can appear on many different domains.

Page content is processed locally. The Extension does not send complete page content, browsing history, or reference text to its developer or to an analytics service.

### Publication identifiers

The Extension may extract Digital Object Identifiers (DOIs), PubMed IDs (PMIDs), and PubMed Central IDs (PMCIDs). Detection results are cached temporarily in memory to avoid repeated work. These caches are bounded, are not used for tracking, and are cleared when the relevant extension or page context ends.

## 2. External Communications

### NCBI ID Converter API

When NCBI lookups are enabled, the Extension sends only validated DOI, PMID, or PMCID values to the NCBI ID Converter endpoint at `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/`. Requests identify the application as `mdpi-filter`; they do not include a developer email address, browser cookies, or other browser credentials.

Requests use HTTPS and a no-referrer policy. NCBI receives the identifiers and the IP address required for normal network communication. Lookups are deduplicated, batched, rate-bounded per page, and stored only in bounded in-memory caches. NCBI lookups are enabled by default and can be disabled in the Extension’s advanced settings; disabling them may reduce detection accuracy.

Relevant NCBI and NLM policies:

- [NCBI policies](https://www.ncbi.nlm.nih.gov/home/about/policies/)
- [NLM privacy policy](https://www.nlm.nih.gov/privacy.html)

### User-initiated GitHub issue reports

Selecting **Report Filter Issue** opens a public GitHub issue form. The Extension pre-fills the page origin and path, but deliberately removes query parameters and fragments because those may contain search terms, document identifiers, session values, or access tokens. Browser, extension-version, and current filter-mode information is also pre-filled.

Nothing is submitted automatically. You can review, edit, or discard the report before posting it. Information you submit is handled under GitHub’s privacy terms and may become public.

### No analytics or commercial sharing

The Extension contains no advertising or analytics service. We do not sell or rent user data, and we do not share page content, browsing history, or preferences for advertising, profiling, or data-broker purposes.

## 3. Security Measures

- Manifest V3 and a self-only extension Content Security Policy are used.
- Remote executable code is not loaded.
- Page-derived reference text is handled as plain text and rendered with `textContent`, not as HTML.
- Messages and page-derived identifiers crossing extension contexts are validated and bounded.
- NCBI requests are validated, deduplicated, batched, time-limited, and made without browser credentials or a referrer.
- Runtime npm dependencies are not shipped.
- Release artifacts and GitHub Actions are verified during continuous integration.

No software can be guaranteed completely secure. Security reports should be submitted privately through the repository’s GitHub Security Advisory form.

## 4. Data Retention

- Preferences remain in `chrome.storage.sync` until changed, cleared, or the Extension is removed.
- Publication identifiers, reference previews, and detection results are held temporarily in bounded memory caches.
- Per-tab reference data is cleared when navigation begins or the tab is closed.
- The Extension does not maintain a persistent browsing-history database.
- The developer does not receive Extension telemetry.

## 5. User Choices

You can disable NCBI lookups, change filtering preferences, clear synchronized Extension data, disable the Extension for selected sites using Edge controls, or uninstall it at any time.

## 6. Changes and Contact

Material changes will be reflected here by updating the date above. Questions and non-sensitive reports may be submitted through the repository’s public issue tracker. Security vulnerabilities should be reported through the private security-advisory channel described in `SECURITY.md`.
