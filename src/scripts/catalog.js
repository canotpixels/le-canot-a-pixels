// Filtrage, tri et recherche côté client pour les pages de catalogue.
// Léger : agit sur les cartes déjà rendues (aucune donnée rechargée).
// Filtres en chips à bascule avec compteurs de facettes dynamiques ;
// l'état est reflété dans l'URL (paramètres) pour être partageable.

function normalize(text) {
  return (text || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Clés d'URL par groupe de filtre (rétrocompatibles avec l'ancienne version).
const URL_KEYS = { console: 'console', status: 'status', completeness: 'etat' };

function initCatalog() {
  const root = document.querySelector('[data-catalog]');
  if (!root) return;

  const grid = root.querySelector('[data-grid]');
  const items = Array.from(root.querySelectorAll('[data-game]'));
  const search = root.querySelector('[data-filter-search]');
  const searchClear = root.querySelector('[data-search-clear]');
  const sortSel = root.querySelector('[data-sort]');
  const countEl = root.querySelector('[data-results-count]');
  const emptyEl = root.querySelector('[data-empty]');
  const clearBtn = root.querySelector('[data-clear-filters]');
  const emptyResetBtn = root.querySelector('[data-empty-reset]');
  const liveEl = root.querySelector('[data-live]');

  const singular = root.dataset.resultsOne || '{count} result';
  const plural = root.dataset.resultsMany || '{count} results';

  // Groupes de chips : { key, chips: [{ el, value, countEl }] } — valeur '' = « tous ».
  const groups = Array.from(root.querySelectorAll('[data-filter-group]')).map((groupEl) => ({
    key: groupEl.dataset.filterGroup,
    value: '',
    chips: Array.from(groupEl.querySelectorAll('[data-filter-value]')).map((el) => ({
      el,
      value: el.dataset.filterValue || '',
      countEl: el.querySelector('[data-count]'),
    })),
  }));

  // État initial depuis l'URL (liens partageables).
  const params = new URLSearchParams(window.location.search);
  if (search && params.has('q')) search.value = params.get('q') || '';
  if (sortSel && params.has('tri')) sortSel.value = params.get('tri') || '';
  for (const group of groups) {
    const wanted = params.get(URL_KEYS[group.key] || group.key) || '';
    if (wanted && group.chips.some((c) => c.value === wanted)) group.value = wanted;
  }

  function num(el) {
    const v = parseFloat(el.dataset.price || '');
    return Number.isNaN(v) ? 0 : v;
  }
  function val(el) {
    const v = parseFloat(el.dataset.value || '');
    return Number.isNaN(v) ? 0 : v;
  }

  // Un item passe-t-il les filtres, en ignorant éventuellement un groupe ?
  // (utilisé pour les compteurs de facettes : chaque groupe est compté
  //  par rapport aux autres filtres, pas à lui-même)
  function matches(item, q, skipKey) {
    if (q && !normalize(item.dataset.title).includes(q)) return false;
    for (const group of groups) {
      if (group.key === skipKey || !group.value) continue;
      if (item.dataset[group.key] !== group.value) return false;
    }
    return true;
  }

  function hasActiveFilters(q) {
    return Boolean(q) || groups.some((g) => g.value);
  }

  function apply() {
    const q = normalize(search ? search.value : '');
    const sort = sortSel ? sortSel.value : 'title-asc';

    let visible = 0;
    for (const item of items) {
      const show = matches(item, q, null);
      item.hidden = !show;
      if (show) visible += 1;
    }

    // Compteurs de facettes : pour chaque chip, nombre de résultats si on
    // l'activait (les autres filtres restant appliqués).
    for (const group of groups) {
      for (const chip of group.chips) {
        const active = chip.value === group.value;
        chip.el.classList.toggle('is-active', active);
        chip.el.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (!chip.countEl) continue;
        const count = items.reduce(
          (acc, item) =>
            acc + (matches(item, q, group.key) && item.dataset[group.key] === chip.value ? 1 : 0),
          0
        );
        chip.countEl.textContent = String(count);
        chip.el.disabled = count === 0 && !active;
      }
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

    const tpl = visible === 1 ? singular : plural;
    if (countEl) countEl.textContent = tpl.replace('{count}', String(visible));
    if (liveEl) liveEl.textContent = tpl.replace('{count}', String(visible));
    if (emptyEl) emptyEl.hidden = visible !== 0;
    if (grid) grid.hidden = visible === 0;

    if (searchClear) searchClear.hidden = !(search && search.value);
    if (clearBtn) clearBtn.hidden = !hasActiveFilters(q);

    // Synchronisation de l'URL (partageable)
    const next = new URLSearchParams();
    if (q && search) next.set('q', search.value);
    for (const group of groups) {
      if (group.value) next.set(URL_KEYS[group.key] || group.key, group.value);
    }
    if (sort && sort !== 'title-asc') next.set('tri', sort);
    const qs = next.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  // Recherche « debouncée » pour éviter de refiltrer à chaque frappe.
  let debounceId = 0;
  if (search) {
    search.addEventListener('input', () => {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(apply, 120);
    });
  }
  if (sortSel) sortSel.addEventListener('change', apply);

  for (const group of groups) {
    for (const chip of group.chips) {
      chip.el.addEventListener('click', () => {
        // Re-cliquer la chip active revient à « tous ».
        group.value = group.value === chip.value ? '' : chip.value;
        apply();
      });
    }
  }

  function resetAll() {
    if (search) search.value = '';
    for (const group of groups) group.value = '';
    if (sortSel) sortSel.value = 'title-asc';
    apply();
    if (search) search.focus();
  }
  if (clearBtn) clearBtn.addEventListener('click', resetAll);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAll);

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (search) {
        search.value = '';
        apply();
        search.focus();
      }
    });
  }

  // Raccourci clavier « / » : focus sur la recherche (comme GitHub, YouTube…).
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      (target && target.isContentEditable)
    ) {
      return;
    }
    if (search) {
      event.preventDefault();
      search.focus();
      search.select();
    }
  });

  apply();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCatalog);
} else {
  initCatalog();
}
