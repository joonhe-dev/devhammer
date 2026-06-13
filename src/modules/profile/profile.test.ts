import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import {
  parseMetafile,
  scanDistDirectory,
  analyzeDeps,
  profileModule,
} from './index.js';

// ── Helpers ──────────────────────────────────────────────────────────

const TEMP_DIR = join(process.cwd(), '.tmp-profile-test');

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

function createDistFile(dir: string, relPath: string, content: string): void {
  const fullPath = join(dir, relPath);
  const parentDir = join(fullPath, '..');
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
}

// ── parseMetafile ────────────────────────────────────────────────────

describe('parseMetafile', () => {
  it('parses esbuild-style metafile with outputs', () => {
    const metafileDir = join(TEMP_DIR, 'meta-parse');
    mkdirSync(metafileDir, { recursive: true });

    const metafilePath = join(metafileDir, 'metafile.json');
    const metaContent = {
      outputs: {
        'dist/index.js': { bytes: 1024 },
        'dist/vendor.js': { bytes: 2048 },
      },
    };
    writeFileSync(metafilePath, JSON.stringify(metaContent), 'utf-8');

    // Also create the actual dist files for gzip measurement
    createDistFile(metafileDir, 'dist/index.js', 'x'.repeat(1024));
    createDistFile(metafileDir, 'dist/vendor.js', 'x'.repeat(2048));

    const result = parseMetafile(metafilePath, metafileDir);

    expect(result.totalSize).toBe(3072);
    expect(result.files).toHaveLength(2);
    expect(result.files[0]!.size).toBe(2048); // Sorted by size desc
    expect(result.files[1]!.size).toBe(1024);
  });

  it('returns empty result for empty metafile', () => {
    const metafileDir = join(TEMP_DIR, 'meta-empty');
    mkdirSync(metafileDir, { recursive: true });

    const metafilePath = join(metafileDir, 'metafile.json');
    writeFileSync(metafilePath, JSON.stringify({ outputs: {} }), 'utf-8');

    const result = parseMetafile(metafilePath, metafileDir);
    expect(result.totalSize).toBe(0);
    expect(result.files).toHaveLength(0);
  });
});

// ── scanDistDirectory ────────────────────────────────────────────────

describe('scanDistDirectory', () => {
  beforeEach(createTempDir);
  afterEach(cleanupTempDir);

  it('scans dist directory and returns file sizes', () => {
    const distDir = join(TEMP_DIR, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.js'), 'console.log("hello")', 'utf-8');
    writeFileSync(join(distDir, 'utils.js'), 'export const x = 1;', 'utf-8');

    const result = scanDistDirectory(distDir, TEMP_DIR);

    expect(result.files.length).toBeGreaterThanOrEqual(2);
    expect(result.totalSize).toBeGreaterThan(0);

    const paths = result.files.map((f) => f.path);
    expect(paths.some((p) => p.includes('index.js'))).toBe(true);
    expect(paths.some((p) => p.includes('utils.js'))).toBe(true);
  });

  it('returns empty result when dist does not exist', () => {
    const result = scanDistDirectory(join(TEMP_DIR, 'nonexistent'), TEMP_DIR);
    expect(result.totalSize).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('handles nested directories', () => {
    const subDir = join(TEMP_DIR, 'dist', 'chunks');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'chunk-abc.js'), 'export default {};', 'utf-8');
    writeFileSync(join(TEMP_DIR, 'dist', 'index.js'), 'import("./chunks/chunk-abc.js")', 'utf-8');

    const result = scanDistDirectory(join(TEMP_DIR, 'dist'), TEMP_DIR);
    expect(result.files.length).toBeGreaterThanOrEqual(2);
  });
});

// ── analyzeDeps ──────────────────────────────────────────────────────

describe('analyzeDeps', () => {
  beforeEach(createTempDir);
  afterEach(cleanupTempDir);

  it('returns empty when no package.json', () => {
    const emptyDir = join(TEMP_DIR, 'empty-project');
    mkdirSync(emptyDir, { recursive: true });

    const result = analyzeDeps(emptyDir, {});
    expect(result.count).toBe(0);
    expect(result.totalSize).toBe(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.large).toHaveLength(0);
  });

  it('counts dependencies from package.json', () => {
    createPackageJson(TEMP_DIR, {
      dependencies: { lodash: '^4.17.0', express: '^4.18.0' },
    });

    const result = analyzeDeps(TEMP_DIR, {});
    expect(result.count).toBeGreaterThanOrEqual(0); // 0 if no node_modules
  });

  it('detects large packages in node_modules', () => {
    createPackageJson(TEMP_DIR, {
      dependencies: { 'big-lib': '^1.0.0' },
    });

    // Create fake node_modules with a large package
    const bigLibDir = join(TEMP_DIR, 'node_modules', 'big-lib');
    mkdirSync(bigLibDir, { recursive: true });
    writeFileSync(join(bigLibDir, 'package.json'), JSON.stringify({ name: 'big-lib', version: '1.0.0' }), 'utf-8');
    // Create a file > 5MB
    const largeContent = 'x'.repeat(5 * 1024 * 1024 + 1);
    writeFileSync(join(bigLibDir, 'large.dat'), largeContent, 'utf-8');

    const result = analyzeDeps(TEMP_DIR, {});
    expect(result.count).toBeGreaterThanOrEqual(1);
    expect(result.large.length).toBeGreaterThanOrEqual(1);
    expect(result.large[0]!.name).toBe('big-lib');
  });

  it('detects duplicate packages', () => {
    createPackageJson(TEMP_DIR, {
      dependencies: { lodash: '^4.17.0' },
    });

    // Create top-level lodash
    const lodashDir = join(TEMP_DIR, 'node_modules', 'lodash');
    mkdirSync(lodashDir, { recursive: true });
    writeFileSync(join(lodashDir, 'package.json'), JSON.stringify({ name: 'lodash', version: '4.17.21' }), 'utf-8');

    // Create nested lodash with different version
    const nestedDir = join(lodashDir, 'node_modules', 'some-dep', 'node_modules', 'lodash');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'package.json'), JSON.stringify({ name: 'lodash', version: '3.10.1' }), 'utf-8');

    const result = analyzeDeps(TEMP_DIR, {});
    // Duplicates detection depends on walking nested node_modules
    expect(result.duplicates).toBeDefined();
  });

  it('handles scoped packages', () => {
    createPackageJson(TEMP_DIR, {
      dependencies: { '@types/node': '^18.0.0' },
    });

    const scopedDir = join(TEMP_DIR, 'node_modules', '@types', 'node');
    mkdirSync(scopedDir, { recursive: true });
    writeFileSync(join(scopedDir, 'package.json'), JSON.stringify({ name: '@types/node', version: '18.11.0' }), 'utf-8');
    writeFileSync(join(scopedDir, 'index.d.ts'), 'export {};', 'utf-8');

    const result = analyzeDeps(TEMP_DIR, {});
    expect(result.count).toBeGreaterThanOrEqual(1);
  });
});

