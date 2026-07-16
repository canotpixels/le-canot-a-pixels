export interface Theme {
  id: string;
  label: string;
}

export const THEMES: Theme[] = [
  { id: 'dark', label: 'Sombre' },
  { id: 'light', label: 'Clair' },
];

export const DEFAULT_THEME = 'dark';

/** Clé de stockage local du thème choisi. */
export const THEME_STORAGE_KEY = 'xbox-collection-theme';
