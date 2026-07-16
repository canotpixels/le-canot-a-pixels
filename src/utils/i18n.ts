import { DEFAULT_LOCALE } from './locales';

// -----------------------------------------------------------------------------
// Couche de traduction. Charge les dictionnaires JSON et renvoie une fonction
// t('chemin.de.clé') qui retombe sur la clé brute si la traduction manque.
// -----------------------------------------------------------------------------

type Dictionary = Record<string, unknown>;

const dictionaryFiles = import.meta.glob<Dictionary>('../i18n/*.json', {
  eager: true,
  import: 'default',
});

const dictionaries: Record<string, Dictionary> = Object.fromEntries(
  Object.entries(dictionaryFiles).map(([filePath, dictionary]) => {
    const locale = filePath.split('/').pop()?.replace('.json', '') ?? DEFAULT_LOCALE;
    return [locale, dictionary];
  })
);

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function useTranslations(lang: string): TranslateFn {
  const dictionary = dictionaries[lang] ?? dictionaries[DEFAULT_LOCALE] ?? {};

  return function t(key, vars) {
    const raw = key
      .split('.')
      .reduce<unknown>((obj, part) => (obj as Dictionary | undefined)?.[part], dictionary);
    let value = typeof raw === 'string' ? raw : key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
      }
    }
    return value;
  };
}
