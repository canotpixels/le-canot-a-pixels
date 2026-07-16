import { test, expect } from '@playwright/test';

// Ces tests s'exécutent sur le build de démonstration (fixture) :
//   halo-combat-evolved  → photos personnelles
//   fable                → pochette générique (démo locale)
//   obscure-bootleg-adventure → placeholder
//   forza-motorsport     → à vendre

test('la page d’accueil s’ouvre avec le titre et les statistiques', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Canot à Pixels/i);
  await expect(page.locator('.hero__title')).toBeVisible();
  await expect(page.locator('.stat')).toHaveCount(3);
});

test('la navigation mène à une fiche de jeu', async ({ page }) => {
  await page.goto('/collection');
  const firstLink = page.locator('.card__title a').first();
  await firstLink.click();
  await expect(page).toHaveURL(/\/jeux\//);
  await expect(page.locator('.detail__title')).toBeVisible();
});

test('la recherche filtre les résultats', async ({ page }) => {
  await page.goto('/collection');
  await page.locator('[data-filter-search]').fill('halo');
  const visible = page.locator('[data-game]:not([hidden])');
  await expect(visible).toHaveCount(1);
  await expect(page.locator('[data-results-count]')).toContainText('1');
});

test('le filtre par console fonctionne', async ({ page }) => {
  await page.goto('/collection');
  await page.selectOption('[data-filter-console]', 'Xbox 360');
  const visible = page.locator('[data-game]:not([hidden])');
  const count = await visible.count();
  expect(count).toBeGreaterThan(0);
  // Toutes les cartes visibles doivent être des Xbox 360
  for (let i = 0; i < count; i += 1) {
    await expect(visible.nth(i)).toHaveAttribute('data-console', 'Xbox 360');
  }
});

test('l’état vide s’affiche sans résultat', async ({ page }) => {
  await page.goto('/collection');
  await page.locator('[data-filter-search]').fill('zzz-inexistant-xyz');
  await expect(page.locator('[data-empty]')).toBeVisible();
});

test('la photo personnelle est prioritaire (fallback niveau 1)', async ({ page }) => {
  await page.goto('/jeux/halo-combat-evolved');
  const mainImg = page.locator('.gallery__main img');
  // Astro optimise les photos perso : le nom de fichier source est conservé.
  await expect(mainImg).toHaveAttribute('src', /01-front|_astro/);
  // La galerie contient plusieurs vignettes (2 photos perso + pochette générique éventuelle).
  await expect(page.locator('.gallery__thumb')).toHaveCount(2);
});

test('fallback vers la pochette générique (niveau 2)', async ({ page }) => {
  await page.goto('/jeux/fable');
  const mainImg = page.locator('.gallery__main img');
  await expect(mainImg).toHaveAttribute('src', /fable-cover/);
  await expect(page.locator('.notice').first()).toContainText(/référence/i);
});

test('fallback vers le placeholder (niveau 3)', async ({ page }) => {
  await page.goto('/jeux/obscure-bootleg-adventure');
  const mainImg = page.locator('.gallery__main img');
  await expect(mainImg).toHaveAttribute('src', /placeholder\.svg/);
});

test('un jeu à vendre affiche son prix', async ({ page }) => {
  await page.goto('/a-vendre');
  await expect(page.locator('.card__price').first()).toBeVisible();
});

test('le changement de langue mène à la version anglaise', async ({ page }) => {
  await page.goto('/collection');
  await page.goto('/en/collection');
  await expect(page.locator('.page__title')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /en/);
});
