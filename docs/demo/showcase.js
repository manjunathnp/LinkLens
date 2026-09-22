const steps = [
  ['02-setup', 'ACCESS / TECH BOOK STORE', 'Start With the Real Entry Point.', 'Enter the page to inspect and choose public access or a browser sign-in journey. The captured run uses the Tech Book Store public storefront.', 'LinkLens setup screen with the Tech Book Store URL and public access selected.'],
  ['03-scope', 'SCOPE / CURRENT PAGE', 'Decide Where to Look.', 'Choose the current page, the entire discovered website, or a selected set. This capture keeps the storefront as its exact current-page scope.', 'LinkLens page-selection screen with Current page selected for the Tech Book Store storefront.'],
  ['05-overview', 'OVERVIEW / VERIFIED OUTCOMES', 'Read the Result Groups Together.', 'The overview shows 122 observations, 110 verified working outcomes, zero confirmed broken links and 12 sign-in-required checks in the separate access and response group.', 'Actual LinkLens Tech Book Store overview with result counts, success rate and access conditions.'],
  ['06-link-inventory', 'INVENTORY / EVERY OCCURRENCE', 'Find the Link Behind the Outcome.', 'Use result group, issue, page, viewport and search filters together. Every occurrence remains connected to its source page and evidence.', 'LinkLens link inventory with actual Tech Book Store observations and combined filters.'],
  ['07-destination-evidence', 'INSPECTOR / BROWSER EVIDENCE', 'Look Past the Status Label.', 'Inspect the source page, link name, viewport, response, redirect trail, final destination and recorded markup in one evidence view.', 'Actual LinkLens destination evidence from the Tech Book Store scan.'],
  ['08-coverage', 'COVERAGE / PAGE AND VIEWPORT', 'See What the Run Covered.', 'The page matrix records both selected viewports and keeps supported exploration plus useful follow-up opportunities visible beside the outcomes.', 'LinkLens page and viewport coverage for the Tech Book Store storefront scan.'],
  ['09-exports', 'EXPORT / FOUR FORMATS', 'Take the Evidence With You.', 'Export an interactive HTML report, a PDF, a CSV spreadsheet or the complete JSON result. The HTML report adds offline filters and a filtered CSV download.', 'Actual LinkLens export dialog offering HTML, PDF, CSV and JSON formats.'],
  ['12-html-report', 'HTML REPORT / CAPTURED DATA', 'Make the Report Part of the Review.', 'Use outcome, issue type, page, viewport and text filters together. Expand evidence and export the visible selection as CSV.', 'Self-contained LinkLens HTML report generated from the Tech Book Store scan.']
];

const tabs = [...document.querySelectorAll('[data-step]')];
let active = 0;

function select(index, focus = false) {
  active = Math.max(0, Math.min(steps.length - 1, index));
  const [file, tag, title, description, alt] = steps[active];
  const src = `screenshots/${file}.png`;
  tabs.forEach((button, item) => {
    button.setAttribute('aria-selected', String(item === active));
    button.tabIndex = item === active ? 0 : -1;
  });
  document.querySelector('#tour-panel').setAttribute('aria-labelledby', `step-${active}`);
  document.querySelector('#tour-tag').textContent = tag;
  document.querySelector('#tour-title').textContent = title;
  document.querySelector('#tour-description').textContent = description;
  const image = document.querySelector('#tour-image');
  image.src = src;
  image.alt = alt;
  document.querySelector('#tour-full').href = src;
  document.querySelector('#tour-image-link').href = src;
  document.querySelector('#tour-count').textContent = `Step ${active + 1} of ${steps.length}`;
  document.querySelector('#previous').disabled = active === 0;
  document.querySelector('#next').disabled = active === steps.length - 1;
  if (focus) {
    tabs[active].focus({ preventScroll: true });
    tabs[active].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
}

tabs.forEach((button, index) => {
  button.addEventListener('click', () => select(index));
  button.addEventListener('keydown', (event) => {
    let nextIndex;
    if (['ArrowDown', 'ArrowRight'].includes(event.key)) nextIndex = (active + 1) % steps.length;
    if (['ArrowUp', 'ArrowLeft'].includes(event.key)) nextIndex = (active - 1 + steps.length) % steps.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = steps.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      select(nextIndex, true);
    }
  });
});

document.querySelector('#previous').addEventListener('click', () => select(active - 1));
document.querySelector('#next').addEventListener('click', () => select(active + 1));

const mediaQuery = matchMedia('(max-width:750px)');
function setOrientation() {
  const rail = document.querySelector('.tour-tabs');
  rail.setAttribute('aria-orientation', mediaQuery.matches ? 'horizontal' : 'vertical');
  if (mediaQuery.matches) rail.scrollLeft = tabs[active].offsetLeft - rail.offsetLeft;
}
setOrientation();
mediaQuery.addEventListener('change', setOrientation);

document.querySelectorAll('[data-theme-view]').forEach((button) => button.addEventListener('click', () => {
  const dark = button.dataset.themeView === 'dark';
  const src = `screenshots/${dark ? '10-dark-overview' : '05-overview'}.png`;
  document.querySelectorAll('[data-theme-view]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
  const image = document.querySelector('#appearance-image');
  image.src = src;
  image.alt = `Actual LinkLens Tech Book Store audit overview in ${dark ? 'dark' : 'light'} mode.`;
  document.querySelector('#appearance-full').href = src;
  document.querySelector('#appearance-link').href = src;
}));
