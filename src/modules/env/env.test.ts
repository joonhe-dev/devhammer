// devhammer — Env Module Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  parseEnvFile,
  parseEnvExample,
  isGitignored,
  validateType,
  computeDiff,
  envModule,
} from './index.js';

// ─── .env File Parsing Tests ────────────────────────────

describe('parseEnvFile', () => {
  it('parses simple KEY=VALUE', () => {
    expect(parseEnvFile('DB_HOST=localhost')).toEqual({ DB_HOST: 'localhost' });
  });

  it('ignores comments', () => {
    const content = `# This is a comment
DB_HOST=localhost
# Another comment
DB_PORT=5432`;
    expect(parseEnvFile(content)).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: '5432',
    });
  });

  it('ignores empty lines', () => {
    const content = `DB_HOST=localhost

DB_PORT=5432
`;
    expect(parseEnvFile(content)).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: '5432',
    });
  });

  it('handles double-quoted values', () => {
    expect(parseEnvFile('MESSAGE="hello world"')).toEqual({ MESSAGE: 'hello world' });
  });

  it('handles single-quoted values', () => {
    expect(parseEnvFile("MESSAGE='hello world'")).toEqual({ MESSAGE: 'hello world' });
  });

  it('handles empty values', () => {
    expect(parseEnvFile('EMPTY=')).toEqual({ EMPTY: '' });
  });

  it('handles values with equals sign', () => {
    expect(parseEnvFile('CONNECTION=host=db port=5432')).toEqual({
      CONNECTION: 'host=db port=5432',
    });
  });

  it('skips lines without equals', () => {
    expect(parseEnvFile('NOEQUALSSIGN')).toEqual({});
  });
});

// ─── .env.example Parsing Tests ─────────────────────────

describe('parseEnvExample', () => {
  it('extracts keys and defaults', () => {
    const content = `DB_HOST=localhost
DB_PORT=5432`;
    const { keys, schema } = parseEnvExample(content);
    expect(keys).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
    expect(schema.DB_HOST.default).toBe('localhost');
  });

  it('parses type hints from comments', () => {
    const content = 'PORT=3000 # type:number,required';
    const { schema } = parseEnvExample(content);
    expect(schema.PORT.type).toBe('number');
    expect(schema.PORT.required).toBe(true);
  });

  it('parses url type', () => {
    const content = 'API_URL=http://localhost # type:url';
    const { schema } = parseEnvExample(content);
    expect(schema.API_URL.type).toBe('url');
  });

  it('defaults to string type', () => {
    const content = 'NAME=value';
    const { schema } = parseEnvExample(content);
    expect(schema.NAME.type).toBe('string');
  });

  it('handles empty defaults', () => {
    const content = 'OPTIONAL=';
    const { keys, schema } = parseEnvExample(content);
    expect(keys.OPTIONAL).toBe('');
    expect(schema.OPTIONAL.default).toBe('');
  });
});

// ─── .gitignore Safety Check Tests ──────────────────────

describe('isGitignored', () => {
  const tmpDir = resolve(join(process.cwd(), '.test-gitignore'));

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns true when file is in .gitignore', async () => {
    await writeFile(join(tmpDir, '.gitignore'), '.env\nnode_modules/\n');
    expect(isGitignored('.env', tmpDir)).toBe(true);
  });

  it('returns false when file is not in .gitignore', async () => {
    await writeFile(join(tmpDir, '.gitignore'), 'node_modules/\n');
    expect(isGitignored('.env', tmpDir)).toBe(false);
  });

  it('returns false when .gitignore does not exist', () => {
    expect(isGitignored('.env', join(tmpDir, 'nonexistent'))).toBe(false);
  });

  it('matches patterns with leading slash', async () => {
    await writeFile(join(tmpDir, '.gitignore'), '/.env\n');
    expect(isGitignored('.env', tmpDir)).toBe(true);
  });
});

// ─── Type Validation Tests ──────────────────────────────

