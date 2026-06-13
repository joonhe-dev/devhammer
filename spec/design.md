# devhammer — Architecture & Design Decisions

## Architecture Overview

devhammer follows a 3-layer architecture:

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

### Data Flow

```
User Input (CLI)
    │
    ▼
Commander.js parses command & options
    │
    ▼
Action handler delegates to Module
    │
    ▼
Module uses Shared Utils (logger, fs, config, etc.)
    │
    ▼
Module returns result
    │
    ▼
Action handler formats & outputs result
```

### Directory Structure

```
devhammer/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command registration
│   │   ├── config.ts
│   │   ├── api.ts
│   │   ├── scaffold.ts
│   │   ├── profile.ts
│   │   └── env.ts
│   ├── modules/              # Business logic
│   │   ├── config/
│   │   ├── api/
│   │   ├── scaffold/
│   │   ├── profile/
│   │   └── env/
│   └── utils/                # Shared utilities
│       ├── logger.ts
│       ├── config.ts
│       ├── fs.ts
│       └── crypto.ts
├── spec/                     # Design documents
├── docs/                     # User documentation
└── tests/                    # Test files
```

---

## Design Decisions

### DD-1: Commander.js over Ink

**Decision**: Use Commander.js for CLI framework.

**Rationale**:
- Commander.js is the most mature Node.js CLI framework (30M+ weekly downloads)
- Ink (React-based CLI) adds significant overhead and a React dependency
- Commander's declarative API maps cleanly to our module structure
- Extensive documentation and community support

**Trade-offs**:
- No React-style component composition for complex TUIs
- Interactive prompts require additional handling (we use Node.js `readline`)

---

### DD-2: Zero External Runtime Dependencies

**Decision**: The only runtime dependency is `commander`. All other functionality uses Node.js built-in modules.

**Rationale**:
- Fast install: `pnpm add -g devhammer` completes in seconds
- Small disk footprint: <2MB installed
- No supply-chain attack surface from transitive dependencies
- Full control over behavior and performance

**Implementation**:
- File operations: `node:fs`, `node:fs/promises`, `node:path`
- HTTP requests: `node:http`, `node:https`
- Crypto (env encryption): `node:crypto`
- Terminal colors: Raw `\x1b` escape codes (no `chalk`)
- User input: `node:readline` (no `inquirer`)

---

### DD-3: tsup for Build

**Decision**: Use tsup (esbuild-based) for building, outputting both CJS and ESM.

**Rationale**:
- esbuild is the fastest JS bundler; tsup wraps it with sensible defaults
- Dual CJS/ESM output maximizes compatibility
- Built-in `.d.ts` generation
- Shebang support for CLI entry point
- Used by major projects (Vite, Nuxt, etc.)

**Configuration**:
- Entry: `src/index.ts`
- Format: `['cjs', 'esm']`
- DTS: `true`
- Shebang: `true` on entry file
- Target: `node18`

---

### DD-4: devhammer.config.ts Optional Project Config

**Decision**: Support an optional `devhammer.config.ts` file at the project root.

**Rationale**:
- Teams need consistent settings across members
- Config in TypeScript provides type safety and IDE autocomplete
- Optional — devhammer works without any config file (smart defaults)

**Config Shape**:
```typescript
interface ProjectConfig {
  $schema?: string;
  framework?: 'next' | 'remix' | 'vite' | 'node';
  packageManager?: 'pnpm' | 'yarn' | 'npm';
  modules?: {
    config?: ConfigModuleConfig;
    api?: ApiModuleConfig;
    scaffold?: ScaffoldModuleConfig;
    profile?: ProfileModuleConfig;
    env?: EnvModuleConfig;
  };
}
```

---

### DD-5: Plugin Architecture (v0.2.0+)

**Decision**: Design module interfaces with future plugin support in mind, but defer implementation.

**Rationale**:
- v0.1.0 focuses on core modules with proven utility
- Plugin system adds complexity (discovery, loading, sandboxing)
- By defining `DevhammerModule` interface now, we ensure internal modules are "plugin-ready"

**Future Interface**:
```typescript
interface DevhammerModule {
  name: string;
  version: string;
  register(program: Command): void;
  init?(config: ProjectConfig): void | Promise<void>;
}
```
