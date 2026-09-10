import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// CONTRIBUTING requires the simulation to stay framework-independent: nothing in
// `src/sim` or `src/content` may import React, Electron, PixiJS or the DOM, so the
// whole game model stays unit-testable and shareable.
//
// This is easy to break by accident — a shared constant pulled in from a renderer
// module drags React in transitively. This test walks the real import graph rather
// than just the direct imports, so that transitive case is caught too.

const ROOT = join(__dirname, '..', 'src');
const FORBIDDEN = ['react', 'react-dom', 'electron', 'pixi.js'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** Local (relative) and bare import specifiers used by a file. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs: string[] = [];
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) specs.push(m[1]);
  return specs;
}

/** Resolve a relative specifier to a real file path, or null for bare imports. */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(fromFile, '..', spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/**
 * Every module reachable from `entry`, plus the bare packages encountered along
 * the way and which file pulled each one in.
 */
function reachable(entry: string): { packages: Map<string, string> } {
  const seen = new Set<string>();
  const packages = new Map<string, string>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(file)) {
      const local = resolveLocal(file, spec);
      if (local) {
        stack.push(local);
      } else {
        // Record the first importer, which is the useful one for a failure message.
        const pkg = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        if (!packages.has(pkg)) packages.set(pkg, file);
      }
    }
  }
  return { packages };
}

describe('architecture: the simulation stays framework-independent', () => {
  const layers = ['sim', 'content'];

  for (const layer of layers) {
    it(`src/${layer} never reaches a UI framework, even transitively`, () => {
      const offenders: string[] = [];
      for (const file of sourceFiles(join(ROOT, layer))) {
        const { packages } = reachable(file);
        for (const forbidden of FORBIDDEN) {
          const importer = packages.get(forbidden);
          if (importer) {
            offenders.push(
              `${file.replace(ROOT, 'src')} reaches "${forbidden}" via ${importer.replace(ROOT, 'src')}`,
            );
          }
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it(`src/${layer} contains no .tsx files`, () => {
      const tsx = sourceFiles(join(ROOT, layer)).filter((f) => f.endsWith('.tsx'));
      expect(tsx.map((f) => f.replace(ROOT, 'src'))).toEqual([]);
    });
  }
});
