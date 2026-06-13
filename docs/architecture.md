# Architecture

This document provides an overview of devhammer's architecture. For the full design rationale, see [spec/design.md](../spec/design.md).

## Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│              CLI Layer (Commander.js)        │
│  program → command → action handler          │
├─────────────────────────────────────────────┤
│              Module Layer                    │
│  config  │  api  │  scaffold  │  profile  │ env │
├─────────────────────────────────────────────┤
│              Shared Utils                    │
│  logger │ config │ fs │ crypto │ templating │
└─────────────────────────────────────────────┘
```

### CLI Layer

The entry point (`src/index.ts`) creates a Commander.js program and registers commands from each module. Commands are thin wrappers that parse arguments and delegate to the module layer.

### Module Layer

Each module lives in `src/modules/<name>/` and implements the `DevhammerModule` interface:

```typescript
interface DevhammerModule {
  name: string;
  version: string;
  register(program: Command): void;
  init?(config: ProjectConfig): void | Promise<void>;
}
```

Modules are self-contained — they define their own commands, handle their own logic, and use shared utilities for common operations.

### Shared Utils

Utilities in `src/utils/` provide cross-module functionality:

- **logger** — Colored console output using raw ANSI escape codes (no `chalk` dependency)
- **config** — Project config detection (framework, package manager, TypeScript version)
- **fs** — File system helpers (read, write, ensureDir, exists)
- **crypto** — AES-256-GCM encryption for the env module

## Data Flow

```
User types: devhammer config eslint --dry-run
    │
    ▼
Commander.js parses: command=config, subcommand=eslint, flag=dry-run
    │
    ▼
config command handler calls: configModule.generateEslint({ dryRun: true })
    │
    ▼
Module reads project info via: detectProject()
    │
    ▼
Module generates config based on detected framework
    │
    ▼
Action handler formats output via: logger.success("Generated .eslintrc.json")
```

## Key Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| DD-1 | Commander.js over Ink | Mature, lighter, no React dependency |
| DD-2 | Zero external runtime deps | Fast install, small footprint, secure |
| DD-3 | tsup for build | esbuild-based, CJS+ESM dual output |
| DD-4 | Optional devhammer.config.ts | Smart defaults + team config when needed |
| DD-5 | Plugin architecture (future) | Module interface designed for extensibility |

## Build Pipeline

```
src/index.ts ──tsup──▶ dist/index.js (CJS + ESM + .d.ts)
                         │
                         └──▶ shebang → executable CLI
```

- **tsup** bundles all source into a single file per format
- **dts** generates TypeScript declarations from source
- **shebang** adds `#!/usr/bin/env node` for CLI execution
- **target: node18** ensures compatibility with Node.js 18+

## Configuration Hierarchy

1. **CLI flags** — Highest priority (e.g., `--framework next`)
2. **devhammer.config.ts** — Project-level config
3. **Auto-detection** — Lowest priority (detect from `package.json`, lock files)

Values from higher-priority sources override lower ones.
