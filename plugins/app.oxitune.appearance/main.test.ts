import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  normalizeSettings,
  pickPalette,
  rgbToHsl,
  hslToHex,
  isWashUrl,
  varsCss,
  rootAttributes,
  boxBlur,
  gradeWash
} = require('./main.js');

/** RGBA pixels: `n` copies of each [r, g, b] (alpha 255). */
function pixels(...runs: [number[], number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [rgb, n] of runs) for (let i = 0; i < n; i++) out.push(rgb[0], rgb[1], rgb[2], 255);
  return new Uint8ClampedArray(out);
}

describe('Appearance: settings', () => {
  test('defaults for missing or broken values', () => {
    expect(normalizeSettings(undefined)).toEqual({ look: 'glass', tint: true, floating: true, radius: 12, backdrop: 70 });
    expect(normalizeSettings({ look: 'nope', radius: 'x', backdrop: null })).toEqual({
      look: 'glass', tint: true, floating: true, radius: 12, backdrop: 70
    });
  });

  test('numbers are clamped to the manifest range', () => {
    const s = normalizeSettings({ look: 'panels', tint: false, floating_bar: false, radius: 99, backdrop: -5 });
    expect(s).toEqual({ look: 'panels', tint: false, floating: false, radius: 28, backdrop: 0 });
    expect(normalizeSettings({ radius: 0 }).radius).toBe(0);
  });

  test('the floating bar belongs to the glass look only', () => {
    expect(rootAttributes(normalizeSettings({ look: 'glass' }))).toEqual({ 'data-oxa-look': 'glass', 'data-oxa-floating': 'true' });
    expect(rootAttributes(normalizeSettings({ look: 'glass', floating_bar: false }))['data-oxa-floating']).toBeNull();
    expect(rootAttributes(normalizeSettings({ look: 'panels', floating_bar: true }))['data-oxa-floating']).toBeNull();
  });
});

describe('Appearance: colors', () => {
  test('hsl round trip', () => {
    const [h, s, l] = rgbToHsl(255, 0, 51);
    expect(hslToHex(h, s, l)).toBe('#ff0033');
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
  });

  test('a small vivid area beats a large dull one', () => {
    const palette = pickPalette(pixels([[90, 80, 70], [80]], [[20, 200, 230], [20]]));
    const [h, s, l] = rgbToHsl(...(palette.accent.match(/\w\w/g).map((x: string) => parseInt(x, 16)) as [number, number, number]));
    expect(h).toBeGreaterThan(180);
    expect(h).toBeLessThan(200);
    expect(s).toBeGreaterThanOrEqual(0.49);
    expect(l).toBeGreaterThanOrEqual(0.59);
  });

  test('a black-and-white cover has no accent, only a dark base', () => {
    const palette = pickPalette(pixels([[240, 240, 240], [50]], [[10, 10, 10], [50]]));
    expect(palette.accent).toBeNull();
    expect(rgbToHsl(...(palette.base.match(/\w\w/g).map((x: string) => parseInt(x, 16)) as [number, number, number]))[2]).toBeLessThanOrEqual(0.161);
  });

  test('stray colored pixels are noise', () => {
    expect(pickPalette(pixels([[128, 128, 128], [200]], [[255, 0, 0], [1]])).accent).toBeNull();
  });

  test('transparent or empty images give nothing', () => {
    expect(pickPalette(new Uint8ClampedArray([255, 0, 0, 0]))).toBeNull();
    expect(pickPalette(new Uint8ClampedArray([]))).toBeNull();
  });

  test('the wash grade saturates and darkens, and leaves grey grey', () => {
    const px = pixels([[200, 100, 50], [1]], [[128, 128, 128], [1]]);
    gradeWash(px, 2, 0.5);
    const [r, g, b] = [px[0], px[1], px[2]];
    expect(r - b).toBeGreaterThan((200 - 50) * 0.5);
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(200);
    expect([px[4], px[5], px[6]]).toEqual([64, 64, 64]);
    expect(px[3]).toBe(255);
  });

  test('blur keeps a flat image flat and smooths an edge', () => {
    const flat = pixels([[100, 50, 25], [16]]);
    boxBlur(flat, 4, 4, 1);
    expect(Array.from(flat.slice(0, 4))).toEqual([100, 50, 25, 255]);
    const edge = pixels([[0, 0, 0], [2]], [[255, 255, 255], [2]]);
    boxBlur(edge, 4, 1, 1);
    expect(edge[4]).toBeGreaterThan(0);
    expect(edge[4]).toBeLessThan(255);
  });
});

