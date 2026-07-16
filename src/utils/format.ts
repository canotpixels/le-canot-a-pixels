import { htmlLangFor } from './locales';

// -----------------------------------------------------------------------------
// Formatage des prix, nombres et dates selon la locale.
// -----------------------------------------------------------------------------

// Tous les montants affichés sont arrondis au dollar inférieur (ex. 5,43 $ -> 5 $) :
// aucun prix ni valeur estimée n'affiche de cents sur le site.
export function formatPrice(
  amount: number | undefined,
  currency: string,
  lang: string
): string | undefined {
  if (amount === undefined || Number.isNaN(amount)) return undefined;
  const floored = Math.floor(amount);
  try {
    return new Intl.NumberFormat(htmlLangFor(lang), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(floored);
  } catch {
    return `${floored} ${currency}`;
  }
}

export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(htmlLangFor(lang)).format(value);
}

export function formatDate(iso: string | undefined, lang: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(htmlLangFor(lang), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
