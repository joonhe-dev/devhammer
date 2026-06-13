// devhammer — Scaffold Module
// Template scaffolding with variable interpolation, dry-run, and custom template support

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeFile, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { TemplateManifest, TemplateVariable } from '../../types.js';
import { logger } from '../../utils/logger.js';
import { ensureDir, writeJson, readJson } from '../../utils/fs.js';
import { builtinTemplates } from './templates.js';

const CUSTOM_TEMPLATES_DIR = '.devhammer/templates';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', '.devhammer']);

// ─── Variable Interpolation Engine ──────────────────────

/**
 * Replace {{variableName}} placeholders in a string with provided values.
 * Supports {{pascal name}}, {{camel name}} helper transforms.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template
    // Handle {{pascal name}} transform
    .replace(/\{\{pascal\s+(\w+)\}\}/g, (_, varName) => toPascalCase(vars[varName] ?? ''))
    // Handle {{camel name}} transform
    .replace(/\{\{camel\s+(\w+)\}\}/g, (_, varName) => toCamelCase(vars[varName] ?? ''))
    // Handle simple {{variableName}}
    .replace(/\{\{(\w+)\}\}/g, (_, varName) => vars[varName] ?? `{{${varName}}}`);
}

/**
 * Evaluate a condition string like "styled=css-modules" or "withLayout=true"
 * Returns true if the variable value matches the expected value.
 */
export function evaluateCondition(condition: string, vars: Record<string, string>): boolean {
  const eqIndex = condition.indexOf('=');
  if (eqIndex === -1) {
    // Just check if variable is truthy
    return isTruthy(vars[condition]);
  }
  const varName = condition.slice(0, eqIndex).trim();
  const expected = condition.slice(eqIndex + 1).trim();
  return vars[varName] === expected;
}

/**
 * Evaluate {{#variable_value}}...{{/variable_value}} conditional blocks in content.
 * Also handles negation: {{^variable_value}}...{{/variable_value}}
 */
