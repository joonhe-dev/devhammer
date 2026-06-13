// devhammer — Scaffold Module Tests
import { describe, it, expect, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  interpolate,
  evaluateCondition,
  evaluateConditionals,
  parseVarFlags,
  detectVariables,
  scaffoldModule,
} from './index.js';

// ─── Interpolation Engine Tests ─────────────────────────

describe('interpolate', () => {
  it('replaces {{variable}} with value', () => {
    expect(interpolate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple variables', () => {
    expect(
      interpolate('{{greeting}} {{name}}', { greeting: 'Hi', name: 'Test' }),
    ).toBe('Hi Test');
  });

  it('handles nested path variables', () => {
    expect(
      interpolate('src/components/{{name}}/{{name}}.tsx', { name: 'Button' }),
    ).toBe('src/components/Button/Button.tsx');
  });

  it('handles {{pascal name}} transform', () => {
    expect(interpolate('{{pascal name}}', { name: 'my-component' })).toBe('MyComponent');
  });

  it('handles {{camel name}} transform', () => {
    expect(interpolate('{{camel name}}', { name: 'my-component' })).toBe('myComponent');
  });

  it('leaves unknown variables as-is', () => {
    expect(interpolate('{{unknown}}', {})).toBe('{{unknown}}');
  });

  it('handles empty string values', () => {
    expect(interpolate('prefix/{{name}}/suffix', { name: '' })).toBe('prefix//suffix');
  });
});

describe('evaluateCondition', () => {
  it('returns true when variable matches expected value', () => {
    expect(evaluateCondition('styled=css-modules', { styled: 'css-modules' })).toBe(true);
  });

  it('returns false when variable does not match', () => {
    expect(evaluateCondition('styled=css-modules', { styled: 'tailwind' })).toBe(false);
  });

  it('returns true for truthy variable without =', () => {
    expect(evaluateCondition('withLayout', { withLayout: 'true' })).toBe(true);
  });

  it('returns false for falsy variable without =', () => {
    expect(evaluateCondition('withLayout', { withLayout: 'false' })).toBe(false);
  });
});

describe('evaluateConditionals', () => {
  it('includes block content when variable matches', () => {
    const content = 'before {{#styled_css-modules}}import css{{/styled_css-modules}} after';
    expect(evaluateConditionals(content, { styled: 'css-modules' })).toBe(
      'before import css after',
    );
  });

  it('excludes block content when variable does not match', () => {
    const content = 'before {{#styled_css-modules}}import css{{/styled_css-modules}} after';
    expect(evaluateConditionals(content, { styled: 'tailwind' })).toBe('before  after');
  });
});

describe('parseVarFlags', () => {
  it('parses key=value flags', () => {
    expect(parseVarFlags(['name=Button', 'styled=tailwind'])).toEqual({
      name: 'Button',
      styled: 'tailwind',
    });
  });

  it('handles values with equals sign', () => {
    expect(parseVarFlags(['key=val=ue'])).toEqual({ key: 'val=ue' });
  });

  it('skips invalid flags without =', () => {
    expect(parseVarFlags(['invalid'])).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(parseVarFlags(undefined)).toEqual({});
  });
});

describe('detectVariables', () => {
  it('detects {{variable}} patterns', () => {
    expect(detectVariables('Hello {{name}}!')).toEqual(['name']);
  });

  it('detects multiple unique variables', () => {
    const result = detectVariables('{{a}} and {{b}} and {{a}}');
    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('detects {{pascal var}} transform variables', () => {
    expect(detectVariables('{{pascal name}}Component')).toEqual(['name']);
  });

  it('detects {{camel var}} transform variables', () => {
    expect(detectVariables('{{camel name}}Module')).toEqual(['name']);
  });

  it('returns empty array for no variables', () => {
    expect(detectVariables('no variables here')).toEqual([]);
  });
});

// ─── Template Listing Tests ─────────────────────────────

describe('scaffoldModule.list', () => {
  it('lists built-in templates', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await scaffoldModule.list({});
    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('react-component');
    expect(output).toContain('next-page');
    expect(output).toContain('api-route');
    expect(output).toContain('express-middleware');
    expect(output).toContain('cli-command');
    consoleSpy.mockRestore();
  });

  it('filters by tags', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await scaffoldModule.list({ tags: ['react'] });
    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('react-component');
    // next-page, api-route should NOT be listed (they have 'next' tag, not 'react')
    consoleSpy.mockRestore();
  });
});

// ─── Dry-Run Tests ──────────────────────────────────────

describe('scaffoldModule.scaffold (dry-run)', () => {
  it('shows what would be created without writing files', async () => {
    const tmpDir = resolve(join(process.cwd(), '.test-dryrun'));
    try {
      await mkdir(tmpDir, { recursive: true });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await scaffoldModule.scaffold('express-middleware', {
        dryRun: true,
        var: ['name=auth'],
        output: tmpDir,
      });

      const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Would create');
      expect(output).toContain('src/middleware/auth.ts');

      // Verify no files were actually created
      expect(existsSync(join(tmpDir, 'src', 'middleware', 'auth.ts'))).toBe(false);
      consoleSpy.mockRestore();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports error for unknown template', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await scaffoldModule.scaffold('nonexistent', { dryRun: true });
    const output = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('not found');
    consoleSpy.mockRestore();
  });
});

// ─── Scaffold with File Write Tests ─────────────────────

describe('scaffoldModule.scaffold (actual write)', () => {
  it('creates files with interpolated content', async () => {
    const tmpDir = resolve(join(process.cwd(), '.test-scaffold'));
    try {
      await mkdir(tmpDir, { recursive: true });

      await scaffoldModule.scaffold('express-middleware', {
        var: ['name=logger'],
        output: tmpDir,
      });

      const filePath = join(tmpDir, 'src', 'middleware', 'logger.ts');
      expect(existsSync(filePath)).toBe(true);

      const content = await import('node:fs/promises').then((fs) =>
        fs.readFile(filePath, 'utf-8'),
      );
      expect(content).toContain('function logger');
      expect(content).toContain('logger middleware logic');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('respects conditional files', async () => {
    const tmpDir = resolve(join(process.cwd(), '.test-scaffold-cond'));
    try {
      await mkdir(tmpDir, { recursive: true });

      // With styled=css-modules, .module.css file should be created
      await scaffoldModule.scaffold('react-component', {
        var: ['name=Card', 'styled=css-modules'],
        output: tmpDir,
      });

      expect(existsSync(join(tmpDir, 'src', 'components', 'Card', 'Card.module.css'))).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('filters out files with non-matching conditions', async () => {
    const tmpDir = resolve(join(process.cwd(), '.test-scaffold-nocond'));
    try {
      await mkdir(tmpDir, { recursive: true });

      // With styled=tailwind, .module.css file should NOT be created
      await scaffoldModule.scaffold('react-component', {
        var: ['name=Card', 'styled=tailwind'],
        output: tmpDir,
      });

      expect(existsSync(join(tmpDir, 'src', 'components', 'Card', 'Card.module.css'))).toBe(false);
      // But the .tsx and .test.tsx should still be there
      expect(existsSync(join(tmpDir, 'src', 'components', 'Card', 'Card.tsx'))).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
