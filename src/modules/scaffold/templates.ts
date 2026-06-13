// devhammer — Built-in Template Definitions
import type { TemplateManifest } from '../../types.js';

export const builtinTemplates: TemplateManifest[] = [
  {
    name: 'react-component',
    version: '1.0.0',
    description: 'React component with test and styles',
    tags: ['react', 'component', 'ui'],
    variables: [
      {
        name: 'name',
        description: 'Component name (PascalCase)',
        required: true,
        type: 'string',
      },
      {
        name: 'styled',
        description: 'Styling approach',
        default: 'css-modules',
        type: 'string',
      },
    ],
    files: [
      {
        path: 'src/components/{{name}}/{{name}}.tsx',
        content: `import React from 'react';
{{#styled_css-modules}}import styles from './{{name}}.module.css';{{/styled_css-modules}}
{{#styled_tailwind}}// Using Tailwind CSS classes{{/styled_tailwind}}
{{#styled_styled}}import { Styled{{name}} } from './{{name}}.styled';{{/styled_styled}}

export interface {{name}}Props {
  children?: React.ReactNode;
}

export function {{name}}({ children }: {{name}}Props) {
  return (
    {{#styled_css-modules}}<div className={styles.container}>{children}</div>{{/styled_css-modules}}
    {{#styled_tailwind}}<div className="flex items-center justify-center">{children}</div>{{/styled_tailwind}}
    {{#styled_styled}}<Styled{{name}}>{children}</Styled{{name}}>{{/styled_styled}}
  );
}

export default {{name}};
`,
      },
      {
        path: 'src/components/{{name}}/{{name}}.test.tsx',
        content: `import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { {{name}} } from './{{name}}';

describe('{{name}}', () => {
  it('renders children', () => {
    const { getByText } = render(<{{name}}>Hello</{{name}}>);
    expect(getByText('Hello')).toBeDefined();
  });
});
`,
      },
      {
        path: 'src/components/{{name}}/{{name}}.module.css',
        content: `.container {
  display: flex;
  align-items: center;
  justify-content: center;
}
`,
        condition: 'styled=css-modules',
      },
    ],
  },

  {
    name: 'next-page',
    version: '1.0.0',
    description: 'Next.js App Router page with optional layout',
    tags: ['next', 'page', 'app-router'],
    variables: [
      {
        name: 'name',
        description: 'Page route name (e.g., "about" for /about)',
        required: true,
        type: 'string',
      },
      {
        name: 'withLayout',
        description: 'Include a layout file?',
        default: 'false',
        type: 'boolean',
      },
    ],
    files: [
      {
        path: 'app/{{name}}/page.tsx',
        content: `export default function {{pascal name}}Page() {
  return (
    <main>
      <h1>{{pascal name}}</h1>
    </main>
  );
}
`,
      },
      {
        path: 'app/{{name}}/layout.tsx',
        content: `export default function {{pascal name}}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
`,
        condition: 'withLayout=true',
      },
    ],
  },

  {
    name: 'api-route',
    version: '1.0.0',
    description: 'Next.js App Router API route',
    tags: ['next', 'api', 'app-router'],
    variables: [
      {
        name: 'name',
        description: 'API route name (e.g., "users" for /api/users)',
        required: true,
        type: 'string',
      },
      {
        name: 'method',
        description: 'HTTP method to implement',
        default: 'GET',
        type: 'string',
      },
    ],
    files: [
      {
        path: 'app/api/{{name}}/route.ts',
        content: `import { NextResponse } from 'next/server';

export async function {{method}}(request: Request) {
  try {
    return NextResponse.json({ message: '{{name}} endpoint' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
`,
      },
    ],
  },

  {
    name: 'express-middleware',
    version: '1.0.0',
    description: 'Express middleware function',
    tags: ['express', 'middleware', 'server'],
    variables: [
      {
        name: 'name',
        description: 'Middleware name (camelCase)',
        required: true,
        type: 'string',
      },
    ],
    files: [
      {
        path: 'src/middleware/{{name}}.ts',
        content: `import { Request, Response, NextFunction } from 'express';

export function {{name}}(req: Request, res: Response, next: NextFunction): void {
  try {
    // TODO: Implement {{name}} middleware logic
    next();
  } catch (error) {
    next(error);
  }
}
`,
      },
    ],
  },

  {
    name: 'cli-command',
    version: '1.0.0',
    description: 'CLI command module with handler',
    tags: ['cli', 'command', 'commander'],
    variables: [
      {
        name: 'name',
        description: 'Command name (kebab-case)',
        required: true,
        type: 'string',
      },
      {
        name: 'description',
        description: 'Command description',
        default: 'A new command',
        type: 'string',
      },
    ],
    files: [
      {
        path: 'src/commands/{{name}}.ts',
        content: `import type { Command } from 'commander';
import { {{camel name}}Module } from '../modules/{{name}}/index.js';

export function register{{pascal name}}Command(program: Command): void {
  program
    .command('{{name}}')
    .description('{{description}}')
    .action(async (options) => {
      await {{camel name}}Module.run(options);
    });
}
`,
      },
      {
        path: 'src/modules/{{name}}/index.ts',
        content: `import { logger } from '../../utils/logger.js';

export const {{camel name}}Module = {
  async run(options: Record<string, unknown>): Promise<void> {
    logger.info('Running {{name}} command...');
  },
};
`,
      },
    ],
  },
];
