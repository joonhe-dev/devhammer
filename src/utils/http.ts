// devhammer — HTTP Request Utility
// Lightweight HTTP client using node:http / node:https
// No external dependencies

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  size: number;
}

/**
 * Perform an HTTP request using Node.js built-in modules
 */
export function request(options: HttpRequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const parsedUrl = new URL(options.url);

    // Apply query parameters
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        parsedUrl.searchParams.set(key, value);
      }
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const bodyData = options.body ? JSON.stringify(options.body) : undefined;

    const reqOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers: {
        ...(bodyData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) } : {}),
        ...options.headers,
      },
      timeout: options.timeout ?? 30000,
    };

    const req = client.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8');
        const duration = Date.now() - startTime;

        // Parse headers
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value)) {
            headers[key] = value.join(', ');
          }
        }

        // Try to parse JSON
        let body: unknown = rawBody;
        try {
          body = JSON.parse(rawBody);
        } catch {
          // Keep as string if not valid JSON
        }

        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers,
          body,
          duration,
          size: Buffer.byteLength(rawBody),
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${options.timeout ?? 30000}ms`));
    });

    if (bodyData) {
      req.write(bodyData);
    }

    req.end();
  });
}

export type HttpMethod = HttpRequestOptions['method'];

/** Alias for request() — used by other modules */
export const sendRequest = request;

/**
 * Substitute {{VARIABLE}} placeholders in a string from env-like object
 */
export function substituteEnvVars(template: string, env: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return env[key] ?? match;
  });
}

/**
 * Parse header strings in "key:value" format into a record
 */
export function parseHeaders(headerArgs: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const arg of headerArgs) {
    const colonIndex = arg.indexOf(':');
    if (colonIndex > 0) {
      const key = arg.slice(0, colonIndex).trim();
      const value = arg.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
}