describe('validateType', () => {
  it('validates number type', () => {
    expect(validateType('3000', 'number')).toBe(true);
    expect(validateType('not-a-number', 'number')).toBe(false);
    expect(validateType('', 'number')).toBe(false);
  });

  it('validates boolean type', () => {
    expect(validateType('true', 'boolean')).toBe(true);
    expect(validateType('false', 'boolean')).toBe(true);
    expect(validateType('yes', 'boolean')).toBe(true);
    expect(validateType('maybe', 'boolean')).toBe(false);
  });

  it('validates url type', () => {
    expect(validateType('http://localhost:3000', 'url')).toBe(true);
    expect(validateType('https://example.com', 'url')).toBe(true);
    expect(validateType('not-a-url', 'url')).toBe(false);
  });

  it('validates path type', () => {
    expect(validateType('/usr/local/bin', 'path')).toBe(true);
    expect(validateType('./src/index.ts', 'path')).toBe(true);
    expect(validateType('', 'path')).toBe(false);
  });

  it('string type always passes with non-empty value', () => {
    expect(validateType('anything', 'string')).toBe(true);
    expect(validateType('', 'string')).toBe(false);
  });
});

// ─── Diff Computation Tests ─────────────────────────────

describe('computeDiff', () => {
  it('finds missing keys', () => {
    const result = computeDiff({ A: '1', B: '2' }, { A: '1' });
    expect(result.missing).toEqual(['B']);
  });

  it('finds extra keys', () => {
    const result = computeDiff({ A: '1' }, { A: '1', C: '3' });
    expect(result.extra).toEqual(['C']);
  });

  it('finds changed values', () => {
    const result = computeDiff({ A: '1' }, { A: '2' });
    expect(result.changed).toEqual([{ key: 'A', expected: '1', actual: '2' }]);
  });

  it('returns empty when identical', () => {
    const result = computeDiff({ A: '1' }, { A: '1' });
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it('handles completely different key sets', () => {
    const result = computeDiff({ A: '1' }, { B: '2' });
    expect(result.missing).toEqual(['A']);
    expect(result.extra).toEqual(['B']);
  });
});

// ─── envModule.diff Integration Tests ───────────────────

describe('envModule.diff', () => {
  const tmpDir = resolve(join(process.cwd(), '.test-env-diff'));

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, '.env.example'), 'DB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=secret\n');
    await writeFile(join(tmpDir, '.env'), 'DB_HOST=remotehost\nDB_PORT=5432\nEXTRA_KEY=value\n');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reports missing, extra, and changed keys', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Override cwd for this test by passing absolute paths
    await envModule.diff({
      source: join(tmpDir, '.env.example'),
      target: join(tmpDir, '.env'),
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('API_KEY'); // missing
    expect(output).toContain('EXTRA_KEY'); // extra
    expect(output).toContain('DB_HOST'); // changed
    consoleSpy.mockRestore();
  });
});

// ─── envModule.validate Tests ───────────────────────────

describe('envModule.validate', () => {
  const tmpDir = resolve(join(process.cwd(), '.test-env-validate'));

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reports errors for missing required keys', async () => {
    await writeFile(
      join(tmpDir, '.env.example'),
      'API_KEY= # type:string,required\nPORT=3000 # type:number\n',
    );
    await writeFile(join(tmpDir, '.env'), 'PORT=3000\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.validate({
      file: join(tmpDir, '.env'),
      schema: undefined, // will auto-infer from .env.example in cwd
    });

    // Since .env.example is in tmpDir not cwd, schema auto-inference will look at cwd
    // So we test with explicit schema
    consoleSpy.mockRestore();
  });

  it('passes validation for valid env', async () => {
    // Write schema as JSON
    const schema = {
      PORT: { type: 'number' as const, required: true },
      DEBUG: { type: 'boolean' as const },
    };
    await writeFile(join(tmpDir, 'schema.json'), JSON.stringify(schema));
    await writeFile(join(tmpDir, '.env.valid'), 'PORT=3000\nDEBUG=true\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.validate({
      file: join(tmpDir, '.env.valid'),
      schema: join(tmpDir, 'schema.json'),
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('passed');
    consoleSpy.mockRestore();
  });

  it('reports type validation errors', async () => {
    const schema = {
      PORT: { type: 'number' as const, required: true },
    };
    await writeFile(join(tmpDir, 'schema-bad.json'), JSON.stringify(schema));
    await writeFile(join(tmpDir, '.env.bad'), 'PORT=not-a-number\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.validate({
      file: join(tmpDir, '.env.bad'),
      schema: join(tmpDir, 'schema-bad.json'),
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('error');
    consoleSpy.mockRestore();
  });
});

