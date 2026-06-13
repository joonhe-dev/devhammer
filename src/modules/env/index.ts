// devhammer — Env Module
// Environment variable management: init, encrypt, decrypt, diff, validate

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { EnvSchema, EnvDiffResult } from '../../types.js';
import { logger } from '../../utils/logger.js';
import { fileExists, readFileContent, writeFileContent } from '../../utils/fs.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

// ─── .env File Parsing ──────────────────────────────────

/**
 * Parse a .env file into a key-value map.
 * Ignores comments (#) and empty lines.
 * Handles KEY=VALUE, KEY="VALUE", KEY='VALUE' formats.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Parse .env.example to extract keys, default values, and type hints.
 * Comment format: KEY=default # type:string,required
 * Or: KEY=default # default: value
 */
export function parseEnvExample(content: string): {
  keys: Record<string, string>;
  schema: EnvSchema;
} {
  const keys: Record<string, string> = {};
  const schema: EnvSchema = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let valuePart = trimmed.slice(eqIndex + 1).trim();

    // Extract inline comment metadata
    let commentPart = '';
    const commentIndex = valuePart.indexOf(' #');
    if (commentIndex !== -1) {
      commentPart = valuePart.slice(commentIndex + 2).trim();
      valuePart = valuePart.slice(0, commentIndex).trim();
    }

    // Remove surrounding quotes from value
    if (
      (valuePart.startsWith('"') && valuePart.endsWith('"')) ||
      (valuePart.startsWith("'") && valuePart.endsWith("'"))
    ) {
      valuePart = valuePart.slice(1, -1);
    }

    keys[key] = valuePart;

    // Parse schema from comment
    const schemaEntry: EnvSchema[string] = {
      type: 'string',
      description: '',
    };

    if (valuePart !== undefined && valuePart !== null) {
      schemaEntry.default = valuePart;
    }

    if (commentPart) {
      // Parse type: and required: from comment
      const typeMatch = commentPart.match(/type:(\w+)/);
      if (typeMatch) {
        const t = typeMatch[1]!.toLowerCase();
        if (['string', 'number', 'boolean', 'url', 'path'].includes(t)) {
          schemaEntry.type = t as EnvSchema[string]['type'];
        }
      }

      const requiredMatch = commentPart.match(/required/);
      if (requiredMatch) {
        schemaEntry.required = true;
      }

      // Use remaining comment as description
      const desc = commentPart
        .replace(/type:\w+/g, '')
        .replace(/,?\s*required\s*,?/g, '')
        .replace(/,?\s*default:\s*\S+/g, '')
        .replace(/,\s*,/g, ',')
        .replace(/^,|,$/g, '')
        .trim();
      if (desc) {
        schemaEntry.description = desc;
      }
    }

    // Check for # default: value in comment
    const defaultMatch = commentPart.match(/default:\s*(\S+)/);
    if (defaultMatch) {
      schemaEntry.default = defaultMatch[1]!;
    }

    schema[key] = schemaEntry;
  }

  return { keys, schema };
}

// ─── .gitignore Safety Check ────────────────────────────

/**
 * Check if a file is listed in .gitignore.
 */
export function isGitignored(filePath: string, rootDir?: string): boolean {
  const dir = rootDir ?? process.cwd();
  const gitignorePath = join(dir, '.gitignore');

  if (!existsSync(gitignorePath)) return false;

  try {
    const content = readFileSync(gitignorePath, 'utf-8');
    const patterns = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    return patterns.some(
      (pattern) =>
        pattern === filePath ||
        pattern === `/${filePath}` ||
        pattern === `${filePath}` ||
        // Handle glob-like patterns
        (pattern.endsWith('/') && filePath.startsWith(pattern)),
    );
  } catch {
    return false;
  }
}

/**
 * Warn if .env is not in .gitignore.
 */
function warnIfNotGitignored(filePath: string): void {
  const basename = filePath.startsWith('./') ? filePath.slice(2) : filePath;
  if (!isGitignored(basename)) {
    logger.warn(`${basename} is not in .gitignore. Consider adding it to prevent committing secrets.`);
  }
}

// ─── Type Validation ────────────────────────────────────

/**
 * Validate a value against an expected type.
 */
export function validateType(value: string, type: string): boolean {
  switch (type) {
    case 'number':
      return !isNaN(Number(value)) && value.trim() !== '';
    case 'boolean':
      return ['true', 'false', '0', '1', 'yes', 'no'].includes(value.toLowerCase());
    case 'url':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'path':
      // Basic path validation: non-empty, no null bytes
      return value.length > 0 && !value.includes('\0');
    case 'string':
    default:
      return value.length > 0;
  }
}