describe('Appearance: custom properties', () => {
  const glass = normalizeSettings({ look: 'glass' });
  const wash = 'data:image/png;base64,iVBORw0KGgo=';

  test('cover colors and the wash when tinting', () => {
    const css = varsCss(glass, { accent: '#11aabb', base: '#101820' }, wash);
    expect(css).toContain('html[data-oxa-look="glass"]');
    expect(css).toContain('--oxa-accent: #11aabb;');
    expect(css).toContain('--oxa-base: #101820;');
    expect(css).toContain(`--oxa-wash: url("${wash}");`);
    expect(css).toContain('--oxa-radius: 12px;');
    expect(css).toContain('--oxa-wash-opacity: 0.7;');
  });

  test('fixed colors when tinting is off or the cover had none', () => {
    const off = varsCss({ ...glass, tint: false }, { accent: '#11aabb', base: '#101820' }, wash);
    expect(off).toContain('--oxa-accent: #5ad1e6;');
    expect(off).toContain('--oxa-wash: none;');
    const panels = varsCss(normalizeSettings({ look: 'panels' }), { accent: null, base: '#101010' }, null);
    expect(panels).toContain('--oxa-accent: #1ed760;');
    expect(panels).toContain('--oxa-base: #101010;');
  });

  test('only a PNG data URL reaches the stylesheet', () => {
    expect(isWashUrl(wash)).toBe(true);
    expect(isWashUrl('https://example.com/a.png')).toBe(false);
    expect(isWashUrl('data:image/png;base64,abc");}body{display:none')).toBe(false);
    expect(varsCss(glass, null, 'data:image/png;base64,x") ; } *{')).toContain('--oxa-wash: none;');
  });
});

describe('Appearance: stylesheets', () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dir, 'manifest.json'), 'utf8'));

  test('every rule waits for the attributes main.js sets', () => {
    for (const file of manifest.styles) {
      const raw = readFileSync(join(import.meta.dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Font faces change nothing until a rule names them; only the
      // plugin's own family names may be declared.
      for (const family of raw.match(/font-family:\s*'[^']+'(?=;\s*font-style)/g) ?? []) expect(family).toMatch(/'Oxa /);
      const css = raw.replace(/@font-face\s*\{[^}]*\}/g, '');
      const selectors = css.match(/[^{}]+(?=\{)/g) ?? [];
      for (const group of selectors) {
        for (const selector of group.split(',')) {
          expect(selector.trim()).toMatch(/^html\[data-oxa-(look|floating)/);
        }
      }
    }
  });

  test('number defaults are written as floats, which Oxitune 0.4.0 needs to accept them', () => {
    const raw = readFileSync(join(import.meta.dir, 'manifest.json'), 'utf8');
    expect(raw).not.toMatch(/"default":\s*-?\d+\s*[,}\n]/);
  });

  test('settings defaults match what the script assumes', () => {
    const defaults = Object.fromEntries(manifest.settings.map((s: { key: string; default: unknown }) => [s.key, s.default]));
    expect(normalizeSettings({})).toEqual(normalizeSettings(defaults));
    const looks = manifest.settings.find((s: { key: string }) => s.key === 'look').options.map((o: { value: string }) => o.value);
    expect(looks).toEqual(['glass', 'panels']);
  });
});
