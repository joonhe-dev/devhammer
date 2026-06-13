import { Command } from 'commander';
import { executeApiRequest, executeGraphQL, showHistory } from '../modules/api/index.js';

/**
 * Register the `devhammer api` command and its subcommands
 * with the Commander program.
 */
export function registerApiCommand(program: Command): void {
  const apiCmd = program
    .command('api')
    .description('Test API endpoints from the terminal');

  // ── GET ──────────────────────────────────────────────────────────
  apiCmd
    .command('get <url>')
    .description('Send a GET request')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('-q, --query-param <queries...>', 'Query parameters in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeApiRequest('GET', url, undefined, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        query: opts.queryParam,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── POST ─────────────────────────────────────────────────────────
  apiCmd
    .command('post <url>')
    .description('Send a POST request with body')
    .option('-b, --body <body>', 'Request body (JSON string or raw text)')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('-q, --query-param <queries...>', 'Query parameters in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeApiRequest('POST', url, opts.body, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        query: opts.queryParam,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── PUT ──────────────────────────────────────────────────────────
  apiCmd
    .command('put <url>')
    .description('Send a PUT request with body')
    .option('-b, --body <body>', 'Request body (JSON string or raw text)')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('-q, --query-param <queries...>', 'Query parameters in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeApiRequest('PUT', url, opts.body, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        query: opts.queryParam,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── PATCH ────────────────────────────────────────────────────────
  apiCmd
    .command('patch <url>')
    .description('Send a PATCH request with body')
    .option('-b, --body <body>', 'Request body (JSON string or raw text)')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('-q, --query-param <queries...>', 'Query parameters in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeApiRequest('PATCH', url, opts.body, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        query: opts.queryParam,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── DELETE ───────────────────────────────────────────────────────
  apiCmd
    .command('delete <url>')
    .description('Send a DELETE request')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('-q, --query-param <queries...>', 'Query parameters in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeApiRequest('DELETE', url, undefined, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        query: opts.queryParam,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── GRAPHQL ──────────────────────────────────────────────────────
  apiCmd
    .command('graphql <url>')
    .description('Send a GraphQL query/mutation')
    .requiredOption('--query-str <query>', 'GraphQL query string')
    .option('--variables <json>', 'GraphQL variables as JSON string')
    .option('-H, --header <headers...>', 'Request headers in "Key: Value" format')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--verbose', 'Show response headers')
    .option('--json', 'Output raw JSON for piping')
    .action(async (url, opts) => {
      await executeGraphQL(url, opts.queryStr, opts.variables, {
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
        header: opts.header,
        timeout: opts.timeout,
        rootDir: process.cwd(),
      });
    });

  // ── HISTORY ──────────────────────────────────────────────────────
  apiCmd
    .command('history')
    .description('Show request history')
    .option('--json', 'Output raw JSON for piping')
    .action(async (opts) => {
      await showHistory({
        json: opts.json ?? false,
        rootDir: process.cwd(),
      });
    });
}
