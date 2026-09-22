# LinkLens Design Validation

LinkLens 1.3.1 applies the shared LENS visual language to link integrity: focused violet accents, Geist typography in the application, clear evidence surfaces, responsive layouts, and consistent light, dark, and system appearance.

## Interface coverage

| ID | Test | Recorded coverage |
| --- | --- | --- |
| LENS-01 | Responsive home and theme accessibility | Light and dark appearance at desktop, mobile portrait, and mobile landscape sizes; axe checks and document overflow |
| LENS-02 | Appearance preference lifecycle | Reload persistence, live operating-system changes in System mode, and cross-tab synchronization |
| LENS-03 | Fresh audit and URL handoff | URL validation, Enter submission, intentional URL carryover, blank New audit, and setup validation |
| LENS-04 | Mobile scan setup to completion | Mobile setup, scope, review, and a live current-page scan with both viewports |
| LENS-05 | Responsive evidence dashboard | Six theme and viewport combinations with axe and overflow checks |
| LENS-06 | Report navigation and filtering | Viewport filter, search, empty results, reset, evidence, page coverage, history, logo navigation, and recent reports |
| LENS-07 | User preferences | Enlarged text reflow, reduced motion, and keyboard skip-link behavior |

Run the focused design suite:

```bash
npm run test:design
```

It also runs as part of the complete thirteen-suite regression command:

```bash
LINKLENSE_TEST_HEADLESS=1 npm run test:all
```

## Standalone product demo

The product demo in `docs/demo/` uses actual LinkLens screenshots and supports:

- direct launch from `index.html` without a server;
- Arrow key, Home, and End navigation through walkthrough tabs;
- Previous and Next controls with an announced step count;
- full-size screenshot links;
- light and dark result comparison;
- desktop and mobile evidence;
- serious and critical WCAG 2 A/AA checks through axe-core;
- access to the self-contained exported report.

The local-reference check confirms every README image and every demo asset resolves within the repository. The screenshot-loading check exercises the full walkthrough and appearance comparison so all captured evidence is available from a standalone copy.

## LENS relationship

[A11yLens](https://github.com/manjunathnp/A11yLens), [LinkLens](https://github.com/manjunathnp/LinkLens), and [ImageLens](https://github.com/manjunathnp/ImageLens) share typography, navigation principles, evidence patterns, theme behavior, and responsive foundations. Each product keeps a presentation suited to its quality domain.
