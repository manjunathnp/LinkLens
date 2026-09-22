# LinkLens Validation

LinkLens 1.3.1 is supported by automated browser suites and a captured product workflow through the actual LinkLens interface.

## Tech Book Store capture

| Field | Recorded value |
| --- | --- |
| Capture date | September 22, 2026 |
| LinkLens version | 1.3.1 |
| Build ID | `cf9d646c1c50` |
| Source | `http://127.0.0.1:3000/techbookstore-shop.html` |
| Access | Public |
| Scope | Current page |
| Viewports | Desktop Web App and Mobile Web App |
| Pages | 1 page in each selected viewport |
| Observations | 122 |
| Unique destinations | 40 |
| Verified working | 110 |
| Confirmed broken | 0 |
| Access and response details | 12 sign-in-required checks |
| Verified destination success | 100% |
| Duration | 40.418 seconds |

The capture was driven through the LinkLens UI in a headless browser. The saved audit was read from browser storage after LinkLens reported completion. No counters, findings, evidence, or report markup were changed.

## Evidence

- [Capture provenance](demo/capture-provenance.json)
- [Unchanged scan result](demo/capture-result.json)
- [Interactive standalone demo](demo/index.html)
- [Self-contained exported report](demo/tech-book-store-report.html)
- [Desktop and mobile screenshots](demo/screenshots/)

## Automated suites

`LINKLENSE_TEST_HEADLESS=1 npm run test:all` runs thirteen suites covering:

- core scanning and report exports;
- authentication confirmation, browser-state transfer, and recovery;
- desktop, mobile, and combined viewport behavior;
- rendered error pages and direct 404/410/5xx evidence;
- authenticated destinations and scripted application navigation;
- whole-site discovery from deep routes and the origin home page;
- scan-history deletion, clearing, synchronization, and home navigation;
- result grouping, reason filters, success-rate accounting, and export parity;
- responsive layout, themes, keyboard interaction, and axe-core interface checks;
- running-build identity, stale tabs, and restart handling;
- headless browser enforcement and destination scheduling.

Stable test names, user scenarios, expected outcomes, and recommended validation layers are available in [TEST-CATALOG.md](../TEST-CATALOG.md).

## Result interpretation

The Tech Book Store run verified 110 occurrences successfully and recorded no confirmed failures. Twelve occurrences required sign-in at the destination and are presented as access and response details. They remain visible in the link inventory and report without contributing to either the working or broken count. This produces a 100% success rate across the 110 verified outcomes and preserves all 122 observations for review.

Coverage notes retain blocked analytics POST requests, the bookstore assistant control, and broader custom-interaction opportunities as context for focused journeys. These notes are available beside the automated results and do not change the verified destination percentage.
