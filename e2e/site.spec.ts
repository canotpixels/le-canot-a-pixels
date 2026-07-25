import { test, expect } from '@playwright/test';

// Ces tests s'exécutent sur le build de démonstration (fixture) :
//   halo-combat-evolved  → photos personnelles
//   fable                → pochette générique (démo locale)
//   obscure-bootleg-adventure → placeholder
//   steel-battalion      → jeu recherché

test('la page d’accueil s’ouvre avec le titre et les statistiques', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Canot à Pixels/i);
  await expect(page.locator('.hero__title')).toBeVisible();
  // Deux statistiques : collection et jeux recherchés.
  await expect(page.locator('.stat')).toHaveCount(2);
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
  await page.locator('[data-filter-group="console"] [data-filter-value="Xbox 360"]').click();
  const visible = page.locator('[data-game]:not([hidden])');
  const count = await visible.count();
  expect(count).toBeGreaterThan(0);
  // Toutes les cartes visibles doivent être des Xbox 360
  for (let i = 0; i < count; i += 1) {
    await expect(visible.nth(i)).toHaveAttribute('data-console', 'Xbox 360');
  }
});

test('le bouton effacer vide la recherche et la réinitialisation retire les filtres', async ({
  page,
}) => {
  await page.goto('/collection');
  const total = await page.locator('[data-game]').count();

  await page.locator('[data-filter-search]').fill('halo');
  await expect(page.locator('[data-game]:not([hidden])')).toHaveCount(1);
  await page.locator('[data-search-clear]').click();
  await expect(page.locator('[data-game]:not([hidden])')).toHaveCount(total);

  await page.locator('[data-filter-group="console"] [data-filter-value="Xbox 360"]').click();
  const resetBtn = page.locator('[data-clear-filters]');
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(page.locator('[data-game]:not([hidden])')).toHaveCount(total);
  await expect(resetBtn).toBeHidden();
});

test('les filtres sont reflétés dans l’URL et restaurés au chargement', async ({ page }) => {
  await page.goto('/collection?console=Xbox%20360');
  const activeChip = page.locator('[data-filter-group="console"] [data-filter-value="Xbox 360"]');
  await expect(activeChip).toHaveAttribute('aria-pressed', 'true');
  const visible = page.locator('[data-game]:not([hidden])');
  expect(await visible.count()).toBeGreaterThan(0);
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

test('la collection n’affiche aucun prix (orientation collectionneur)', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page.locator('.card__price')).toHaveCount(0);
  await expect(page.locator('.card__value')).toHaveCount(0);
});

test('le changement de langue mène à la version anglaise', async ({ page }) => {
  await page.goto('/collection');
  await page.goto('/en/collection');
  await expect(page.locator('.page__title')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /en/);
});
