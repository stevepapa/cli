/**
 * CLI Kit Tests
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { parseVarAssignments } from '../src/cli/cliKit.js';

describe('cliKit', () => {
  let tempDirs: string[] = [];
  const MAX_VAR_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  function tempDirInCwd(): string {
    const dir = mkdtempSync(join(process.cwd(), 'promptg-'));
    tempDirs.push(dir);
    return dir;
  }

  function tempDirInTmp(): string {
    const dir = mkdtempSync(join(tmpdir(), 'promptg-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs = [];
  });

  afterAll(() => {
    // Defensive cleanup: if a test run is interrupted, remove any leftover temp dirs under CWD.
    const cwd = process.cwd();
    for (const name of readdirSync(cwd)) {
      if (!name.startsWith('promptg-') && !name.startsWith('tmp-promptg-')) continue;
      const full = join(cwd, name);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      rmSync(full, { recursive: true, force: true });
    }
  });

  describe('parseVarAssignments', () => {
    it('parses key=value', async () => {
      const vars = await parseVarAssignments(['lang=Go', 'focus=security']);
      expect(vars).toEqual({ 'var:lang': 'Go', 'var:focus': 'security' });
    });

    it('parses key@filepath (multiline)', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'diff.txt');
      writeFileSync(filePath, 'line1\nline2\n', 'utf8');

      const vars = await parseVarAssignments([`diff@${filePath}`]);
      expect(vars).toEqual({ 'var:diff': 'line1\nline2\n' });
    });

    it('parses key@filepath (empty file)', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'empty.txt');
      writeFileSync(filePath, '', 'utf8');

      const vars = await parseVarAssignments([`empty@${filePath}`]);
      expect(vars).toEqual({ 'var:empty': '' });
    });

    it('parses key@filepath (binary-ish utf8 bytes)', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'bin.dat');
      writeFileSync(filePath, Buffer.from([0x00, 0x61, 0x00, 0x62])); // \0a\0b

      const vars = await parseVarAssignments([`bin@${filePath}`]);
      expect(vars['var:bin']).toBe('\u0000a\u0000b');
    });

    it('rejects paths outside the current directory', async () => {
      const dir = tempDirInTmp();
      const outsideFile = join(dir, 'outside.txt');
      writeFileSync(outsideFile, 'nope', 'utf8');

      const relToOutside = relative(process.cwd(), outsideFile);
      await expect(parseVarAssignments([`x@${relToOutside}`])).rejects.toThrow(
        /must be within current directory/i
      );
    });

    it('rejects traversal paths (..\\) that resolve outside the current directory', async () => {
      const dir = tempDirInTmp();
      const outsideFile = join(dir, 'outside.txt');
      writeFileSync(outsideFile, 'nope', 'utf8');

      const traversal = join('..', relative(join(process.cwd(), '..'), outsideFile));
      await expect(parseVarAssignments([`x@${traversal}`])).rejects.toThrow(
        /must be within current directory/i
      );
    });

    it('rejects files larger than 10MB', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'big.bin');
      writeFileSync(filePath, Buffer.alloc(MAX_VAR_FILE_SIZE_BYTES + 1));
      await expect(parseVarAssignments([`big@${filePath}`])).rejects.toThrow(/File too large/i);
    });

    it('allows exactly 10MB files', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'exact.bin');
      writeFileSync(filePath, Buffer.alloc(MAX_VAR_FILE_SIZE_BYTES));
      const vars = await parseVarAssignments([`exact@${filePath}`]);
      expect(vars['var:exact'].length).toBe(MAX_VAR_FILE_SIZE_BYTES);
    });

    it('parses relative paths inside the current directory', async () => {
      const dir = tempDirInCwd();
      const filePath = join(dir, 'rel.txt');
      writeFileSync(filePath, 'ok', 'utf8');
      const rel = relative(process.cwd(), filePath);
      const vars = await parseVarAssignments([`rel@${rel}`]);
      expect(vars).toEqual({ 'var:rel': 'ok' });
    });

    it('fails for missing file in key@filepath', async () => {
      await expect(parseVarAssignments(['diff@./does-not-exist.txt'])).rejects.toThrow(
        /File not found/i
      );
    });

    it('fails for invalid assignment format', async () => {
      await expect(parseVarAssignments(['just-a-key'])).rejects.toThrow(
        /Expected key=value or key@filepath/i
      );
    });
  });
});