// ─── Module Exports ─────────────────────────────────────

export const envModule = {
  /**
   * Create .env from .env.example with interactive prompts.
   */
  async init(options: {
    source?: string;
    output?: string;
    interactive?: boolean;
  }): Promise<void> {
    const sourcePath = resolve(options.source ?? '.env.example');
    const outputPath = resolve(options.output ?? '.env');

    if (!fileExists(sourcePath)) {
      logger.error(`Source file not found: ${sourcePath}`);
      return;
    }

    if (fileExists(outputPath)) {
      logger.warn(`${outputPath} already exists. Overwriting.`);
    }

    const content = await readFileContent(sourcePath);
    const { keys, schema } = parseEnvExample(content);
    const entries = Object.entries(keys);

    if (entries.length === 0) {
      logger.warn('No variables found in source file.');
      return;
    }

    const result: Record<string, string> = {};
    const isInteractive = options.interactive !== false;

    if (isInteractive) {
      const rl = createInterface({ input, output });
      try {
        logger.heading('Environment Setup');
        for (const [key, defaultValue] of entries) {
          const schemaInfo = schema[key];
          const hint = defaultValue ? ` (default: ${defaultValue})` : '';
          const typeHint = schemaInfo?.type && schemaInfo.type !== 'string'
            ? ` [${schemaInfo.type}]`
            : '';
          const requiredHint = schemaInfo?.required ? ' [required]' : '';

          const answer = await rl.question(`  ${key}${hint}${typeHint}${requiredHint}: `);
          result[key] = answer.trim() || defaultValue || '';
        }
      } finally {
        rl.close();
      }
    } else {
      // Non-interactive: use defaults
      for (const [key, defaultValue] of entries) {
        result[key] = defaultValue || '';
      }
    }

    // Write .env file
    const envContent = Object.entries(result)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await writeFileContent(outputPath, `${envContent}\n`);
    logger.success(`Created ${outputPath} with ${entries.length} variable(s).`);
    warnIfNotGitignored('.env');
  },

  /**
   * Encrypt .env to .env.encrypted.
   */
  async encrypt(options: {
    input?: string;
    output?: string;
    key?: string;
  }): Promise<void> {
    const inputPath = resolve(options.input ?? '.env');
    const outputPath = resolve(options.output ?? '.env.encrypted');

    if (!fileExists(inputPath)) {
      logger.error(`Input file not found: ${inputPath}`);
      return;
    }

    const encryptionKey = options.key ?? process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      logger.error('Encryption key required. Use --key flag or set ENCRYPTION_KEY env var.');
      return;
    }

    const content = await readFileContent(inputPath);
    const encrypted = encrypt(content, encryptionKey);

    await writeFileContent(outputPath, encrypted);
    logger.success(`Encrypted ${inputPath} -> ${outputPath}`);
    warnIfNotGitignored('.env');
  },

  /**
   * Decrypt .env.encrypted to .env.
   */
  async decrypt(options: {
    input?: string;
    output?: string;
    key?: string;
  }): Promise<void> {
    const inputPath = resolve(options.input ?? '.env.encrypted');
    const outputPath = resolve(options.output ?? '.env');

    if (!fileExists(inputPath)) {
      logger.error(`Input file not found: ${inputPath}`);
      return;
    }

    const decryptionKey = options.key ?? process.env.ENCRYPTION_KEY;
    if (!decryptionKey) {
      logger.error('Decryption key required. Use --key flag or set ENCRYPTION_KEY env var.');
      return;
    }

    const encryptedContent = await readFileContent(inputPath);

    let decrypted: string;
    try {
      decrypted = decrypt(encryptedContent, decryptionKey);
    } catch {
      logger.error('Decryption failed. Check your encryption key.');
      return;
    }

    await writeFileContent(outputPath, decrypted);
    logger.success(`Decrypted ${inputPath} -> ${outputPath}`);
  },

  /**
   * Compare .env and .env.example for differences.
   */
  async diff(options: {
    source?: string;
    target?: string;
  }): Promise<void> {
    const sourcePath = resolve(options.source ?? '.env.example');
    const targetPath = resolve(options.target ?? '.env');

    if (!fileExists(sourcePath)) {
      logger.error(`Source file not found: ${sourcePath}`);
      return;
    }

    if (!fileExists(targetPath)) {
      logger.error(`Target file not found: ${targetPath}`);
      return;
    }

    const sourceContent = await readFileContent(sourcePath);
    const targetContent = await readFileContent(targetPath);

    const sourceVars = parseEnvFile(sourceContent);
    const targetVars = parseEnvFile(targetContent);

    const result = computeDiff(sourceVars, targetVars);

    if (result.missing.length === 0 && result.extra.length === 0 && result.changed.length === 0) {
      logger.success('No differences found between source and target.');
      return;
    }

    logger.heading('Environment Diff');

    if (result.missing.length > 0) {
      logger.warn(`Missing keys (in source but not in target):`);
      for (const key of result.missing) {
        logger.dim(`  - ${key}`);
      }
    }

    if (result.extra.length > 0) {
      logger.info(`Extra keys (in target but not in source):`);
      for (const key of result.extra) {
        logger.dim(`  + ${key}`);
      }
    }

    if (result.changed.length > 0) {
      logger.info(`Changed values:`);
      logger.table(
        result.changed.map((c) => ({
          Key: c.key,
          Expected: c.expected,
          Actual: c.actual,
        })),
      );
    }
  },

  /**
   * Validate .env against a schema.
   */
  async validate(options: {
    file?: string;
    schema?: string;
  }): Promise<void> {
    const envPath = resolve(options.file ?? '.env');

    if (!fileExists(envPath)) {
      logger.error(`File not found: ${envPath}`);
      return;
    }

    // Determine schema source
    let schema: EnvSchema;

    if (options.schema && fileExists(resolve(options.schema))) {
      const schemaContent = await readFileContent(resolve(options.schema));
      schema = JSON.parse(schemaContent) as EnvSchema;
    } else {
      // Auto-infer from .env.example
      const examplePath = resolve('.env.example');
      if (!fileExists(examplePath)) {
        logger.error('No schema file provided and .env.example not found for auto-inference.');
        return;
      }
      const exampleContent = await readFileContent(examplePath);
      const parsed = parseEnvExample(exampleContent);
      schema = parsed.schema;
    }

    const envContent = await readFileContent(envPath);
    const envVars = parseEnvFile(envContent);

    const errors: Array<{ key: string; issue: string }> = [];
    const warnings: Array<{ key: string; issue: string }> = [];
    let passCount = 0;

    for (const [key, rules] of Object.entries(schema)) {
      const value = envVars[key];

      // Check required
      if (rules.required && (value === undefined || value === '')) {
        errors.push({ key, issue: 'Required but missing or empty' });
        continue;
      }

      // Skip further validation if not present
      if (value === undefined) {
        if (!rules.required) {
          warnings.push({ key, issue: 'Not set (optional)' });
        }
        continue;
      }

      // Type validation
      if (rules.type && rules.type !== 'string') {
        if (!validateType(value, rules.type)) {
          errors.push({ key, issue: `Expected type "${rules.type}" but value "${value}" is invalid` });
          continue;
        }
      }

      passCount++;
    }

    // Check for keys in .env not in schema
    const schemaKeys = new Set(Object.keys(schema));
    for (const key of Object.keys(envVars)) {
      if (!schemaKeys.has(key)) {
        warnings.push({ key, issue: 'Not defined in schema' });
      }
    }

    // Report
    logger.heading('Environment Validation');

    if (errors.length === 0) {
      logger.success(`All ${passCount} variable(s) passed validation.`);
    } else {
      logger.error(`${errors.length} error(s) found:`);
      logger.table(
        errors.map((e) => ({ Key: e.key, Issue: e.issue })),
      );
    }

    if (warnings.length > 0) {
      logger.warn(`${warnings.length} warning(s):`);
      for (const w of warnings) {
        logger.dim(`  ${w.key}: ${w.issue}`);
      }
    }
  },
};

// ─── Diff Computation ───────────────────────────────────

/**
 * Compute differences between two key-value maps.
 */
export function computeDiff(
  source: Record<string, string>,
  target: Record<string, string>,
): EnvDiffResult {
  const sourceKeys = new Set(Object.keys(source));
  const targetKeys = new Set(Object.keys(target));

  const missing = [...sourceKeys].filter((k) => !targetKeys.has(k));
  const extra = [...targetKeys].filter((k) => !sourceKeys.has(k));

  const changed: EnvDiffResult['changed'] = [];
  for (const key of sourceKeys) {
    if (targetKeys.has(key) && source[key] !== target[key]) {
      changed.push({
        key,
        expected: source[key]!,
        actual: target[key]!,
      });
    }
  }

  return { missing, extra, changed };
}