export function evaluateConditionals(content: string, vars: Record<string, string>): string {
  // Handle {{#var_value}}...{{/var_value}} blocks
  // Value part may contain hyphens (e.g., css-modules)
  let result = content.replace(
    /\{\{#([\w]+)_([\w-]+)\}\}([\s\S]*?)\{\{\/\1_\2\}\}/g,
    (_, varName, expected, blockContent) => {
      return vars[varName] === expected ? blockContent : '';
    }
  );

  // Handle {{^var_value}}...{{/var_value}} blocks (negation)
  result = result.replace(
    /\{\{\^([\w]+)_([\w-]+)\}\}([\s\S]*?)\{\{\/\1_\2\}\}/g,
    (_, varName, expected, blockContent) => {
      return vars[varName] !== expected ? blockContent : '';
    }
  );

  return result;
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function isTruthy(value: string | undefined): boolean {
  if (value === undefined || value === '') return false;
  return !['false', '0', 'no', 'off'].includes(value.toLowerCase());
}

// ─── Template Discovery ─────────────────────────────────

/**
 * Get all available templates (built-in + custom).
 */
export async function getAllTemplates(rootDir?: string): Promise<TemplateManifest[]> {
  const builtins = builtinTemplates;
  const customs = await getCustomTemplates(rootDir ?? process.cwd());
  return [...builtins, ...customs];
}

/**
 * Load custom templates from .devhammer/templates/ directory.
 */
async function getCustomTemplates(rootDir: string): Promise<TemplateManifest[]> {
  const templatesDir = join(rootDir, CUSTOM_TEMPLATES_DIR);
  if (!existsSync(templatesDir)) return [];

  const templates: TemplateManifest[] = [];
  try {
    const entries = await readdir(templatesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = join(templatesDir, entry.name, 'manifest.json');
        if (existsSync(manifestPath)) {
          try {
            const manifest = await readJson<TemplateManifest>(manifestPath);
            templates.push(manifest);
          } catch {
            logger.warn(`Failed to load custom template: ${entry.name}`);
          }
        }
      }
    }
  } catch {
    // Directory not readable
  }
  return templates;
}

/**
 * Find a template by name (built-in first, then custom).
 */
async function findTemplate(name: string, rootDir?: string): Promise<TemplateManifest | null> {
  const builtin = builtinTemplates.find((t) => t.name === name);
  if (builtin) return builtin;

  const customs = await getCustomTemplates(rootDir ?? process.cwd());
  return customs.find((t) => t.name === name) ?? null;
}

// ─── Interactive Variable Collection ────────────────────

/**
 * Collect variable values interactively using readline.
 * Values from --var flags take precedence; remaining are prompted.
 */
async function collectVariables(
  variables: TemplateVariable[],
  providedVars: Record<string, string>,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = { ...providedVars };
  const missing = variables.filter((v) => !(v.name in resolved));

  if (missing.length === 0) return resolved;

  const rl = createInterface({ input, output });

  try {
    for (const variable of missing) {
      const prompt = variable.description
        ? `${variable.description}`
        : variable.name;
      const defaultHint = variable.default ? ` (default: ${variable.default})` : '';
      const requiredHint = variable.required ? ' [required]' : '';

      const answer = await rl.question(`  ${prompt}${defaultHint}${requiredHint}: `);

      if (answer.trim()) {
        resolved[variable.name] = answer.trim();
      } else if (variable.default) {
        resolved[variable.name] = variable.default;
      } else if (variable.required) {
        logger.error(`Variable "${variable.name}" is required but no value provided.`);
        throw new Error(`Missing required variable: ${variable.name}`);
      }
    }
  } finally {
    rl.close();
  }

  return resolved;
}

// ─── Parse --var flags ──────────────────────────────────

/**
 * Parse --var key=value flags into a record.
 */
export function parseVarFlags(varFlags: string[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!varFlags) return result;

  for (const flag of varFlags) {
    const eqIndex = flag.indexOf('=');
    if (eqIndex === -1) {
      logger.warn(`Ignoring invalid --var flag: ${flag} (expected key=value format)`);
      continue;
    }
    const key = flag.slice(0, eqIndex).trim();
    const value = flag.slice(eqIndex + 1);
    result[key] = value;
  }

  return result;
}

// ─── Auto-detect variables from file content ────────────

/**
 * Find all {{variableName}} patterns in content (excluding transforms).
 */
export function detectVariables(content: string): string[] {
  const vars = new Set<string>();
  // Match simple {{varName}} (not {{pascal var}} or {{camel var}})
  const simplePattern = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = simplePattern.exec(content)) !== null) {
    vars.add(match[1]!);
  }
  // Match {{pascal var}} and {{camel var}} — extract the inner var
  const transformPattern = /\{\{(?:pascal|camel)\s+(\w+)\}\}/g;
  while ((match = transformPattern.exec(content)) !== null) {
    vars.add(match[1]!);
  }
  return [...vars];
}

// ─── Module Exports ─────────────────────────────────────

