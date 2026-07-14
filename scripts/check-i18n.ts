/* eslint-disable no-console */
// Localization completeness checker. Compares every locale's key set against
// the English source of truth. Fails (exit 1) if a locale marked `complete`
// is missing keys; warns for draft locales. Also verifies dialogue arrays have
// the expected number of lines. Run via `npm run check:i18n`.
import { resources } from '../src/i18n/index';
import { DIALOGUE_COUNTS } from '../src/content/dialogue';

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      keys.push(`${path}[]${v.length}`);
    } else if (v && typeof v === 'object') {
      keys.push(...flatten(v as Json, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const en = resources.en.translation as unknown as Json;
const enKeys = new Set(flatten(en));

let hardFailures = 0;
let warnings = 0;

console.info('Localization completeness report');
console.info('================================');

for (const [lang, res] of Object.entries(resources)) {
  if (lang === 'en') continue;
  const translation = res.translation as unknown as Json;
  const meta = (translation._meta as { complete?: boolean; name?: string }) ?? {};
  const langKeys = new Set(flatten(translation));
  const missing: string[] = [];
  for (const key of enKeys) {
    // ignore array-length markers when checking presence of nested keys
    const base = key.replace(/\[\]\d+$/, '');
    const present = [...langKeys].some((k) => k.replace(/\[\]\d+$/, '') === base);
    if (!present) missing.push(base);
  }
  const pct = Math.round(((enKeys.size - missing.length) / enKeys.size) * 100);
  const label = meta.complete ? 'COMPLETE' : 'draft';
  console.info(`\n${lang} (${meta.name ?? '?'}) — ${pct}% [${label}]`);
  if (missing.length > 0) {
    if (meta.complete) {
      hardFailures += 1;
      console.error(`  ✗ marked complete but missing ${missing.length} keys:`);
      console.error('    ' + missing.slice(0, 20).join('\n    '));
    } else {
      warnings += 1;
      console.info(`  … ${missing.length} keys fall back to English (expected for a draft)`);
    }
  }
}

// dialogue count validation for complete locales
console.info('\nDialogue line counts');
console.info('--------------------');
for (const [lang, res] of Object.entries(resources)) {
  const t = res.translation as unknown as Json;
  const meta = (t._meta as { complete?: boolean }) ?? {};
  if (!meta.complete) continue;
  const dialogue = (t.dialogue as Record<string, unknown[]>) ?? {};
  for (const [cat, expected] of Object.entries(DIALOGUE_COUNTS)) {
    const actual = Array.isArray(dialogue[cat]) ? dialogue[cat].length : 0;
    if (actual !== expected) {
      hardFailures += 1;
      console.error(`  ✗ ${lang}.dialogue.${cat}: expected ${expected}, got ${actual}`);
    }
  }
}

console.info('\n================================');
if (hardFailures > 0) {
  console.error(`FAILED: ${hardFailures} hard error(s), ${warnings} warning(s).`);
  process.exit(1);
} else {
  console.info(`OK: 0 hard errors, ${warnings} draft warning(s).`);
}
