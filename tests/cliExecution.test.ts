import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test, expect, beforeAll } from 'vitest';

describe('CLI Execution', () => {
  const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

  beforeAll(() => {
    if (existsSync(CLI_PATH)) return;
    execSync('npm run build', { stdio: 'inherit' });
  });

  test('--version returns version number', () => {
    try {
      const output = execFileSync('node', [CLI_PATH, '--version'], { encoding: 'utf-8' });
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    } catch (error: any) {
      // Commander exits with code 2 for --version, check stdout
      expect(error.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  test('--help returns usage information', () => {
    try {
      const output = execFileSync('node', [CLI_PATH, '--help'], { encoding: 'utf-8' });
      expect(output).toContain('promptg');
      expect(output).toContain('USAGE');
    } catch (error: any) {
      // Commander exits with code 2 for --help, check stdout
      expect(error.stdout).toContain('promptg');
      expect(error.stdout).toContain('USAGE');
    }
  });

  test('--help includes main commands', () => {
    try {
      const output = execFileSync('node', [CLI_PATH, '--help'], { encoding: 'utf-8' });
      expect(output).toContain('get');
      expect(output).toContain('init');
      expect(output).toContain('prompt');
    } catch (error: any) {
      // Commander exits with code 2 for --help, check stdout
      expect(error.stdout).toContain('get');
      expect(error.stdout).toContain('init');
      expect(error.stdout).toContain('prompt');
    }
  });

  test('get --help shows get command usage', () => {
    try {
      const output = execFileSync('node', [CLI_PATH, 'get', '--help'], { encoding: 'utf-8' });
      expect(output).toContain('get');
      expect(output).toContain('<name>');
    } catch (error: any) {
      // Commander exits with code 2 for --help, check stdout
      expect(error.stdout).toContain('get');
      expect(error.stdout).toContain('<name>');
    }
  });

  test('invalid command exits with non-zero code', () => {
    expect(() => {
      execFileSync('node', [CLI_PATH, 'nonexistent-command'], { encoding: 'utf-8', stdio: 'pipe' });
    }).toThrow();
  });

  test('version command executes without error', () => {
    expect(() => {
      execFileSync('node', [CLI_PATH, 'version'], { encoding: 'utf-8' });
    }).not.toThrow();
  });

  test('init/save/get/validate workflow works in a temp project store', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'promptg-cli-e2e-'));
    try {
      execFileSync('node', [CLI_PATH, 'init'], { cwd: projectDir, stdio: 'pipe' });

      execFileSync('node', [CLI_PATH, 'prompt', 'save', 'e2e-prompt'], {
        cwd: projectDir,
        input: 'Review this code for correctness.',
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const rendered = execFileSync('node', [CLI_PATH, 'get', 'e2e-prompt'], {
        cwd: projectDir,
        encoding: 'utf-8',
      });
      expect(rendered.trim()).toBe('Review this code for correctness.');

      const validateJson = execFileSync(
        'node',
        [CLI_PATH, 'validate', '--store', 'project', '--format', 'json'],
        {
          cwd: projectDir,
          encoding: 'utf-8',
        }
      );
      const parsed = JSON.parse(validateJson) as { ok: boolean };
      expect(parsed.ok).toBe(true);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