export const scaffoldModule = {
  /**
   * List available templates (built-in + custom).
   */
  async list(options: { tags?: string[] }): Promise<void> {
    const templates = await getAllTemplates();

    let filtered = templates;
    if (options.tags && options.tags.length > 0) {
      const filterTags = new Set(options.tags);
      filtered = templates.filter(
        (t) => t.tags?.some((tag) => filterTags.has(tag)),
      );
    }

    if (filtered.length === 0) {
      logger.warn('No templates found.');
      return;
    }

    logger.heading('Available Templates');

    for (const template of filtered) {
      const tags = template.tags?.length ? ` [${template.tags.join(', ')}]` : '';
      logger.info(`  ${template.name}${tags}`);
      if (template.description) {
        logger.dim(`    ${template.description}`);
      }
    }

    logger.dim(`\n  ${filtered.length} template(s) found. Use: devhammer scaffold <name>`);
  },

  /**
   * Scaffold a project from a template.
   */
  async scaffold(
    templateName: string,
    options: { dryRun?: boolean; var?: string[]; output?: string },
  ): Promise<void> {
    const template = await findTemplate(templateName);
    if (!template) {
      logger.error(`Template not found: ${templateName}`);
      logger.dim('Use "devhammer scaffold list" to see available templates.');
      return;
    }

    // Parse --var flags
    const providedVars = parseVarFlags(options.var);

    // Collect missing variables interactively
    let resolvedVars: Record<string, string>;
    try {
      resolvedVars = await collectVariables(template.variables, providedVars);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Variable collection failed';
      logger.error(msg);
      return;
    }

    const outputDir = resolve(options.output ?? '.');

    // Filter files by conditions
    const activeFiles = template.files.filter((file) => {
      if (!file.condition) return true;
      return evaluateCondition(file.condition, resolvedVars);
    });

    if (activeFiles.length === 0) {
      logger.warn('No files to generate (all files were filtered by conditions).');
      return;
    }

    // Generate files
    const createdFiles: string[] = [];

    for (const file of activeFiles) {
      const filePath = interpolate(file.path, resolvedVars);
      const content = evaluateConditionals(file.content, resolvedVars);
      const finalContent = interpolate(content, resolvedVars);
      const fullPath = join(outputDir, filePath);

      if (options.dryRun) {
        createdFiles.push(filePath);
        logger.dim(`  Would create: ${filePath}`);
      } else {
        await ensureDir(join(outputDir, filePath.split('/').slice(0, -1).join('/')));
        await writeFile(fullPath, finalContent, 'utf-8');
        createdFiles.push(filePath);
        logger.success(`  Created: ${filePath}`);
      }
    }

    if (options.dryRun) {
      logger.info('\nDry run — no files were written.');
    }

    logger.dim(`\nNext steps:`);
    logger.dim(`  Review the generated files and adjust as needed.`);
    if (templateName === 'react-component') {
      logger.dim(`  Import your component and start building!`);
    }
  },

  /**
   * Create a custom template from the current project directory.
   */
  async create(
    name: string,
    options: { description?: string; tags?: string[] },
  ): Promise<void> {
    const rootDir = process.cwd();
    const templateDir = join(rootDir, CUSTOM_TEMPLATES_DIR, name);

    if (existsSync(templateDir)) {
      logger.error(`Template "${name}" already exists at ${CUSTOM_TEMPLATES_DIR}/${name}`);
      return;
    }

    // Collect files from current directory
    const files: Array<{ path: string; content: string }> = [];
    const allDetectedVars = new Set<string>();

    function walkDir(dir: string, basePath: string): void {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

        const fullPath = join(dir, entry.name);
        const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          walkDir(fullPath, relPath);
        } else if (entry.isFile()) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const detected = detectVariables(content);
            // Also detect in path
            const pathDetected = detectVariables(relPath);
            for (const v of [...detected, ...pathDetected]) {
              allDetectedVars.add(v);
            }
            files.push({ path: relPath, content });
          } catch {
            // Skip binary or unreadable files
          }
        }
      }
    }

    walkDir(rootDir, '');

    if (files.length === 0) {
      logger.warn('No files found to include in the template.');
      return;
    }

    // Build variables from detected patterns
    const variables: TemplateVariable[] = [...allDetectedVars].map((varName) => ({
      name: varName,
      description: `Value for ${varName}`,
      required: true,
      type: 'string' as const,
    }));

    // Build manifest
    const manifest: TemplateManifest = {
      name,
      version: '1.0.0',
      description: options.description ?? `Custom template: ${name}`,
      tags: options.tags,
      variables,
      files,
    };

    // Save
    await ensureDir(templateDir);
    await writeJson(join(templateDir, 'manifest.json'), manifest);

    logger.success(`Template "${name}" created with ${files.length} file(s).`);
    if (allDetectedVars.size > 0) {
      logger.dim(`  Detected variables: ${[...allDetectedVars].join(', ')}`);
    }
    logger.dim(`  Saved to: ${CUSTOM_TEMPLATES_DIR}/${name}/manifest.json`);
  },
};
