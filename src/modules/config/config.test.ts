import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  _internal,
  generateConfig,
  generateAllConfigs,
  listConfigTypes,
} from './index.js';

// Mock detectProject since it depends on filesystem
vi.mock('../../utils/config.js', () => ({
  detectProject: vi.fn(),
}));

vi.mock('../../utils/fs.js', () => ({
  fileExists: vi.fn().mockReturnValue(false),
  writeFileContent: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  readFileContent: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  resolvePath: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    heading: vi.fn(),
    dim: vi.fn(),
    table: vi.fn(),
  },
}));

import { detectProject } from '../../utils/config.js';
import { fileExists, writeFileContent } from '../../utils/fs.js';

describe('Config Generator Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fileExists).mockReturnValue(false);
    vi.mocked(writeFileContent).mockResolvedValue(undefined);
  });

  // ── ESLint content generation ──────────────────────────────────────

  describe('generateEslintContent', () => {
    it('should generate Next.js eslint config with next/core-web-vitals', () => {
      const content = _internal.generateEslintContent('next');
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('next/core-web-vitals');
    });

    it('should generate Vite/React eslint config with eslint:recommended and typescript', () => {
      const content = _internal.generateEslintContent('vite');
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('eslint:recommended');
      expect(parsed.extends).toContain('@typescript-eslint/recommended');
    });

    it('should generate Node eslint config with node plugin', () => {
      const content = _internal.generateEslintContent('node');
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('eslint:recommended');
      expect(parsed.extends).toContain('@typescript-eslint/recommended');
      expect(parsed.extends).toContain('plugin:node/recommended');
    });

    it('should default to Node eslint config for unknown framework', () => {
      const content = _internal.generateEslintContent('unknown');
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('plugin:node/recommended');
    });
  });

  // ── Prettier content generation ────────────────────────────────────

  describe('generatePrettierContent', () => {
    it('should generate prettier config with correct defaults', () => {
      const content = _internal.generatePrettierContent();
      const parsed = JSON.parse(content);
      expect(parsed).toEqual({
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 100,
        tabWidth: 2,
      });
    });
  });

  // ── TSConfig content generation ────────────────────────────────────

  describe('generateTsconfigContent', () => {
    it('should generate Next.js tsconfig with jsx preserve and paths', () => {
      const content = _internal.generateTsconfigContent('next');
      const parsed = JSON.parse(content);
      expect(parsed.compilerOptions.target).toBe('ES2022');
      expect(parsed.compilerOptions.module).toBe('ESNext');
      expect(parsed.compilerOptions.jsx).toBe('preserve');
      expect(parsed.compilerOptions.paths).toEqual({ '@/*': ['./src/*'] });
    });

    it('should generate Vite tsconfig with bundler moduleResolution', () => {
      const content = _internal.generateTsconfigContent('vite');
      const parsed = JSON.parse(content);
      expect(parsed.compilerOptions.target).toBe('ES2022');
      expect(parsed.compilerOptions.module).toBe('ESNext');
      expect(parsed.compilerOptions.moduleResolution).toBe('bundler');
    });

    it('should generate Node tsconfig with NodeNext module', () => {
      const content = _internal.generateTsconfigContent('node');
      const parsed = JSON.parse(content);
      expect(parsed.compilerOptions.target).toBe('ES2022');
      expect(parsed.compilerOptions.module).toBe('NodeNext');
      expect(parsed.compilerOptions.moduleResolution).toBe('NodeNext');
    });
  });

  // ── Tailwind content generation ────────────────────────────────────

  describe('generateTailwindContent', () => {
    it('should generate Next.js tailwind config with app and src paths', () => {
      const content = _internal.generateTailwindContent('next');
      expect(content).toContain('./src/**/*.{js,ts,jsx,tsx,mdx}');
      expect(content).toContain('./app/**/*.{js,ts,jsx,tsx,mdx}');
      expect(content).toContain('satisfies Config');
    });

    it('should generate Vite tailwind config with index.html and src paths', () => {
      const content = _internal.generateTailwindContent('vite');
      expect(content).toContain('./index.html');
      expect(content).toContain('./src/**/*.{js,ts,jsx,tsx}');
    });

    it('should generate Node tailwind config with src paths only', () => {
      const content = _internal.generateTailwindContent('node');
      expect(content).toContain('./src/**/*.{js,ts,jsx,tsx}');
      expect(content).not.toContain('./app/');
      expect(content).not.toContain('./index.html');
    });
  });

  // ── writeConfigFile behavior ───────────────────────────────────────

  describe('writeConfigFile', () => {
    it('should write file when it does not exist', async () => {
      vi.mocked(fileExists).mockReturnValue(false);

      const result = await _internal.writeConfigFile('/test/file.json', '{}', {});
      expect(result).toBe(true);
      expect(writeFileContent).toHaveBeenCalledWith('/test/file.json', '{}');
    });

    it('should skip file when it exists and force is not set', async () => {
      vi.mocked(fileExists).mockReturnValue(true);

      const result = await _internal.writeConfigFile('/test/file.json', '{}', {});
      expect(result).toBe(false);
      expect(writeFileContent).not.toHaveBeenCalled();
    });

    it('should overwrite file when it exists and force is true', async () => {
      vi.mocked(fileExists).mockReturnValue(true);

      const result = await _internal.writeConfigFile('/test/file.json', '{}', { force: true });
      expect(result).toBe(true);
      expect(writeFileContent).toHaveBeenCalledWith('/test/file.json', '{}');
    });

    it('should print to stdout in dry-run mode without writing', async () => {
      const result = await _internal.writeConfigFile('/test/file.json', '{}', { dryRun: true });
      expect(result).toBe(true);
      expect(writeFileContent).not.toHaveBeenCalled();
    });
  });

  // ── generateConfig dispatch ────────────────────────────────────────

  describe('generateConfig', () => {
    it('should delegate to eslint generator', async () => {
      vi.mocked(detectProject).mockResolvedValue({
        framework: 'node',
        packageManager: 'npm',
        hasTypeScript: true,
      });

      await generateConfig('eslint', { rootDir: '/test' });
      expect(detectProject).toHaveBeenCalledWith('/test');
      expect(writeFileContent).toHaveBeenCalled();
    });

    it('should delegate to prettier generator', async () => {
      await generateConfig('prettier', { rootDir: '/test' });
      expect(writeFileContent).toHaveBeenCalled();
    });

    it('should delegate to tsconfig generator', async () => {
      vi.mocked(detectProject).mockResolvedValue({
        framework: 'node',
        packageManager: 'npm',
        hasTypeScript: true,
      });

      await generateConfig('tsconfig', { rootDir: '/test' });
      expect(detectProject).toHaveBeenCalledWith('/test');
    });

    it('should delegate to tailwind generator', async () => {
      vi.mocked(detectProject).mockResolvedValue({
        framework: 'next',
        packageManager: 'npm',
        hasTypeScript: true,
      });

      await generateConfig('tailwind', { rootDir: '/test' });
      expect(detectProject).toHaveBeenCalledWith('/test');
    });
  });

  // ── generateAllConfigs ─────────────────────────────────────────────

  describe('generateAllConfigs', () => {
    it('should generate eslint + prettier + tsconfig + tailwind for Next.js', async () => {
      vi.mocked(detectProject).mockResolvedValue({
        framework: 'next',
        packageManager: 'npm',
        hasTypeScript: true,
      });

      await generateAllConfigs({ rootDir: '/test' });

      // 4 files: eslintrc, prettierrc, tsconfig, tailwind
      expect(writeFileContent).toHaveBeenCalledTimes(4);
    });

    it('should skip tailwind for non-Next.js projects', async () => {
      vi.mocked(detectProject).mockResolvedValue({
        framework: 'node',
        packageManager: 'npm',
        hasTypeScript: true,
      });

      await generateAllConfigs({ rootDir: '/test' });

      // 3 files: eslintrc, prettierrc, tsconfig
      expect(writeFileContent).toHaveBeenCalledTimes(3);
    });
  });

  // ── listConfigTypes ────────────────────────────────────────────────

  describe('listConfigTypes', () => {
    it('should not throw when listing config types', () => {
      expect(() => listConfigTypes()).not.toThrow();
    });
  });
});
