import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isAcceptedImage,
  sortImageFiles,
  detectPersonalImageKeys,
  buildGameImages,
} from '../scripts/lib/images';

describe('isAcceptedImage', () => {
  it('accepte jpg/png/webp/avif, rejette le reste', () => {
    expect(isAcceptedImage('01-front.webp')).toBe(true);
    expect(isAcceptedImage('a.JPG')).toBe(true);
    expect(isAcceptedImage('note.txt')).toBe(false);
    expect(isAcceptedImage('cover.svg')).toBe(false);
  });
});

describe('sortImageFiles', () => {
  it('trie de façon déterministe et insensible à la casse', () => {
    expect(sortImageFiles(['02-back.png', '01-front.png', '10-disc.png'])).toEqual([
      '01-front.png',
      '02-back.png',
      '10-disc.png',
    ]);
  });
});

describe('detectPersonalImageKeys', () => {
  let assetsRoot: string;
  beforeAll(() => {
    assetsRoot = mkdtempSync(join(tmpdir(), 'assets-'));
    const dir = join(assetsRoot, 'games', 'personal', 'pc-1');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '02-back.png'), 'x');
    writeFileSync(join(dir, '01-front.png'), 'x');
    writeFileSync(join(dir, 'notes.txt'), 'ignore');
  });
  afterAll(() => rmSync(assetsRoot, { recursive: true, force: true }));

  it('détecte et trie les images, en excluant les non-images', () => {
    const personalRoot = join(assetsRoot, 'games', 'personal');
    const keys = detectPersonalImageKeys('pc-1', personalRoot, assetsRoot);
    expect(keys).toEqual(['games/personal/pc-1/01-front.png', 'games/personal/pc-1/02-back.png']);
  });

  it('retourne un tableau vide si le dossier n’existe pas', () => {
    const personalRoot = join(assetsRoot, 'games', 'personal');
    expect(detectPersonalImageKeys('pc-999', personalRoot, assetsRoot)).toEqual([]);
  });
});

describe('buildGameImages — ordre de fallback', () => {
  const base = { title: 'Fable', console: 'Xbox', placeholderSrc: '/placeholder.svg' };

  it('1) priorise la première photo personnelle', () => {
    const out = buildGameImages({
      ...base,
      personalKeys: ['games/personal/pc-1/01.png', 'games/personal/pc-1/02.png'],
      genericCover: { src: 'https://img/cover.jpg' },
    });
    expect(out.tier).toBe('personal');
    expect(out.primaryImage.source).toBe('personal');
    expect(out.primaryImage.src).toBe('games/personal/pc-1/01.png');
    expect(out.personalImages).toHaveLength(2);
  });

  it('2) retombe sur la pochette générique sans photo perso', () => {
    const out = buildGameImages({
      ...base,
      personalKeys: [],
      genericCover: { src: 'https://img/cover.jpg', attribution: 'IGDB' },
    });
    expect(out.tier).toBe('generic');
    expect(out.primaryImage.source).toBe('generic');
    expect(out.primaryImage.attribution).toBe('IGDB');
  });

  it('3) retombe sur le placeholder sans aucune image', () => {
    const out = buildGameImages({ ...base, personalKeys: [] });
    expect(out.tier).toBe('placeholder');
    expect(out.primaryImage.source).toBe('placeholder');
    expect(out.primaryImage.src).toBe('/placeholder.svg');
  });
});