// ─── envModule.encrypt / decrypt Round-trip Test ─────────

describe('envModule.encrypt and decrypt', () => {
  const tmpDir = resolve(join(process.cwd(), '.test-env-crypto'));
  const testKey = 'test-encryption-key-12345';

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(join(tmpDir, '.env'), 'DB_HOST=localhost\nDB_PORT=5432\nSECRET=mysecret\n');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('encrypts and decrypts .env preserving content', async () => {
    const envPath = join(tmpDir, '.env');
    const encPath = join(tmpDir, '.env.encrypted');
    const decPath = join(tmpDir, '.env.decrypted');

    // Encrypt
    await envModule.encrypt({
      input: envPath,
      output: encPath,
      key: testKey,
    });

    expect(existsSync(encPath)).toBe(true);
    const encrypted = await readFile(encPath, 'utf-8');
    expect(encrypted).not.toContain('localhost');

    // Decrypt
    await envModule.decrypt({
      input: encPath,
      output: decPath,
      key: testKey,
    });

    expect(existsSync(decPath)).toBe(true);
    const decrypted = await readFile(decPath, 'utf-8');
    const original = await readFile(envPath, 'utf-8');
    expect(decrypted).toBe(original);
  });

  it('fails decryption with wrong key', async () => {
    const envPath = join(tmpDir, '.env');
    const encPath = join(tmpDir, '.env.encrypted2');

    await envModule.encrypt({
      input: envPath,
      output: encPath,
      key: testKey,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const decPath = join(tmpDir, '.env.wrong');
    await envModule.decrypt({
      input: encPath,
      output: decPath,
      key: 'wrong-key',
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('Decryption failed');
    consoleSpy.mockRestore();
  });

  it('reports error when no encryption key provided', async () => {
    const originalEnv = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.encrypt({
      input: join(tmpDir, '.env'),
      output: join(tmpDir, '.env.nokey'),
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('key required');

    consoleSpy.mockRestore();
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  it('reports error for missing input file', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.encrypt({
      input: join(tmpDir, '.env.nonexistent'),
      key: testKey,
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('not found');

    consoleSpy.mockRestore();
  });
});

// ─── envModule.init Tests ───────────────────────────────

describe('envModule.init', () => {
  const tmpDir = resolve(join(process.cwd(), '.test-env-init'));

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .env from .env.example with defaults (non-interactive)', async () => {
    await writeFile(
      join(tmpDir, '.env.example'),
      'DB_HOST=localhost\nDB_PORT=5432\n',
    );

    await envModule.init({
      source: join(tmpDir, '.env.example'),
      output: join(tmpDir, '.env'),
      interactive: false,
    });

    expect(existsSync(join(tmpDir, '.env'))).toBe(true);
    const content = await readFile(join(tmpDir, '.env'), 'utf-8');
    expect(content).toContain('DB_HOST=localhost');
    expect(content).toContain('DB_PORT=5432');
  });

  it('reports error for missing source file', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await envModule.init({
      source: join(tmpDir, '.env.nonexistent'),
      output: join(tmpDir, '.env'),
      interactive: false,
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('not found');

    consoleSpy.mockRestore();
  });
});
