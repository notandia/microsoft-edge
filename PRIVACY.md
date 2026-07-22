# Privacy policy

Last updated: 22 July 2026

MDPI Filter is designed to identify MDPI-related content and, when research-integrity lookups are enabled, check scholarly DOI identifiers for formal post-publication updates.

## Data processed locally

The extension may inspect the current webpage to find:

- DOI identifiers for the current scholarly work;
- DOI identifiers and short citation text in a visible bibliography;
- MDPI-related links and references needed for its existing detection features.

This processing occurs inside the browser. Article text, bibliography text, search queries, and the complete address or browsing history are not sent to the research-integrity provider.

## Data sent for integrity lookups

When **Check DOI integrity status with Crossref** is enabled, the extension sends normalized DOI identifiers to the Crossref REST API solely to retrieve scholarly metadata and post-publication update relationships, including retractions, expressions of concern, corrections, reinstatements, withdrawals/removals, and related notices.

Requests:

- omit cookies and other credentials;
- use a no-referrer policy;
- do not include the webpage address, article text, citation text, account identifiers, or analytics identifiers;
- are limited and rate-spaced to respect Crossref's public service.

Crossref operates independently and its own privacy terms apply to requests it receives.

## Storage

The extension stores user settings in browser synchronization storage. Lookup responses are cached only in the extension service worker's memory and may disappear when the worker stops. The extension does not create an analytics profile or persistent browsing-history database.

## User control

Integrity lookups can be disabled at any time from the extension popup. Disabling them stops new DOI requests. Existing MDPI detection continues to work, subject to its separate NCBI lookup preference.

## Coverage and limitations

The extension may limit the number of DOI checks on pages with very large bibliographies and reports deferred or unresolved identifiers instead of treating them as clear. A message that no known signal was found means only that none was found in the checked sources.

## Logging

Diagnostic logging is disabled by default. When enabled by the user, logs remain in the browser's developer console unless the user manually copies or submits them.

## Reports and support

Issue reports are submitted only when the user chooses to open GitHub. The prefilled report omits query strings and URL fragments, but users should remove any information they do not want to publish before submitting.

Security reports should follow `SECURITY.md`. Privacy questions and correction requests may be opened in the repository issue tracker without including sensitive personal information.

## Changes

Material changes to data collection, recipients, or purposes will be documented here and in release notes before the corresponding extension update is published.