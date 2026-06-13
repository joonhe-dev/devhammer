import { describe, it, expect } from 'vitest';
import { substituteEnvVars, parseHeaders } from './http.js';

describe('http utilities', () => {
  describe('substituteEnvVars', () => {
    it('substitutes {{VAR}} placeholders with env values', () => {
      const template = 'https://{{HOST}}/api/{{VERSION}}/users';
      const env = { HOST: 'api.example.com', VERSION: 'v2' };
      const result = substituteEnvVars(template, env);
      expect(result).toBe('https://api.example.com/api/v2/users');
    });

    it('leaves unknown placeholders unchanged', () => {
      const template = 'https://{{HOST}}/{{UNKNOWN}}/test';
      const env = { HOST: 'example.com' };
      const result = substituteEnvVars(template, env);
      expect(result).toBe('https://example.com/{{UNKNOWN}}/test');
    });

    it('handles empty env object', () => {
      const template = 'https://{{HOST}}/api';
      const result = substituteEnvVars(template, {});
      expect(result).toBe('https://{{HOST}}/api');
    });

    it('handles template with no placeholders', () => {
      const template = 'https://static.example.com/api';
      const env = { HOST: 'other.com' };
      const result = substituteEnvVars(template, env);
      expect(result).toBe('https://static.example.com/api');
    });

    it('handles empty string', () => {
      const result = substituteEnvVars('', { FOO: 'bar' });
      expect(result).toBe('');
    });

    it('substitutes multiple occurrences of same variable', () => {
      const template = '{{HOST}}/redirect/{{HOST}}';
      const env = { HOST: 'example.com' };
      const result = substituteEnvVars(template, env);
      expect(result).toBe('example.com/redirect/example.com');
    });

    it('only matches word characters in placeholder name', () => {
      const template = '{{MY_VAR}} and {{MY-VAR}}';
      const env = { MY_VAR: 'value1' };
      const result = substituteEnvVars(template, env);
      expect(result).toBe('value1 and {{MY-VAR}}');
    });
  });

  describe('parseHeaders', () => {
    it('parses key:value header strings', () => {
      const args = ['Content-Type:application/json', 'Authorization:Bearer token123'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
      });
    });

    it('trims whitespace around key and value', () => {
      const args = ['  Content-Type : application/json  ', 'Accept : text/html'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'text/html',
      });
    });

    it('handles values containing colons', () => {
      const args = ['X-Time:12:30:00', 'URL:http://example.com'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'X-Time': '12:30:00',
        'URL': 'http://example.com',
      });
    });

    it('skips entries without colon', () => {
      const args = ['invalid-header', 'Content-Type:application/json'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('skips entries where colon is first character', () => {
      const args = [':value-only', 'Content-Type:application/json'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('returns empty object for empty array', () => {
      const result = parseHeaders([]);
      expect(result).toEqual({});
    });

    it('handles empty string values', () => {
      const args = ['X-Empty:'];
      const result = parseHeaders(args);
      expect(result).toEqual({
        'X-Empty': '',
      });
    });
  });
});
