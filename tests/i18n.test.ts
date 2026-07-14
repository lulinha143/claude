import { describe, it, expect } from 'vitest';
import { resources } from '../src/i18n';
import { DIALOGUE_COUNTS } from '../src/content/dialogue';

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) keys.push(path);
    else if (v && typeof v === 'object') keys.push(...flatten(v as Json, path));
    else keys.push(path);
  }
  return keys;
}

const en = resources.en.translation as unknown as Json;
const enKeys = new Set(flatten(en));

describe('localization completeness', () => {
  it('marks en and pt-BR as complete', () => {
    expect((resources.en.translation as Json)._meta).toMatchObject({ complete: true });
    expect((resources['pt-BR'].translation as Json)._meta).toMatchObject({ complete: true });
  });

  it('pt-BR has every English key (fully translated)', () => {
    const pt = resources['pt-BR'].translation as unknown as Json;
    const ptKeys = new Set(flatten(pt));
    const missing = [...enKeys].filter((k) => !ptKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('every complete locale has the right number of dialogue lines', () => {
    for (const [, res] of Object.entries(resources)) {
      const t = res.translation as unknown as Json;
      if (!(t._meta as { complete?: boolean })?.complete) continue;
      const dialogue = t.dialogue as Record<string, unknown[]>;
      for (const [cat, count] of Object.entries(DIALOGUE_COUNTS)) {
        expect(dialogue[cat]).toHaveLength(count);
      }
    }
  });

  it('draft locales at least declare their metadata', () => {
    for (const [lang, res] of Object.entries(resources)) {
      const meta = (res.translation as Json)._meta as { name?: string } | undefined;
      expect(meta?.name, `${lang} missing _meta.name`).toBeTruthy();
    }
  });
});
