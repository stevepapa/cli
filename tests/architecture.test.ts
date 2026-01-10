import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walkFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(/import\s+['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

describe('architecture guardrails', () => {
  it('src/core cannot import from src/node or src/cli', () => {
    const coreRoot = path.resolve(process.cwd(), 'src', 'core');
    const coreFiles = walkFiles(coreRoot);

    const forbiddenSegment = /(^|\/)(node|cli)(\/|$)/;
    const violations: Array<{ file: string; specifier: string }> = [];

    for (const filePath of coreFiles) {
      const source = fs.readFileSync(filePath, 'utf8');
      const specifiers = extractImportSpecifiers(source);

      for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;
        if (!forbiddenSegment.test(specifier)) continue;
        violations.push({ file: path.relative(process.cwd(), filePath), specifier });
      }
    }

    expect(violations).toEqual([]);
  });

  it('src/node cannot import from src/cli', () => {
    const nodeRoot = path.resolve(process.cwd(), 'src', 'node');
    const nodeFiles = walkFiles(nodeRoot);

    const forbiddenSegment = /(^|\/)cli(\/|$)/;
    const violations: Array<{ file: string; specifier: string }> = [];

    for (const filePath of nodeFiles) {
      const source = fs.readFileSync(filePath, 'utf8');
      const specifiers = extractImportSpecifiers(source);

      for (const specifier of specifiers) {
        if (!specifier.startsWith('.')) continue;
        if (!forbiddenSegment.test(specifier)) continue;
        violations.push({ file: path.relative(process.cwd(), filePath), specifier });
      }
    }

    expect(violations).toEqual([]);
  });
});
