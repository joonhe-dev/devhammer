import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  readFileContent,
  writeFileContent,
  ensureDir,
  fileExists,
  readJson,
  writeJson,
  resolvePath,
} from './fs.js';

// ── Helpers ──────────────────────────────────────────────────────────

const TEMP_DIR = join(process.cwd(), '.tmp-fs-test');

function createTempDir(): void {
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupTempDir(): void {
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('fs utilities', () => {
  beforeEach(createTempDir);
  afterEach(cleanupTempDir);

  describe('readFileContent', () => {
    it('reads file content as string', async () => {
      const filePath = join(TEMP_DIR, 'test.txt');
      writeFileSync(filePath, 'hello world', 'utf-8');
      const content = await readFileContent(filePath);
      expect(content).toBe('hello world');
    });

    it('throws for non-existent file', async () => {
      await expect(readFileContent(join(TEMP_DIR, 'nope.txt'))).rejects.toThrow();
    });
  });

  describe('writeFileContent', () => {
    it('writes content to file', async () => {
      const filePath = join(TEMP_DIR, 'output.txt');
      await writeFileContent(filePath, 'written content');
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('written content');
    });

    it('creates parent directories automatically', async () => {
      const filePath = join(TEMP_DIR, 'nested', 'dir', 'file.txt');
      await writeFileContent(filePath, 'nested content');
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toBe('nested content');
    });

    it('overwrites existing file', async () => {
      const filePath = join(TEMP_DIR, 'overwrite.txt');
      writeFileSync(filePath, 'old', 'utf-8');
      await writeFileContent(filePath, 'new');
      expect(readFileSync(filePath, 'utf-8')).toBe('new');
    });
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', async () => {
      const dirPath = join(TEMP_DIR, 'new-dir');
      await ensureDir(dirPath);
      expect(existsSync(dirPath)).toBe(true);
    });

    it('creates nested directories', async () => {
      const dirPath = join(TEMP_DIR, 'a', 'b', 'c');
      await ensureDir(dirPath);
      expect(existsSync(dirPath)).toBe(true);
    });

    it('does not throw if directory already exists', async () => {
      const dirPath = join(TEMP_DIR, 'existing');
      mkdirSync(dirPath, { recursive: true });
      await expect(ensureDir(dirPath)).resolves.toBeUndefined();
    });
  });

  describe('fileExists', () => {
    it('returns true for existing file', () => {
      const filePath = join(TEMP_DIR, 'exists.txt');
      writeFileSync(filePath, 'yes', 'utf-8');
      expect(fileExists(filePath)).toBe(true);
    });

    it('returns false for non-existent file', () => {
      expect(fileExists(join(TEMP_DIR, 'nope.txt'))).toBe(false);
    });

    it('returns true for existing directory', () => {
      expect(fileExists(TEMP_DIR)).toBe(true);
    });
  });

  describe('readJson', () => {
    it('reads and parses JSON file', async () => {
      const filePath = join(TEMP_DIR, 'data.json');
      const data = { name: 'test', value: 42 };
      writeFileSync(filePath, JSON.stringify(data), 'utf-8');

      const result = await readJson<typeof data>(filePath);
      expect(result).toEqual(data);
    });

    it('throws for invalid JSON', async () => {
      const filePath = join(TEMP_DIR, 'bad.json');
      writeFileSync(filePath, 'not json', 'utf-8');
      await expect(readJson(filePath)).rejects.toThrow();
    });
  });

  describe('writeJson', () => {
    it('writes JSON with pretty formatting by default', async () => {
      const filePath = join(TEMP_DIR, 'pretty.json');
      await writeJson(filePath, { key: 'value' });
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('writes compact JSON when pretty is false', async () => {
      const filePath = join(TEMP_DIR, 'compact.json');
      await writeJson(filePath, { key: 'value' }, false);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('{"key":"value"}');
    });

    it('creates parent directories', async () => {
      const filePath = join(TEMP_DIR, 'sub', 'dir', 'data.json');
      await writeJson(filePath, { ok: true });
      expect(existsSync(filePath)).toBe(true);
    });

    it('round-trips with readJson', async () => {
      const filePath = join(TEMP_DIR, 'roundtrip.json');
      const data = { arr: [1, 2, 3], nested: { key: 'val' }, num: 42 };
      await writeJson(filePath, data);
      const result = await readJson<typeof data>(filePath);
      expect(result).toEqual(data);
    });
  });

  describe('resolvePath', () => {
    it('joins path segments', () => {
      const result = resolvePath('a', 'b', 'c');
      expect(result).toContain('a');
      expect(result).toContain('c');
    });

    it('handles absolute path as first segment', () => {
      const result = resolvePath('/root', 'sub', 'file.txt');
      expect(result).toContain('file.txt');
    });
  });
});
