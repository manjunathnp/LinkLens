# Evidence-based result separation — LinkLens 1.3.1

The report no longer presents every observation without a destination verdict as one large “Unverified” category.

## What the report shows

- **Verified working:** the existing recorded evidence establishes a working destination or fragment. Separate naming or usability findings can still apply.
- **Confirmed broken:** a recorded failure, such as a confirmed HTTP error, invalid URL or missing same-document fragment.
- **Access & response details:** recorded access, browser, response or scan constraints. Each row shows its specific reason and next action. Reason filters include sign-in, access restriction, rate limits, timeouts, browser errors, session restoration, scan limits and conflicting response evidence.
- **Interactive controls & app actions:** scripted controls with no established destination, external-app links, skipped downloads or potential state-changing actions. These appear in an expandable scope section. They are grouped by interaction type; the recorded check details remain available. Destination success uses verified web outcomes, while action behavior is a separate test scope.

Confirmed link and naming issues appear first by default. All observations are retained and available through All links, group filters, reason filters, page coverage and exports. The Access & response headline counts distinct recorded destination URLs. Its sublabel shows all corresponding observations across pages and viewports. Working/broken headlines count observations, with their unit written beneath the number. Clicking a URL-group summary opens all matching observations; failures and viewport evidence are preserved.

The destination success-rate calculation is preserved: working / (working + broken). Limited checks and actions without an established destination remain outside that rate, and the full verification-coverage denominator stays visible. No finding is converted to a pass to meet a presentation target. Scanner and authentication code are unchanged in this release.

## Reusable validation

- **RESULT-04 — Evidence classification:** nineteen cases, including true failures, access denial, rate limits, timeouts versus network errors, scripted controls with naming defects, downloads, email links, legacy unknowns and conflicting rendered/HTTP evidence.
- **RESULT-05 — Large action group separation:** a deterministic test with 64 observations verifies 1 working, 1 broken, 2 check limitations and 60 action observations; the success rate remains 50%, with 2/64 verified coverage. This is a test fixture, not a live-client result.
- **RESULT-06 — Reason filters:** grouped totals conserve all observations; reason filters intersect with viewport filters; both themes reflow on mobile and pass the configured axe checks.
- **RESULT-07 — Export parity:** standalone HTML filters and JSON/CSV exports preserve the same groups, reasons and next steps. The integration suite also checks PDF generation.

Run `node tests/verification-separation.mjs` after the integration fixture has generated `test-output/report.json`, or run `npm run test:all` for all thirteen suites. All browser checks are headless.

## Live SauceDemo result

Signed in with SauceDemo’s published standard_user demo account, then discovered and scanned the entire reachable site headlessly (Desktop). All 11 discovered pages were checked, including inventory, cart, six product routes and three dynamic catalog routes. No guarded action responses were observed.

| Recorded evidence | Count |
| --- | ---: |
| Total observations | 199 |
| Verified-working observations | 86 |
| Confirmed broken observations | 0 |
| Access/response observations | 31 |
| Distinct URLs behind those 31 observations | 3 |
| Interactive control observations | 82 |

The former combined unverified count was 113: 82 scripted controls plus 31 responses across X, Facebook and LinkedIn destinations. Those 31 responses were 11 access restrictions and 20 sign-in requirements. The report now presents **3 URLs** under Access & response details, exposes their **31 recorded checks**, and retains **82 controls** in the separate interactive-control section. This is a category separation and per-URL aggregation, not 110 additional successful verifications.

Verified destination success remains 100% (86/86); overall verification coverage remains 86/199 observations. These results describe this account and scan time, not every possible application state or external-site visit.

Live scan and full thirteen-suite regression build: `b099d3c8a73d`. Subsequent changes affect wording and the per-URL summary only. Focused scoring, layout, classification, filtering and export checks verify the final presentation; its build ID is recorded in `RELEASE-MANIFEST.json` and `test-output/separation/results.json`.
