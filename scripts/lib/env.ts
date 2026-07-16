import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './paths.js';

// -----------------------------------------------------------------------------
// Chargement minimal de .env (sans dépendance). Les valeurs de process.env
// ont priorité sur celles du fichier. Utilisé uniquement par les scripts Node.
// -----------------------------------------------------------------------------

export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const file = resolve(ROOT, '.env');
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}
