// devhammer — Built-in Templates Structure Tests
import { describe, it, expect } from 'vitest';
import { builtinTemplates } from './templates.js';

describe('builtinTemplates', () => {
  it('has 5 built-in templates', () => {
    expect(builtinTemplates).toHaveLength(5);
  });

  const templateNames = [
    'react-component',
    'next-page',
    'api-route',
    'express-middleware',
    'cli-command',
  ];

  it.each(templateNames)('includes template "%s"', (name) => {
    expect(builtinTemplates.find((t) => t.name === name)).toBeDefined();
  });

  it('each template has required fields', () => {
    for (const template of builtinTemplates) {
      expect(template.name).toBeTruthy();
      expect(template.version).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.variables).toBeInstanceOf(Array);
      expect(template.files).toBeInstanceOf(Array);
      expect(template.files.length).toBeGreaterThan(0);
    }
  });

  it('each template variable has required fields', () => {
    for (const template of builtinTemplates) {
      for (const variable of template.variables) {
        expect(variable.name).toBeTruthy();
        expect(variable.description).toBeTruthy();
      }
    }
  });

  it('each template file has path and content', () => {
    for (const template of builtinTemplates) {
      for (const file of template.files) {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
      }
    }
  });
});

describe('react-component template', () => {
  const template = builtinTemplates.find((t) => t.name === 'react-component')!;

  it('has name variable (required)', () => {
    const nameVar = template.variables.find((v) => v.name === 'name');
    expect(nameVar).toBeDefined();
    expect(nameVar!.required).toBe(true);
  });

  it('has styled variable with default', () => {
    const styledVar = template.variables.find((v) => v.name === 'styled');
    expect(styledVar).toBeDefined();
    expect(styledVar!.default).toBe('css-modules');
  });

  it('has conditional .module.css file', () => {
    const cssFile = template.files.find((f) => f.path.endsWith('.module.css'));
    expect(cssFile).toBeDefined();
    expect(cssFile!.condition).toBe('styled=css-modules');
  });

  it('has 3 files (component, test, styles)', () => {
    expect(template.files).toHaveLength(3);
  });
});

describe('next-page template', () => {
  const template = builtinTemplates.find((t) => t.name === 'next-page')!;

  it('has withLayout boolean variable', () => {
    const layoutVar = template.variables.find((v) => v.name === 'withLayout');
    expect(layoutVar).toBeDefined();
    expect(layoutVar!.type).toBe('boolean');
  });

  it('has conditional layout file', () => {
    const layoutFile = template.files.find((f) => f.path.includes('layout'));
    expect(layoutFile).toBeDefined();
    expect(layoutFile!.condition).toBe('withLayout=true');
  });
});

describe('api-route template', () => {
  const template = builtinTemplates.find((t) => t.name === 'api-route')!;

  it('has method variable with default GET', () => {
    const methodVar = template.variables.find((v) => v.name === 'method');
    expect(methodVar).toBeDefined();
    expect(methodVar!.default).toBe('GET');
  });

  it('has single route file', () => {
    expect(template.files).toHaveLength(1);
    expect(template.files[0]!.path).toContain('route.ts');
  });
});

describe('express-middleware template', () => {
  const template = builtinTemplates.find((t) => t.name === 'express-middleware')!;

  it('has only a name variable', () => {
    expect(template.variables).toHaveLength(1);
    expect(template.variables[0]!.name).toBe('name');
  });

  it('has a single middleware file', () => {
    expect(template.files).toHaveLength(1);
    expect(template.files[0]!.path).toContain('middleware');
  });
});

describe('cli-command template', () => {
  const template = builtinTemplates.find((t) => t.name === 'cli-command')!;

  it('has name and description variables', () => {
    const names = template.variables.map((v) => v.name);
    expect(names).toContain('name');
    expect(names).toContain('description');
  });

  it('has description default', () => {
    const descVar = template.variables.find((v) => v.name === 'description');
    expect(descVar!.default).toBe('A new command');
  });

  it('creates command and module files', () => {
    expect(template.files).toHaveLength(2);
    expect(template.files.some((f) => f.path.includes('commands'))).toBe(true);
    expect(template.files.some((f) => f.path.includes('modules'))).toBe(true);
  });
});
