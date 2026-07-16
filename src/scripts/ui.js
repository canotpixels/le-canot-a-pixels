// Contrôles d'interface : thème (persistant), menus déroulants, menu mobile.
// Léger, sans dépendance. Chargé une seule fois par page.

const STORAGE_KEY = 'xbox-collection-theme';

function initTheme() {
  const root = document.documentElement;
  const validThemes = (root.dataset.themeIds || '').split(',').filter(Boolean);
  const fallback = root.dataset.defaultTheme || 'dark';
  if (validThemes.length === 0) return;

  const current = () => {
    const t = root.dataset.theme;
    return validThemes.includes(t) ? t : fallback;
  };

  const apply = (theme) => {
    if (!validThemes.includes(theme)) return;
    root.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) {
      void _e;
    }
    document.querySelectorAll('[data-theme-option]').forEach((option) => {
      const active = option.dataset.themeId === theme;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  };

  document.querySelectorAll('[data-theme-option]').forEach((option) => {
    option.addEventListener('click', () => {
      if (option.dataset.themeId) apply(option.dataset.themeId);
      closeAllMenus();
    });
  });

  document.querySelectorAll('[data-theme-cycle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = validThemes.indexOf(current());
      apply(validThemes[(i + 1) % validThemes.length] || fallback);
    });
  });

  apply(current());
}

function closeAllMenus() {
  document.querySelectorAll('[data-picker]').forEach((p) => p.classList.remove('is-open'));
  document
    .querySelectorAll('[data-picker-toggle]')
    .forEach((t) => t.setAttribute('aria-expanded', 'false'));
}

function initPickers() {
  document.querySelectorAll('[data-picker]').forEach((picker) => {
    const toggle = picker.querySelector('[data-picker-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = !picker.classList.contains('is-open');
      closeAllMenus();
      if (opening) {
        picker.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && !event.target.closest('[data-picker]')) {
      closeAllMenus();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllMenus();
  });
}

function initMobileMenu() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-main-nav]');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

function boot() {
  initTheme();
  initPickers();
  initMobileMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
