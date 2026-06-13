// devhammer — Config Generator Module
// Generates framework-aware configuration files

import { join } from 'node:path';
import { logger } from '../../utils/logger.js';
import { detectProject, type ProjectInfo } from '../../utils/config.js';
import { writeFileContent, fileExists } from '../../utils/fs.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ConfigOptions {
  dryRun?: boolean;
  force?: boolean;
  rootDir?: string;
}

type ConfigType = 'eslint' | 'prettier' | 'tsconfig' | 'tailwind';

// ── Helpers ──────────────────────────────────────────────────────────

async function writeConfigFile(
  filePath: string,
  content: string,
  options: ConfigOptions,
): Promise<boolean> {
  if (options.dryRun) {
    logger.dim(`[dry-run] Would write to ${filePath}`);
    logger.dim(content);
    return true;
  }

  if (fileExists(filePath) && !options.force) {
    logger.warn(`File already exists: ${filePath}. Use --force to overwrite.`);
    return false;
  }

  await writeFileContent(filePath, content);
  logger.success(`Created ${filePath}`);
  return true;
}

// ── ESLint Config Generator ──────────────────────────────────────────

function generateEslintContent(framework: ProjectInfo['framework']): string {
  let eslintConfig: Record<string, unknown>;

  switch (framework) {
    case 'next':
      eslintConfig = {
        extends: ['next/core-web-vitals'],
      };
      break;
    case 'vite':
    case 'remix':
      eslintConfig = {
        extends: ['eslint:recommended', '@typescript-eslint/recommended'],
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      };
      break;
    case 'node':
    default:
      eslintConfig = {
        extends: [
          'eslint:recommended',
          '@typescript-eslint/recommended',
          'plugin:node/recommended',
        ],
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      };
      break;
  }

  return JSON.stringify(eslintConfig, null, 2) + '\n';
}

async function eslint(options: ConfigOptions): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const project = await detectProject(rootDir);
  const content = generateEslintContent(project.framework);
  const filePath = join(rootDir, '.eslintrc.json');

  logger.info(`Generating eslint config for ${project.framework} project...`);
  await writeConfigFile(filePath, content, options);
}

// ── Prettier Config Generator ────────────────────────────────────────

function generatePrettierContent(): string {
  const prettierConfig = {
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
    tabWidth: 2,
  };

  return JSON.stringify(prettierConfig, null, 2) + '\n';
}

async function prettier(options: ConfigOptions): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const content = generatePrettierContent();
  const filePath = join(rootDir, '.prettierrc');

  logger.info('Generating prettier config...');
  await writeConfigFile(filePath, content, options);
}

// ── TSConfig Generator ───────────────────────────────────────────────

function generateTsconfigContent(framework: ProjectInfo['framework']): string {
  let tsconfig: Record<string, unknown>;

  switch (framework) {
    case 'next':
      tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'preserve',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src', 'next-env.d.ts'],
        exclude: ['node_modules'],
      };
      break;
    case 'vite':
    case 'remix':
      tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
        },
        include: ['src'],
        exclude: ['node_modules'],
      };
      break;
    case 'node':
    default:
      tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true,
        },
        include: ['src'],
        exclude: ['node_modules'],
      };
      break;
  }

  return JSON.stringify(tsconfig, null, 2) + '\n';
}

async function tsconfig(options: ConfigOptions): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const project = await detectProject(rootDir);
  const content = generateTsconfigContent(project.framework);
  const filePath = join(rootDir, 'tsconfig.json');

  logger.info(`Generating tsconfig for ${project.framework} project...`);
  await writeConfigFile(filePath, content, options);
}

// ── Tailwind Config Generator ────────────────────────────────────────

function generateTailwindContent(framework: ProjectInfo['framework']): string {
  let content: string[];

  switch (framework) {
    case 'next':
      content = ['./src/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'];
      break;
    case 'vite':
    case 'remix':
      content = ['./index.html', './src/**/*.{js,ts,jsx,tsx}'];
      break;
    case 'node':
    default:
      content = ['./src/**/*.{js,ts,jsx,tsx}'];
      break;
  }

  const lines = [
    'import type { Config } from "tailwindcss";',
    '',
    'export default {',
    '  content: [',
    ...content.map((p) => `    '${p}',`),
    '  ],',
    '  theme: {',
    '    extend: {},',
    '  },',
    '  plugins: [],',
    '} satisfies Config;',
    '',
  ];

  return lines.join('\n');
}

async function tailwind(options: ConfigOptions): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const project = await detectProject(rootDir);
  const content = generateTailwindContent(project.framework);
  const filePath = join(rootDir, 'tailwind.config.ts');

  logger.info(`Generating tailwind config for ${project.framework} project...`);
  await writeConfigFile(filePath, content, options);
}

// ── Generate All Configs ─────────────────────────────────────────────

async function all(options: ConfigOptions): Promise<void> {
  const rootDir = options.rootDir ?? process.cwd();
  const project = await detectProject(rootDir);

  logger.heading(`Generating all configs for ${project.framework} project`);

  await eslint(options);
  await prettier(options);
  await tsconfig(options);

  // Only generate tailwind config for Next.js projects
  if (project.framework === 'next') {
    await tailwind(options);
  } else {
    logger.dim('Skipping tailwind config (not a Next.js project)');
  }
}

// ── Public API ───────────────────────────────────────────────────────

export async function generateConfig(
  type: ConfigType,
  options: ConfigOptions,
): Promise<void> {
  switch (type) {
    case 'eslint':
      await eslint(options);
      break;
    case 'prettier':
      await prettier(options);
      break;
    case 'tsconfig':
      await tsconfig(options);
      break;
    case 'tailwind':
      await tailwind(options);
      break;
  }
}

export async function generateAllConfigs(options: ConfigOptions): Promise<void> {
  await all(options);
}

export function listConfigTypes(): void {
  logger.heading('Available Config Types');
  logger.info('  eslint   - Generate .eslintrc.json with framework-aware rules');
  logger.info('  prettier - Generate .prettierrc with sensible defaults');
  logger.info('  tsconfig - Generate tsconfig.json for the detected environment');
  logger.info('  tailwind - Generate tailwind.config.ts with content paths');
  logger.info('  all      - Generate all config files with consistent settings');
  logger.dim('\nUse --dry-run to preview without writing files');
  logger.dim('Use --force to overwrite existing files');
}

// Export internal generators for testing
export const _internal = {
  generateEslintContent,
  generatePrettierContent,
  generateTsconfigContent,
  generateTailwindContent,
  writeConfigFile,
};
