# Authenticated Web App Validation Suite

Reusable test names and expected outcomes for auditing applications that sign in, explore protected pages, run background work, and save/export results. Replace SauceDemo with the target application's approved test environment and disposable accounts. Do not use real customer accounts or execute purchases/destructive actions as test data.

## Test naming

Use `<group>-<number>: <behavior>` in test plans, bug reports and execution logs. A test passes only when its expected outcome is asserted. Starting a job or receiving a successful HTTP response is not enough.

| ID | Test name | Scenario and expected outcome | Best layer |
| --- | --- | --- | --- |
| AUTH-01 | Incomplete sign-in rejection | Confirm with a visible login form. Protected content must not be marked authenticated or audited. | Browser integration |
| AUTH-02 | Rejected-account recovery | Try a locked-out/invalid test account, then a valid account in the same window. Reject the first and accept only after the application is visibly ready. | Live end-to-end |
| AUTH-03 | Valid sign-in to completed report | Use the real dashboard to open sign-in, log in, confirm, choose scope and run. A nonempty report must carry the correct target, account mode, viewport and running build. | Live end-to-end |
| AUTH-04 | Login changes application origin | Authentication returns to another domain/subdomain. Explicit application selection must update the scan origin and retain the session. | Browser integration |
| AUTH-05 | Application opens in another tab | Login page remains open or closes while the app opens elsewhere. Select the correct live application; reject stale selections. | Browser integration |
| AUTH-06 | Verification challenge remains open | Attempt confirmation with an OTP/MFA/verification screen visible. Confirmation must remain blocked. | Browser integration |
| AUTH-07 | Logout after confirmation | Confirm login, then log out before starting the scan. Protected pages remain unverified and the UI requests sign-in; no false broken links or success claim. | Live end-to-end |
| AUTH-08 | Headless authentication handoff | Confirm sign-in; assert the login browser closes, the replacement is headless, and cookies, localStorage, sessionStorage and IndexedDB still authorize protected destinations. | Browser integration + live |
| AUTH-09 | Repeated confirmation and logout after handoff | Confirm twice concurrently, then clear the tab token/log out. Create one connection and never restore removed authentication on later navigation. | Browser integration + live |
| AUTH-10 | Non-transferable authentication | A page is signed in using memory-only state that cannot be restored. Reject connection clearly, retain the original sign-in window for retry, and never label protected links broken. | Browser integration |
| RESULT-01 | Unknown results do not become failures | Mix working, broken and unverified observations. Success rate uses only working and confirmed broken outcomes; display unknown count and verification coverage separately. | Browser integration |
| RESULT-02 | Empty denominator and independent findings | All-unverified/empty results show no percentage. Name/review findings do not reduce destination success. Dashboard and exported HTML/PDF share the calculation. | Browser integration + export |
| LINK-01 | Authenticated browser-state preservation | Destinations depend on cookies, localStorage, sessionStorage or JS bearer tokens. Valid destinations stay usable in verification; secret state is not exported. | Browser integration |
| LINK-02 | HTTP response versus rendered application | A non-2xx document renders a usable app. Inspect its content while preserving response evidence; do not infer broken navigation from the status alone. | Browser integration + live |
| LINK-03 | Genuine missing destination | Navigate to a known missing page. Record the actual browser error evidence and distinguish it from login/access/timeout uncertainty. | Browser integration |
| LINK-04 | Login redirect and access restrictions | A destination redirects to login or returns access/rate-limit responses. Mark uncertainty; do not assert a universally broken link. | Browser integration |
| LINK-05 | Scripted navigation verification | A product/control uses # or script navigation. Activate supported navigation in a separate authenticated page and assert the actual resulting route/content. | Browser integration + live |
| LINK-06 | Empty-fragment non-navigation | A bare # changes the URL but opens no destination. It must not count as verified navigation. | Browser integration |
| LINK-07 | Side-effect and redirect exclusion | Tested action labels/URLs and redirect chains leading to logout/delete must be blocked before reaching the action. | Browser integration with request log |
| LINK-08 | Link semantics and accessible names | Hidden text must not create a false accessible name. Passive bookmarks are not broken links; scripted controls remain visible with an honest outcome. | Browser integration + accessibility |
| LINK-09 | Fragment validity changes with page state | A disclosure adds/removes a fragment target. Preserve before/after outcomes instead of deduplicating the changed evidence. | Browser integration |
| DISC-01 | Discover actual scripted destinations | Compare discovered pages with browser-reachable product routes. Supported routes should be enumerated; unsupported routes require explicit coverage limits. | Live end-to-end |
| DISC-02 | Whole-site entry from a deep authenticated page | Start on /account with no outgoing links. Automatically discover the root, sibling sections, nested scripted menu routes, and mobile-only routes using the same login; no endpoint-prefix restriction. | Browser integration + live |
| DISC-03 | Nested disclosure with a bare fragment | Open a menu and nested submenu that add # to the URL. Continue exploration and replay the disclosure path when verifying scripted destinations. | Browser integration + live |
| VIEW-05 | Viewport result filtering | Combine Desktop/Mobile with status, page and search filters; reset all filters and check narrow-screen overflow. | Browser integration |
| NAV-02 | Logo returns home | Click the brand from a saved report or history; show the starting homepage and preserve stored history. | Browser integration |
| NEW-01 | Fresh new audit after report or cancellation | Open New audit from a previous report, cancel an entered draft, and start again. URL, session, discovery and selections start fresh. | Browser integration |
| DISC-04 | Linked media is not an application page | A product links to a full-size image. Verify its resource response; exclude it from the page crawl and page coverage denominator. | Browser integration + live |
| RESULT-03 | URL label versus finding category | A page is named /broken but only has a link-name issue. Show an explicit page label and separate category counts; the chart drill-down matches its confirmed-issue count. | Browser integration |
| LINK-11 | Direct error URL versus discovered destination | Enter a known 404/410/500/503 URL directly, then reach it from another origin. Both paths preserve explicit failure evidence; error-page recovery links cannot create a passing audit. | Browser integration + live |
| RESULT-04 | Failed audited URL in all report surfaces | Failed page checks have an Audited URL finding, agree with the Broken links count and success rate, retain viewport identity, and remain visible in page coverage and exported reports. | Browser integration + live |
| LINK-10 | Explicit server error versus access uncertainty | Browser returns HTTP 500 with an explicit error page. Record a failure at scan time; keep login, access-block, article and usable-app variants unverified. | Browser integration + live |
| PERF-01 | Slow destination does not block the next batch | Keep bounded concurrency while a slow destination is pending; later fast destinations begin without waiting for that slow response. Preserve every result. | Browser integration |
| SCOPE-01 | Current-page scope | Select current page. Assert exactly that page was scanned; discovery count is not scan count. | End-to-end |
| SCOPE-02 | Selected-page subset | Discover pages, select a strict subset and run. Assert that the final report contains exactly that subset. | End-to-end |
| SCOPE-03 | All-discovered-pages scope | Discover N pages, choose all, run and assert N actual scanned pages. The UI radio selection alone is insufficient. | Live end-to-end |
| VIEW-01 | Desktop-only run | Only the selected desktop viewport is scanned and reported. | End-to-end |
| VIEW-02 | Mobile-only run | Initialize a fresh page at mobile dimensions; verify mobile-only links and mobile-only result metadata. | End-to-end |
| VIEW-03 | Combined independent viewport run | Both viewports are scanned from appropriate initial state; desktop interactions must not leak into mobile initial state. | Browser integration + end-to-end |
| VIEW-04 | Empty viewport selection and Back | Reject no selection; preserve valid choices when moving backward/forward; use the correct coverage denominator. | End-to-end |
| REC-01 | Refresh during active work | Refresh after job start. Reconnect to the same job and save a single report. | Resilience/end-to-end |
| REC-02 | Brief polling connection loss | Drop consecutive status requests. Recover without restarting completed work or losing its result. | Resilience/end-to-end |
| REC-03 | Cancel before start acknowledgment | Delay start confirmation and cancel. No late response may revive the job or report. | Resilience/end-to-end |
| REC-04 | Session expiry after scope selection | Expire the session before running. Offer reconnect and preserve target/selection where applicable. | End-to-end |
| REC-05 | Cancel whole-site discovery before a report exists | Start authenticated discovery and cancel after the server acknowledges it. The job and headless session close, no report is saved, and a subsequent new audit starts blank. | Live end-to-end |
| DATA-01 | Storage quota failure at completion | Reject report storage writes. Keep the result exportable and display a persistent unsaved warning. | Resilience/end-to-end |
| DATA-02 | Multiple-tab history updates | Complete separate audits in different tabs. Preserve both records without overwriting unrelated history. Exact simultaneous-write stress is a separate variant. | End-to-end |
| HIST-01 | Delete one report and cancel deletion | Cancel leaves history unchanged; confirmation removes exactly the chosen report. | End-to-end |
| HIST-02 | Clear listed history | Confirmation removes the listed reports; cancellation and write failure preserve them; exported files remain unaffected. | End-to-end |
| HIST-03 | Deleted reports do not return | Delete in one tab, then complete a new scan in another. Removed history must not be merged back. | End-to-end |
| NAV-01 | Return from history to Home | Breadcrumb, history-page Home and empty-history Home return to the intended overview without losing unrelated stored data. | End-to-end |
| EXP-01 | Report export parity | Download HTML, PDF, CSV and JSON. Verify that scope, observations and outcomes agree with the saved report; HTML filters remain functional offline. | End-to-end |
| UI-01 | Responsive and accessible dashboard | Check keyboard/dialog semantics, automated accessibility findings and narrow-screen overflow on the app/report. This is not a conformance certification. | Accessibility + browser |
| REL-01 | Running build identity | Report and displayed UI carry the same running build ID. Compare the real deployed process, not only source files or a ZIP. | Runtime integration |
| REL-02 | Update files while server is running | Existing server keeps its matching frontend snapshot and refuses new audits until restarted. It must not mix new UI with old scanner code. | Runtime integration |
| REL-03 | Stale tab after restart | A tab carrying the old build ID is told to refresh before continuing. | Runtime integration |
| REL-04 | Old report remains identifiable | Historical reports without the current build identity are marked for re-audit rather than silently presented as new results. | UI/end-to-end |

