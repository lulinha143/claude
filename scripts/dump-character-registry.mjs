#!/usr/bin/env node
/**
 * Print the character-art registry as JSON, for the Python asset scripts.
 *
 * The registry is TypeScript and the encoders are plain Python, so rather than
 * re-implementing (and eventually drifting from) the parser in a second language,
 * both sides go through `scripts/lib/sprite-geometry.mjs` — the same reader
 * `verify-assets.mjs` and `check-sprite-resampling.mjs` already rely on.
 *
 * Usage: node scripts/dump-character-registry.mjs
 */
import { readRegistry } from './lib/sprite-geometry.mjs';

console.log(JSON.stringify(readRegistry(), null, 2));
