# Contributing to devhammer

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Setup

```bash
# Clone the repo
git clone https://github.com/joonhe-dev/devhammer.git
cd devhammer

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run in development mode
pnpm dev
```

## Development Workflow

1. Create a branch: `git checkout -b feature/my-feature`
2. Make changes
3. Add tests for your changes
4. Run the full check: `pnpm typecheck && pnpm lint && pnpm test`
5. Commit with conventional commits: `feat: add X`, `fix: handle Y`
6. Open a Pull Request

## Code Style

- TypeScript strict mode (no `any` unless absolutely necessary)
- Single quotes, trailing commas, 100 char line width (enforced by Prettier)
- No external runtime dependencies — only `commander` + Node.js built-ins
- Use `src/utils/logger.ts` for all console output (no raw `console.log`)

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── commands/         # Command registration (thin layer)
├── modules/          # Business logic per module
│   ├── config/
│   ├── api/
│   ├── scaffold/
│   ├── profile/
│   └── env/
└── utils/            # Shared utilities
    ├── logger.ts
    ├── config.ts
    ├── fs.ts
    └── crypto.ts
```

- **commands/** — Register CLI commands with Commander.js. Keep them thin; delegate to modules.
- **modules/** — All business logic. Each module exports a `register(program)` function.
- **utils/** — Shared utilities. No module-specific logic here.

## Module Development

To add a new module:

1. Create `src/modules/<name>/` with an `index.ts` that implements `DevhammerModule`:

```typescript
import { Command } from 'commander';

export const myModule = {
  name: 'my-module',
  version: '0.1.0',
  register(program: Command): void {
    program
      .command('my-command')
      .description('My new command')
      .action(() => {
        // delegate to module logic
      });
  },
};
```

2. Create `src/commands/<name>.ts` that imports and registers the module.
3. Add the import in `src/index.ts`.
4. Add tests in `tests/<name>.test.ts`.
5. Update `spec/spec.md` with the module's commands and features.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Build, CI, etc.

## Reporting Issues

- Use [GitHub Issues](https://github.com/joonhe-dev/devhammer/issues)
- Include your OS, Node.js version, and devhammer version
- For bugs, include steps to reproduce and expected vs actual behavior
