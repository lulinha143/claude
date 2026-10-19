/**
 * Shared sprite geometry helpers for the asset scripts.
 *
 * The character registry is TypeScript, and these are plain node scripts that run
 * without a build step, so the entries are read out of the source. The regex is
 * deliberately tied to the `art('<asset>', w, h, { officeHeight: n` call shape that
 * `scripts/verify-assets.mjs` already depends on -- if the registry's literal form
 * changes, both stop finding characters loudly rather than silently passing.
 */
import { openSync, readSync, closeSync, readFileSync } from 'node:fs';

const REGISTRY = 'src/art/characterAssets.ts';

/** Height from a PNG's IHDR, without decoding any image data. */
export function PNG_IHDR_HEIGHT(path) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(24);
    readSync(fd, buf, 0, 24, 0);
    if (buf.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') {
      throw new Error(`${path} is not a PNG`);
    }
    return buf.readUInt32BE(20);
  } finally {
    closeSync(fd);
  }
}

/** Width from a PNG's IHDR. */
export function PNG_IHDR_WIDTH(path) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(20);
    readSync(fd, buf, 0, 20, 0);
    return buf.readUInt32BE(16);
  } finally {
    closeSync(fd);
  }
}

/**
 * Every registered character: employee id, asset name and the registry's declared
 * frame size and office height.
 */
export function readRegistry(path = REGISTRY) {
  const src = readFileSync(path, 'utf8');
  const entries = [];
  // `\s*` after `art(` and between every argument, so Prettier is free to wrap the
  // call across lines (it does, once the @2x tuple is there) without breaking this.
  const re =
    /employee:\s*'([^']+)',\s*\n\s*species:\s*'([^']+)'[\s\S]*?art\(\s*'([^']+)',\s*(\d+),\s*(\d+),\s*\{\s*officeHeight:\s*(\d+)/g;
  let m;
  while ((m = re.exec(src))) {
    entries.push({
      employee: m[1],
      species: m[2],
      asset: m[3],
      frameWidth: Number(m[4]),
      frameHeight: Number(m[5]),
      officeHeight: Number(m[6]),
    });
  }
  if (!entries.length) {
    throw new Error(
      `could not read any characters from ${path} -- has the registry shape changed?`,
    );
  }
  return entries;
}
