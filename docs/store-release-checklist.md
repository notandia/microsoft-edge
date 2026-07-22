# Microsoft Edge Add-ons release checklist

The `0.1.0` research-integrity preview must not be submitted until every item is evidenced.

## Package and provenance

- [ ] Use the ZIP produced by the successful GitHub Actions run for the release commit.
- [ ] Record the commit SHA, workflow run, artifact checksum, manifest version, and package size.
- [ ] Verify ZIP integrity and confirm there are no untracked/generated runtime files.
- [ ] Retain the previous store package and rollback instructions.

## Privacy disclosure

- [ ] Publish `PRIVACY.md` at a stable public URL.
- [ ] Update the Microsoft Edge Add-ons privacy declarations to disclose DOI identifiers/website content used for the user-requested integrity feature.
- [ ] State that DOI identifiers are sent to Crossref solely for scholarly metadata/status lookup.
- [ ] State that page/article text, full URLs, search queries, browsing history, account identifiers, and analytics identifiers are not sent.
- [ ] Confirm the declared purpose is single-purpose functionality, not advertising, profiling, or sale.
- [ ] Verify the store listing and privacy policy use identical descriptions.

## Runtime evidence

- [ ] Inspect browser network traffic on retraction, concern, correction, reinstatement, duplicate-publication, clean, unresolved, and more-than-50-DOI fixtures.
- [ ] Confirm every Crossref request contains only the DOI in the endpoint and sends no cookies or referrer.
- [ ] Confirm request starts remain at or below four per second.
- [ ] Confirm disabling integrity lookups causes zero Crossref requests.
- [ ] Confirm deferred, unresolved, and failed counts are displayed and never labeled safe/clear.
- [ ] Confirm toolbar badge counts affected works once, not notices.
- [ ] Confirm existing MDPI detection still works when no integrity signal is present.

## Accessibility and presentation

- [ ] Verify each status has icon, text, and color; color is not the sole signal.
- [ ] Verify keyboard navigation, focus visibility, screen-reader labels, light mode, and dark mode.
- [ ] Capture store screenshots showing counters, event chronology/provenance, coverage, and the privacy toggle.
- [ ] Update release notes with limitations and data-source attribution.

## Rollout

- [ ] Publish to a small staged percentage first.
- [ ] Monitor only Edge Add-ons aggregate diagnostics; do not add product analytics.
- [ ] Expand only after checking error reports and false-positive reports.
- [ ] Stop or roll back if privacy behavior, request load, or status classification differs from the validated artifact.