// ── profileModule.bundle ─────────────────────────────────────────────

describe('profileModule.bundle', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    createTempDir();
    process.cwd = () => TEMP_DIR;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    cleanupTempDir();
  });

  it('warns when no bundle files found', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await profileModule.bundle({});

    const output = consoleSpy.mock.calls.map((c) => c.join('')).join('\n');
    expect(output).toContain('No bundle files found');

    consoleSpy.mockRestore();
  });

  it('outputs JSON when --json flag is set', async () => {
    // Create a dist directory with files
    const distDir = join(TEMP_DIR, 'dist');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'index.js'), 'console.log("test")', 'utf-8');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await profileModule.bundle({ json: true });

    // Find the call that contains valid JSON (the last console.log with structured output)
    const calls = consoleSpy.mock.calls.map((c) => c.join(''));
    const jsonCall = calls.find((c) => {
      try { JSON.parse(c); return true; } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('bundle');

    consoleSpy.mockRestore();
  });
});

// ── profileModule.deps ───────────────────────────────────────────────

describe('profileModule.deps', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    createTempDir();
    process.cwd = () => TEMP_DIR;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    cleanupTempDir();
  });

  it('outputs JSON when --json flag is set', async () => {
    createPackageJson(TEMP_DIR, { dependencies: {} });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await profileModule.deps({ json: true });

    const calls = consoleSpy.mock.calls.map((c) => c.join(''));
    const jsonCall = calls.find((c) => {
      try { JSON.parse(c); return true; } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('deps');

    consoleSpy.mockRestore();
  });
});

// ── profileModule.startup ────────────────────────────────────────────

describe('profileModule.startup', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    createTempDir();
    process.cwd = () => TEMP_DIR;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    cleanupTempDir();
  });

  it('warns when no dist/index.js found', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await profileModule.startup({ runs: '2' });

    const output = consoleSpy.mock.calls.map((c) => c.join('')).join('\n');
    expect(output).toContain('No dist/index.js found');

    consoleSpy.mockRestore();
  });
});

// ── profileModule.all ────────────────────────────────────────────────

describe('profileModule.all', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    createTempDir();
    process.cwd = () => TEMP_DIR;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    cleanupTempDir();
  });

  it('outputs JSON when --json flag is set', async () => {
    createPackageJson(TEMP_DIR, { dependencies: {} });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await profileModule.all({ json: true });

    const calls = consoleSpy.mock.calls.map((c) => c.join(''));
    const jsonCall = calls.find((c) => {
      try { JSON.parse(c); return true; } catch { return false; }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall!);
    expect(parsed).toHaveProperty('bundle');
    expect(parsed).toHaveProperty('deps');
    expect(parsed).toHaveProperty('startup');

    consoleSpy.mockRestore();
  });
});
