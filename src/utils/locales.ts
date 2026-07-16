export interface Locale {
  id: string;
  label: string;
  shortLabel: string;
  htmlLang: string;
}

export const LOCALES: Locale[] = [
  { id: 'fr', label: 'Français', shortLabel: 'FR', htmlLang: 'fr-CA' },
  { id: 'en', label: 'English', shortLabel: 'EN', htmlLang: 'en-CA' },
];

export const DEFAULT_LOCALE = 'fr';

export type LocaleId = (typeof LOCALES)[number]['id'];

export function isLocale(value: string): value is LocaleId {
  return LOCALES.some((locale) => locale.id === value);
}

export function htmlLangFor(id: string): string {
  return LOCALES.find((l) => l.id === id)?.htmlLang ?? 'fr-CA';
}
