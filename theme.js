// Shared LENS appearance preference. Run before styles paint.
(function () {
  let preference = 'system';
  try { preference = localStorage.getItem('lens-theme') || 'system'; } catch {}
  const media = matchMedia('(prefers-color-scheme: dark)');
  function apply(value) {
    preference = ['light', 'dark', 'system'].includes(value) ? value : 'system';
    document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  }
  window.lensTheme = {
    get preference() { return preference; },
    set(value) { apply(value); try { localStorage.setItem('lens-theme', preference); } catch {} }
  };
  media.addEventListener('change', () => apply(preference));
  window.addEventListener('storage', event => {
    if (event.key === 'lens-theme') {
      apply(event.newValue);
      const control = document.querySelector('#theme-select');
      if (control) control.value = preference;
    }
  });
  apply(preference);
})();
