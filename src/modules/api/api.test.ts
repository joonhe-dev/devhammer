import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseHeaders, substituteEnvVars } from '../../utils/http.js';

// ── Pure function tests (no mocking needed) ──────────────────────────

describe('parseHeaders', () => {
  it('should parse headers in "Key: Value" format', () => {
    const result = parseHeaders(['Content-Type: application/json', 'Authorization: Bearer token123']);
    expect(result).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token123',
    });
  });

  it('should skip malformed headers without colon', () => {
    const result = parseHeaders(['invalid-header', 'Valid: value']);
    expect(result).toEqual({ Valid: 'value' });
  });

  it('should return empty object for empty array', () => {
    const result = parseHeaders([]);
    expect(result).toEqual({});
  });

  it('should handle colon in value', () => {
    const result = parseHeaders(['X-Custom: key:value']);
    expect(result).toEqual({ 'X-Custom': 'key:value' });
  });
});

describe('substituteEnvVars', () => {
  it('should replace {{VARIABLE}} placeholders', () => {
    const result = substituteEnvVars('https://{{HOST}}/api/{{VERSION}}', {
      HOST: 'api.example.com',
      VERSION: 'v2',
    });
    expect(result).toBe('https://api.example.com/api/v2');
  });

  it('should leave unreplaced placeholders as-is', () => {
    const result = substituteEnvVars('https://{{UNKNOWN}}/api', { OTHER: 'value' });
    expect(result).toBe('https://{{UNKNOWN}}/api');
  });

  it('should handle strings without placeholders', () => {
    const result = substituteEnvVars('https://example.com/api', { KEY: 'value' });
    expect(result).toBe('https://example.com/api');
  });

  it('should replace multiple occurrences of same variable', () => {
    const result = substituteEnvVars('{{HOST}}/{{HOST}}', { HOST: 'test' });
    expect(result).toBe('test/test');
  });
});

// ── Module-level tests with mocking ──────────────────────────────────

vi.mock('../../utils/http.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/http.js')>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

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

import { _internal, executeApiRequest, executeGraphQL, showHistory } from './index.js';
import { request } from '../../utils/http.js';
import { fileExists, readJson, writeJson, ensureDir } from '../../utils/fs.js';
import type { APIHistoryEntry } from '../../types.js';

