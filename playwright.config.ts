import { defineConfig, devices } from '@playwright/test';

// Tests fonctionnels essentiels. Le serveur de preview est démarré
// automatiquement sur le build statique déjà généré.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Construit le site avec les données de démonstration (fixture) afin de
    // couvrir les trois niveaux d'images (perso / générique / placeholder),
    // puis sert le build statique.
    command: 'npm run build:e2e && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
