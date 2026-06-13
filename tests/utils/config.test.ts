import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { detectProject, loadProjectConfig, type ProjectInfo } from '../../src/utils/config.js';

// ── Helpers ──────────────────────────────────────────────────────

const TEMP_DIR = join(process.cwd(), '.tmp-config-test-external');

function createTempDir(): void {
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupTempDir(): void {
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
}

function createPackageJson(dir: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
}

function createLockFile(dir: string, type: 'pnpm' | 'yarn'): void {
  const filename = type === 'pnpm' ? 'pnpm-lock.yaml' : 'yarn.lock';
  writeFileSync(join(dir, filename), '', 'utf-8');
}

// ── Tests ────────────────────────────────────────────────────────

describe('config utilities', () => {
  beforeEach(createTempDir);
  afterEach(cleanupTempDir);

  describe('detectProject', () => {
    it('returns unknown when no package.json exists', async () => {
      const emptyDir = join(TEMP_DIR, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const result = await detectProject(emptyDir);
      expect(result.framework).toBe('unknown');
      expect(result.packageManager).toBe('unknown');
      expect(result.hasTypeScript).toBe(false);
    });

    it('detects Next.js project', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: { next: '^14.0.0' },
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.framework).toBe('next');
    });

    it('detects Vite project', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: { vite: '^5.0.0' },
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.framework).toBe('vite');
    });

    it('detects Remix project', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: { '@remix-run/node': '^2.0.0' },
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.framework).toBe('remix');
    });

    it('defaults to node for generic projects', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: { express: '^4.18.0' },
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.framework).toBe('node');
    });

    it('detects pnpm as package manager', async () => {
      createPackageJson(TEMP_DIR, { dependencies: {} });
      createLockFile(TEMP_DIR, 'pnpm');

      const result = await detectProject(TEMP_DIR);
      expect(result.packageManager).toBe('pnpm');
    });

    it('detects yarn as package manager', async () => {
      createPackageJson(TEMP_DIR, { dependencies: {} });
      createLockFile(TEMP_DIR, 'yarn');

      const result = await detectProject(TEMP_DIR);
      expect(result.packageManager).toBe('yarn');
    });

    it('defaults to npm when no lock file', async () => {
      createPackageJson(TEMP_DIR, { dependencies: {} });

      const result = await detectProject(TEMP_DIR);
      expect(result.packageManager).toBe('npm');
    });

    it('detects TypeScript', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: {},
        devDependencies: { typescript: '^5.3.0' },
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.hasTypeScript).toBe(true);
      expect(result.tsVersion).toBe('5.3.0');
    });

    it('strips caret and tilde from tsVersion', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: {},
        devDependencies: { typescript: '~5.2.0' },
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.tsVersion).toBe('5.2.0');
    });

    it('returns hasTypeScript=false when no typescript dependency', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: {},
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.hasTypeScript).toBe(false);
      expect(result.tsVersion).toBeUndefined();
    });

    it('Next.js takes priority over Vite when both present', async () => {
      createPackageJson(TEMP_DIR, {
        dependencies: { next: '^14.0.0', vite: '^5.0.0' },
        devDependencies: {},
      });

      const result = await detectProject(TEMP_DIR);
      expect(result.framework).toBe('next');
    });
  });

  describe('loadProjectConfig', () => {
    it('returns null when no config file exists', async () => {
      const result = await loadProjectConfig(TEMP_DIR);
      expect(result).toBeNull();
    });

    it('returns null for non-existent directory', async () => {
      const result = await loadProjectConfig(join(TEMP_DIR, 'nonexistent'));
      expect(result).toBeNull();
    });
  });
});
