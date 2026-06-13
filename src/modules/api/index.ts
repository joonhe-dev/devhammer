// devhammer — API Tester Module
// Test API endpoints from the terminal

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { logger } from '../../utils/logger.js';
import {
  request,
  parseHeaders,
  substituteEnvVars,
  type HttpResponse,
} from '../../utils/http.js';
import { ensureDir, readJson, writeJson, fileExists } from '../../utils/fs.js';
import type { APIHistoryEntry } from '../../types.js';

// ── Types ────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiOptions {
  verbose: boolean;
  json: boolean;
  header?: string[];
  query?: string[];
  timeout?: number;
  rootDir: string;
}

// ── Constants ────────────────────────────────────────────────────────

const HISTORY_DIR = '.devhammer';
const HISTORY_FILE = 'api-history.json';
const MAX_HISTORY_ENTRIES = 100;

// ── .env loader ──────────────────────────────────────────────────────

async function loadEnvFile(rootDir: string): Promise<Record<string, string>> {
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) return {};

  try {
    const content = await readFile(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

function applyEnvSubstitution(str: string, env: Record<string, string>): string {
  return substituteEnvVars(str, env);
}

// ── @file body loader ────────────────────────────────────────────────

async function resolveBody(bodyData: string, rootDir: string, env: Record<string, string>): Promise<unknown> {
  const resolved = applyEnvSubstitution(bodyData, env);

  // If body starts with @, read from file
  if (resolved.startsWith('@')) {
    const filePath = resolved.slice(1);
    const absPath = filePath.startsWith('/') ? filePath : join(rootDir, filePath);
    try {
      const content = await readFile(absPath, 'utf-8');
      // Try to parse as JSON
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    } catch (err) {
      throw new Error(`Failed to read body file: ${filePath}`);
    }
  }

  // Try to parse as JSON
  try {
    return JSON.parse(resolved);
  } catch {
    return resolved;
  }
}

// ── History persistence ──────────────────────────────────────────────

function getHistoryPath(rootDir: string): string {
  return join(rootDir, HISTORY_DIR, HISTORY_FILE);
}

async function loadHistory(rootDir: string): Promise<APIHistoryEntry[]> {
  const filePath = getHistoryPath(rootDir);
  if (!fileExists(filePath)) {
    return [];
  }
  try {
    return await readJson<APIHistoryEntry[]>(filePath);
  } catch {
    return [];
  }
}

async function saveHistory(entry: APIHistoryEntry, rootDir: string): Promise<void> {
  const history = await loadHistory(rootDir);
  history.push(entry);

  // Keep only the last MAX_HISTORY_ENTRIES entries
  const trimmed = history.slice(-MAX_HISTORY_ENTRIES);

  const dir = join(rootDir, HISTORY_DIR);
  await ensureDir(dir);
  await writeJson(getHistoryPath(rootDir), trimmed);
}

// ── Query param parser ───────────────────────────────────────────────

function parseQueryParams(queryArgs: string[] | undefined, env: Record<string, string>): Record<string, string> | undefined {
  if (!queryArgs || queryArgs.length === 0) return undefined;

  const result: Record<string, string> = {};
  for (const pair of queryArgs) {
    const resolved = applyEnvSubstitution(pair, env);
    const eqIndex = resolved.indexOf('=');
    if (eqIndex === -1) {
      logger.warn(`Ignoring malformed query param: "${pair}". Expected "key=value" format.`);
      continue;
    }
    const key = resolved.slice(0, eqIndex).trim();
    const value = resolved.slice(eqIndex + 1).trim();
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ── Output formatting ────────────────────────────────────────────────

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return '\x1b[32m';
  if (status >= 300 && status < 400) return '\x1b[33m';
  return '\x1b[31m';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

function printResponse(response: HttpResponse, options: ApiOptions): void {
  if (options.json) {
    const output = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      duration: response.duration,
      size: response.size,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  const color = statusColor(response.status);
  logger.info(`${color}${response.status}${RESET} ${response.statusText}`);
  logger.dim(`Duration: ${response.duration}ms | Size: ${formatSize(response.size)}`);

  if (options.verbose) {
    console.log(`\n${CYAN}${BOLD}Response Headers:${RESET}`);
    for (const [key, value] of Object.entries(response.headers)) {
      console.log(`  ${GRAY}${key}:${RESET} ${value}`);
    }
  }

  console.log(`\n${CYAN}${BOLD}Body:${RESET}`);
  if (typeof response.body === 'object' && response.body !== null) {
    console.log(JSON.stringify(response.body, null, 2));
  } else {
    console.log(String(response.body));
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Send an HTTP request and display the formatted response.
 * Persists the request/response to the history file.
 */
export async function executeApiRequest(
  method: HttpMethod,
  url: string,
  bodyData?: string,
  options?: Partial<ApiOptions>,
): Promise<void> {
  const opts: ApiOptions = {
    verbose: false,
    json: false,
    rootDir: process.cwd(),
    ...options,
  };

  const env = await loadEnvFile(opts.rootDir);
  const resolvedUrl = applyEnvSubstitution(url, env);

  // Parse headers with env substitution
  const headers = opts.header ? parseHeaders(opts.header.map((h) => applyEnvSubstitution(h, env))) : undefined;
  const query = parseQueryParams(opts.query, env);

  // Resolve body
  let parsedBody: unknown;
  if (bodyData) {
    parsedBody = await resolveBody(bodyData, opts.rootDir, env);
  }

  try {
    logger.info(`${method} ${resolvedUrl}`);

    const response = await request({
      method,
      url: resolvedUrl,
      headers,
      body: parsedBody,
      query,
      timeout: opts.timeout,
    });

    printResponse(response, opts);

    // Save to history
    const entry: APIHistoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      request: {
        method,
        url: resolvedUrl,
        headers,
        body: parsedBody,
        query,
        timeout: opts.timeout,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        duration: response.duration,
        size: response.size,
      },
    };

    await saveHistory(entry, opts.rootDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
  }
}

/**
 * Send a GraphQL query/mutation to the given endpoint.
 */
export async function executeGraphQL(
  url: string,
  queryStr: string,
  variablesStr?: string,
  options?: Partial<ApiOptions>,
): Promise<void> {
  const opts: ApiOptions = {
    verbose: false,
    json: false,
    rootDir: process.cwd(),
    ...options,
  };

  const env = await loadEnvFile(opts.rootDir);

  // Resolve query string — support @file syntax
  let resolvedQuery = applyEnvSubstitution(queryStr, env);
  if (resolvedQuery.startsWith('@')) {
    const filePath = resolvedQuery.slice(1);
    const absPath = filePath.startsWith('/') ? filePath : join(opts.rootDir, filePath);
    try {
      resolvedQuery = await readFile(absPath, 'utf-8');
    } catch {
      logger.error(`Failed to read query file: ${filePath}`);
      return;
    }
  }

  // Parse variables
  let variables: Record<string, unknown> | undefined;
  if (variablesStr) {
    const resolvedVars = applyEnvSubstitution(variablesStr, env);
    try {
      variables = JSON.parse(resolvedVars);
    } catch {
      logger.error('Invalid JSON for --variables');
      return;
    }
  }

  const body = {
    query: resolvedQuery,
    ...(variables ? { variables } : {}),
  };

  const headerArgs = [...(opts.header ?? []), 'Content-Type: application/json'];
  const mergedOpts: Partial<ApiOptions> = {
    ...opts,
    header: headerArgs,
  };

  await executeApiRequest('POST', url, JSON.stringify(body), mergedOpts);
}

/**
 * Display the API request history from the persisted file.
 */
export async function showHistory(options?: Partial<ApiOptions>): Promise<void> {
  const rootDir = options?.rootDir ?? process.cwd();
  const history = await loadHistory(rootDir);

  if (history.length === 0) {
    logger.info('No request history found.');
    return;
  }

  if (options?.json) {
    console.log(JSON.stringify(history, null, 2));
    return;
  }

  logger.heading('API Request History');

  const data = history.map((entry) => ({
    Method: entry.request.method,
    URL: entry.request.url.length > 50 ? entry.request.url.slice(0, 47) + '...' : entry.request.url,
    Status: String(entry.response.status),
    Duration: `${entry.response.duration}ms`,
    Time: new Date(entry.timestamp).toLocaleString(),
  }));

  logger.table(data as Record<string, unknown>[]);
}

// Export internals for testing
export const _internal = {
  loadEnvFile,
  applyEnvSubstitution,
  resolveBody,
  parseQueryParams,
  loadHistory,
  saveHistory,
  getHistoryPath,
};
