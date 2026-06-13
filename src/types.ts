// devhammer — Shared Type Definitions
// All TypeScript interfaces from spec/data-model.md

import type { Command } from 'commander';

// ─── Core ───────────────────────────────────────────────

export interface ProjectConfig {
  $schema?: string;
  framework?: 'next' | 'remix' | 'vite' | 'node';
  packageManager?: 'pnpm' | 'yarn' | 'npm';
  tsVersion?: string;
  modules?: {
    config?: ConfigModuleConfig;
    api?: ApiModuleConfig;
    scaffold?: ScaffoldModuleConfig;
    profile?: ProfileModuleConfig;
    env?: EnvModuleConfig;
  };
}

// ─── Module Interface ───────────────────────────────────

export interface DevhammerModule {
  /** Module name (e.g., 'config', 'api') */
  name: string;
  /** Module version */
  version: string;
  /** Register CLI commands with the Commander program */
  register(program: Command): void;
  /** Initialize module with project config (optional) */
  init?(config: ProjectConfig): void | Promise<void>;
}

// ─── Config Module ──────────────────────────────────────

export interface ConfigModuleConfig {
  eslint?: {
    extends?: string[];
    rules?: Record<string, unknown>;
    ignorePatterns?: string[];
  };
  prettier?: {
    semi?: boolean;
    singleQuote?: boolean;
    trailingComma?: 'all' | 'es5' | 'none';
    printWidth?: number;
    tabWidth?: number;
  };
  tsconfig?: {
    target?: string;
    module?: string;
    strict?: boolean;
    paths?: Record<string, string[]>;
  };
  tailwind?: {
    content?: string[];
    theme?: Record<string, unknown>;
    plugins?: string[];
  };
}

export interface ConfigTemplate {
  name: string;
  description: string;
  framework?: string;
  files: Record<string, string>;
}

// ─── API Module ─────────────────────────────────────────

export interface ApiModuleConfig {
  defaultHeaders?: Record<string, string>;
  historyLimit?: number;
  timeout?: number;
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
}

export interface GraphQLRequest extends Omit<APIRequest, 'query' | 'method'> {
  method: 'POST';
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  size: number;
}

export interface APIHistoryEntry {
  id: string;
  timestamp: number;
  request: APIRequest;
  response: APIResponse;
}

// ─── Scaffold Module ────────────────────────────────────

export interface ScaffoldModuleConfig {
  customTemplatesDir?: string;
}

export interface TemplateManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  variables: TemplateVariable[];
  files: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
  condition?: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  default?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'path';
}

// ─── Profile Module ─────────────────────────────────────

export interface ProfileModuleConfig {
  historyDir?: string;
  bundleWarningKB?: number;
  depsWarningCount?: number;
  startupWarningMs?: number;
}

export interface ProfileReport {
  timestamp: number;
  bundle?: BundleAnalysis;
  deps?: DepsAnalysis;
  startup?: StartupAnalysis;
}

export interface BundleAnalysis {
  totalSize: number;
  files: Array<{
    path: string;
    size: number;
    gzipSize: number;
  }>;
}

export interface DepsAnalysis {
  totalSize: number;
  count: number;
  duplicates: Array<{
    name: string;
    versions: string[];
  }>;
  large: Array<{
    name: string;
    size: number;
  }>;
}

export interface StartupAnalysis {
  avgMs: number;
  minMs: number;
  maxMs: number;
  runs: number;
}

// ─── Env Module ─────────────────────────────────────────

export interface EnvModuleConfig {
  encryptionKeyEnv?: string;
  encryptedFileSuffix?: string;
}

export interface EnvSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'url' | 'path';
    required?: boolean;
    description?: string;
    default?: string;
  };
}

export interface EnvDiffResult {
  missing: string[];
  extra: string[];
  changed: Array<{
    key: string;
    expected: string;
    actual: string;
  }>;
}