## Applying the suite to another app

1. Identify its real user journey, session mechanisms, allowed test accounts, and side-effect boundaries.
2. Select the relevant cases. Keep unneeded cases out of the execution count.
3. Define positive and negative oracles before running: a known working destination, a known missing destination, a real login screen, an intentional access restriction, and a known page inventory/subset.
4. Run deterministic local tests for failures that are hard to create safely on a live site. Then run the actual user-facing login-to-result workflow against an approved test environment.
5. Record the build ID, account type (not credentials), selected scope, exact actual pages, viewports, outcomes, evidence paths and any deviations.
6. Classify findings using the unexpected-user-scenarios skill: **observed failure**, **confirmed gap**, or **candidate gap**. Do not call an unexecuted case passed, and do not count “zero broken” as proof of successful destination verification.
7. Retest fixes on the deployed process and refresh the real client. Verify the full selected scope; do not rely only on a successful job status.

## Execution record template

| Field | Record |
| --- | --- |
| Test ID/name | Stable catalog entry |
| Build/environment | Running ID, browser, test URL |
| User intent/start state | Account type, session and prior steps |
| Variation | Interruption, state change or unusual input |
| Steps/data | Minimal reproducible sequence; no secrets |
| Expected invariant | Observable pass/fail oracle |
| Observed result | Actual values and status; “not run” if unexecuted |
| Evidence | Screenshot, structured result, request log or test name |
| Status | Passed, observed failure, confirmed gap, candidate gap, blocked |
| Priority | Impact, plausibility and rationale |
| Regression layer | Lowest reliable automated layer |

The catalog is reusable. Its presence alone is not evidence every case passed on an arbitrary application. Use the application-specific execution report for actual results and remaining blind spots.

## LENS design system (1.3.0)

LENS-01 through LENS-07 are the reusable home, theme, fresh-audit, mobile workflow, evidence report, filtering/navigation and user-preference checks in [DESIGN-VALIDATION.md](DESIGN-VALIDATION.md). Execute `npm run test:design`; this is also part of the thirteen-suite `test:all` run. All browser validation runs headlessly.

## Evidence-based result separation (1.3.1)

RESULT-04 through RESULT-07 cover evidence classification, large interactive-control groups, per-URL access summaries, reason/viewport filtering, and HTML/JSON/CSV parity. See [RESULT-SEPARATION.md](RESULT-SEPARATION.md) for live SauceDemo evidence and full count accounting. `test:all` now runs thirteen suites.
