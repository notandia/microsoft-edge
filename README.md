# Notandia for Microsoft Edge — legacy repository

> **Development has moved to [`notandia/browser-extension`](https://github.com/notandia/browser-extension).**

This repository contains the historical Microsoft Edge-specific source previously released as **MDPI Filter**. The product is being rebranded in place as **Notandia** while preserving the existing Microsoft Edge Add-ons Product ID and extension identity so installed users continue to receive updates.

## Current status

- The canonical source for Chrome, Microsoft Edge, Firefox, and Safari is [`notandia/browser-extension`](https://github.com/notandia/browser-extension).
- Do not start new feature development or release tags in this repository.
- Do not create a replacement Edge store product.
- Do not change the existing Edge Product ID or CRX identity.
- Keep this repository available until the first Edge update built from the canonical repository has passed certification and its update behavior has been verified.

## Remaining migration sequence

1. Merge and validate the Notandia rebrand in `notandia/browser-extension`.
2. Build and inspect a GitHub-only release candidate.
3. Publish one stable Notandia update to the existing Microsoft Edge Add-ons product.
4. Confirm installation, automatic updates, permissions, listing links, privacy-policy links, and visible branding.
5. Close or supersede remaining implementation pull requests in this repository.
6. Archive this repository as read-only.

## Historical functionality

The legacy code identifies MDPI publications in supported search results and scholarly references. MDPI remains a functional detection category inside Notandia; it is no longer the product name.

## Independence

Notandia is an independent open-source project. It is not affiliated with, authorized by, or endorsed by MDPI AG, Microsoft, NCBI, browser vendors, or any publisher or data provider.

## Security

New reports should be filed against the canonical [`notandia/browser-extension`](https://github.com/notandia/browser-extension) repository. Sensitive vulnerabilities should use GitHub private vulnerability reporting rather than a public issue.

## License

- Code: AGPL-3.0
- Original logo assets: CC BY-SA 4.0 where stated
