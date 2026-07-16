// Filtrage, tri et recherche côté client pour les pages de catalogue.
// Léger : agit sur les cartes déjà rendues (aucune donnée rechargée).
// Les filtres sont reflétés dans l'URL (paramètres) pour être partageables.

function normalize(text) {
  return (text || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function initCatalog() {
  const root = document.querySelector('[data-catalog]');
  if (!root) return;

  const grid = root.querySelector('[data-grid]');
  const items = Array.from(root.querySelectorAll('[data-game]'));
  const search = root.querySelector('[data-filter-search]');
  const consoleSel = root.querySelector('[data-filter-console]');
  const statusSel = root.querySelector('[data-filter-status]');
  const completenessSel = root.querySelector('[data-filter-completeness]');
  const sortSel = root.querySelector('[data-sort]');
  const countEl = root.querySelector('[data-results-count]');
  const emptyEl = root.querySelector('[data-empty]');
  const clearBtn = root.querySelector('[data-clear-filters]');
  const liveEl = root.querySelector('[data-live]');

  const singular = root.dataset.resultsOne || '{count} result';
  const plural = root.dataset.resultsMany || '{count} results';

  const params = new URLSearchParams(window.location.search);
  const setInitial = (el, key) => {
    if (el && params.has(key)) el.value = params.get(key) || '';
  };
  setInitial(search, 'q');
  setInitial(consoleSel, 'console');
  setInitial(statusSel, 'status');
  setInitial(completenessSel, 'etat');
  setInitial(sortSel, 'tri');

  function num(el) {
    const v = parseFloat(el.dataset.price || '');
    return Number.isNaN(v) ? 0 : v;
  }
  function val(el) {
    const v = parseFloat(el.dataset.value || '');
    return Number.isNaN(v) ? 0 : v;
  }

  function apply() {
    const q = normalize(search ? search.value : '');
    const c = consoleSel ? consoleSel.value : '';
    const s = statusSel ? statusSel.value : '';
    const comp = completenessSel ? completenessSel.value : '';
    const sort = sortSel ? sortSel.value : 'title-asc';

    let visible = 0;
    for (const item of items) {
      const matchQ = !q || normalize(item.dataset.title).includes(q);
      const matchC = !c || item.dataset.console === c;
      const matchS = !s || item.dataset.status === s;
      const matchComp = !comp || item.dataset.completeness === comp;
      const show = matchQ && matchC && matchS && matchComp;
      item.hidden = !show;
      if (show) visible += 1;
    }

    // Tri (réordonne les éléments visibles dans la grille)
    const sorted = items.slice().sort((a, b) => {
      switch (sort) {
        case 'title-desc':
          return normalize(b.dataset.title).localeCompare(normalize(a.dataset.title));
        case 'price-asc':
          return num(a) - num(b);
        case 'price-desc':
          return num(b) - num(a);
        case 'value-asc':
          return val(a) - val(b);
        case 'value-desc':
          return val(b) - val(a);
        case 'title-asc':
        default:
          return normalize(a.dataset.title).localeCompare(normalize(b.dataset.title));
      }
    });
    if (grid) sorted.forEach((el) => grid.appendChild(el));

    if (countEl) {
      const tpl = visible === 1 ? singular : plural;
      countEl.textContent = tpl.replace('{count}', String(visible));
    }
    if (liveEl) {
      const tpl = visible === 1 ? singular : plural;
      liveEl.textContent = tpl.replace('{count}', String(visible));
    }
    if (emptyEl) emptyEl.hidden = visible !== 0;
    if (grid) grid.hidden = visible === 0;

    // Synchronisation de l'URL (partageable)
    const next = new URLSearchParams();
    if (q) next.set('q', search.value);
    if (c) next.set('console', c);
    if (s) next.set('status', s);
    if (comp) next.set('etat', comp);
    if (sort && sort !== 'title-asc') next.set('tri', sort);
    const qs = next.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  [search, consoleSel, statusSel, completenessSel, sortSel].forEach((el) => {
    if (!el) return;
    const evt = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(evt, apply);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (search) search.value = '';
      if (consoleSel) consoleSel.value = '';
      if (statusSel) statusSel.value = '';
      if (completenessSel) completenessSel.value = '';
      if (sortSel) sortSel.value = 'title-asc';
      apply();
      if (search) search.focus();
    });
  }

  apply();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCatalog);
} else {
  initCatalog();
}