describe('API Tester Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fileExists).mockReturnValue(false);
    vi.mocked(writeJson).mockResolvedValue(undefined);
    vi.mocked(ensureDir).mockResolvedValue(undefined);
  });

  // ── Env var substitution wrapper ───────────────────────────────────

  describe('applyEnvSubstitution', () => {
    it('should substitute {{VAR}} patterns in URL strings', () => {
      const result = _internal.applyEnvSubstitution('https://{{HOST}}/api', { HOST: 'example.com' });
      expect(result).toBe('https://example.com/api');
    });
  });

  // ── parseQueryParams ───────────────────────────────────────────────

  describe('parseQueryParams', () => {
    it('should parse key=value query params', () => {
      const result = _internal.parseQueryParams(['page=1', 'limit=10'], {});
      expect(result).toEqual({ page: '1', limit: '10' });
    });

    it('should support env var substitution in query params', () => {
      const result = _internal.parseQueryParams(['token={{API_KEY}}'], { API_KEY: 'secret' });
      expect(result).toEqual({ token: 'secret' });
    });

    it('should return undefined for empty input', () => {
      const result = _internal.parseQueryParams(undefined, {});
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      const result = _internal.parseQueryParams([], {});
      expect(result).toBeUndefined();
    });

    it('should warn on malformed query params without equals sign', () => {
      const result = _internal.parseQueryParams(['noequals'], {});
      expect(result).toBeUndefined();
    });
  });

  // ── History persistence ────────────────────────────────────────────

  describe('loadHistory', () => {
    it('should return empty array when no history file exists', async () => {
      vi.mocked(fileExists).mockReturnValue(false);
      const history = await _internal.loadHistory('/test');
      expect(history).toEqual([]);
    });

    it('should load history from file', async () => {
      vi.mocked(fileExists).mockReturnValue(true);
      const mockHistory: APIHistoryEntry[] = [
        {
          id: 'abc123',
          timestamp: Date.now(),
          request: { method: 'GET', url: 'https://example.com' },
          response: { status: 200, statusText: 'OK', headers: {}, body: null, duration: 100, size: 50 },
        },
      ];
      vi.mocked(readJson).mockResolvedValue(mockHistory);

      const history = await _internal.loadHistory('/test');
      expect(history).toEqual(mockHistory);
    });

    it('should return empty array on read error', async () => {
      vi.mocked(fileExists).mockReturnValue(true);
      vi.mocked(readJson).mockRejectedValue(new Error('Parse error'));

      const history = await _internal.loadHistory('/test');
      expect(history).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('should append entry and persist to disk', async () => {
      vi.mocked(fileExists).mockReturnValue(false);

      const entry: APIHistoryEntry = {
        id: 'new1',
        timestamp: Date.now(),
        request: { method: 'POST', url: 'https://example.com' },
        response: { status: 201, statusText: 'Created', headers: {}, body: null, duration: 50, size: 20 },
      };

      await _internal.saveHistory(entry, '/test');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });

    it('should trim to max entries', async () => {
      vi.mocked(fileExists).mockReturnValue(true);
      const existingHistory: APIHistoryEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${i}`,
        timestamp: Date.now() - i * 1000,
        request: { method: 'GET', url: 'https://example.com' },
        response: { status: 200, statusText: 'OK', headers: {}, body: null, duration: 50, size: 10 },
      }));
      vi.mocked(readJson).mockResolvedValue(existingHistory);

      const newEntry: APIHistoryEntry = {
        id: 'new1',
        timestamp: Date.now(),
        request: { method: 'POST', url: 'https://example.com' },
        response: { status: 201, statusText: 'Created', headers: {}, body: null, duration: 50, size: 20 },
      };

      await _internal.saveHistory(newEntry, '/test');

      // Check that writeJson was called with trimmed array
      const savedData = vi.mocked(writeJson).mock.calls[0]![1] as APIHistoryEntry[];
      expect(savedData).toHaveLength(100);
      expect(savedData[99]!.id).toBe('new1');
    });
  });

  describe('getHistoryPath', () => {
    it('should return path containing .devhammer and api-history.json', () => {
      const path = _internal.getHistoryPath('/project');
      expect(path).toContain('.devhammer');
      expect(path).toContain('api-history.json');
    });
  });

  // ── executeApiRequest ──────────────────────────────────────────────

  describe('executeApiRequest', () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { message: 'success' },
      duration: 100,
      size: 50,
    };

    it('should make GET request and save history', async () => {
      vi.mocked(request).mockResolvedValue(mockResponse);

      await executeApiRequest('GET', 'https://api.example.com/data', undefined, {
        rootDir: '/test',
        json: true,
      });

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/data',
        }),
      );
    });

    it('should make POST request with JSON body', async () => {
      vi.mocked(request).mockResolvedValue(mockResponse);

      await executeApiRequest('POST', 'https://api.example.com/data', '{"name":"test"}', {
        rootDir: '/test',
        header: ['Content-Type: application/json'],
      });

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          body: { name: 'test' },
        }),
      );
    });

    it('should handle request errors gracefully', async () => {
      vi.mocked(request).mockRejectedValue(new Error('Network error'));

      // Should not throw
      await executeApiRequest('GET', 'https://api.example.com/fail', undefined, {
        rootDir: '/test',
      });

      expect(request).toHaveBeenCalled();
    });

    it('should parse headers from options', async () => {
      vi.mocked(request).mockResolvedValue(mockResponse);

      await executeApiRequest('GET', 'https://api.example.com/data', undefined, {
        rootDir: '/test',
        header: ['Authorization: Bearer token'],
      });

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        }),
      );
    });
  });

  // ── executeGraphQL ─────────────────────────────────────────────────

  describe('executeGraphQL', () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: { data: { user: { name: 'Alice' } } },
      duration: 80,
      size: 40,
    };

    it('should send GraphQL query as POST', async () => {
      vi.mocked(request).mockResolvedValue(mockResponse);

      await executeGraphQL('https://api.example.com/graphql', '{ user { name } }', undefined, {
        rootDir: '/test',
      });

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            query: '{ user { name } }',
          }),
        }),
      );
    });

    it('should include variables when provided', async () => {
      vi.mocked(request).mockResolvedValue(mockResponse);

      await executeGraphQL(
        'https://api.example.com/graphql',
        'query($id: ID!) { user(id: $id) { name } }',
        '{"id":"1"}',
        { rootDir: '/test' },
      );

      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            variables: { id: '1' },
          }),
        }),
      );
    });

    it('should reject invalid variables JSON', async () => {
      await executeGraphQL('https://api.example.com/graphql', '{ user { name } }', 'not-json', {
        rootDir: '/test',
      });

      expect(request).not.toHaveBeenCalled();
    });
  });

  // ── showHistory ────────────────────────────────────────────────────

  describe('showHistory', () => {
    it('should show message when no history exists', async () => {
      vi.mocked(fileExists).mockReturnValue(false);
      await showHistory({ rootDir: '/test' });
      // Should complete without error
    });

    it('should output JSON when --json flag is set', async () => {
      vi.mocked(fileExists).mockReturnValue(true);
      const mockHistory: APIHistoryEntry[] = [
        {
          id: 'abc',
          timestamp: Date.now(),
          request: { method: 'GET', url: 'https://example.com' },
          response: { status: 200, statusText: 'OK', headers: {}, body: null, duration: 100, size: 50 },
        },
      ];
      vi.mocked(readJson).mockResolvedValue(mockHistory);

      await showHistory({ rootDir: '/test', json: true });
      // Should complete without error
    });

    it('should display history in table format by default', async () => {
      vi.mocked(fileExists).mockReturnValue(true);
      const mockHistory: APIHistoryEntry[] = [
        {
          id: 'abc',
          timestamp: Date.now(),
          request: { method: 'GET', url: 'https://example.com' },
          response: { status: 200, statusText: 'OK', headers: {}, body: null, duration: 100, size: 50 },
        },
      ];
      vi.mocked(readJson).mockResolvedValue(mockHistory);

      await showHistory({ rootDir: '/test' });
      // Should complete without error
    });
  });
});
