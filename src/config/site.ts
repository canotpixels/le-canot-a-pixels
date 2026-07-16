// -----------------------------------------------------------------------------
// Configuration centrale du site.
//
// Modifiez ces valeurs pour personnaliser le catalogue. Les canaux de contact
// laissés vides sont automatiquement masqués dans l'interface (voir Contact).
// Aucune coordonnée n'est inventée : les placeholders sont explicites.
// -----------------------------------------------------------------------------

export interface SiteConfig {
  ownerName: string;
  siteName: string;
  currency: string;
  locale: string;
  location: string;
  creatorName: string;
  creatorUrl: string;
  facebookUrl: string;
  messengerUrl: string;
  email: string;
}

export const siteConfig: SiteConfig = {
  ownerName: 'Le Canot à Pixels',
  siteName: 'Le Canot à Pixels',
  currency: 'CAD',
  locale: 'fr-CA',
  location: 'Lavaltrie, Québec',
  creatorName: 'PrestigiaDigital.ca',
  creatorUrl: 'https://prestigiadigital.ca',
  facebookUrl: '', // ex. https://facebook.com/ma-page  (vide = bouton masqué)
  messengerUrl: '', // ex. https://m.me/ma-page          (vide = bouton masqué)
  email: 'canot.pixels@outlook.com', // ex. contact@exemple.ca            (vide = bouton masqué)
};

/** Un placeholder [ENTRE CROCHETS] n'est pas une vraie donnée à afficher tel quel. */
export function isPlaceholder(value: string): boolean {
  return /^\[.*\]$/.test(value.trim());
}

export interface ContactChannel {
  type: 'facebook' | 'messenger' | 'email';
  url: string;
}

/** Canaux de contact réellement configurés (les vides sont exclus). */
export function activeContactChannels(config: SiteConfig = siteConfig): ContactChannel[] {
  const channels: ContactChannel[] = [];
  if (config.facebookUrl.trim())
    channels.push({ type: 'facebook', url: config.facebookUrl.trim() });
  if (config.messengerUrl.trim())
    channels.push({ type: 'messenger', url: config.messengerUrl.trim() });
  if (config.email.trim()) channels.push({ type: 'email', url: `mailto:${config.email.trim()}` });
  return channels;
}
