# devhammer — Data Model

## Core Types

### ProjectConfig

```typescript
interface ProjectConfig {
  $schema?: string;
  framework?: 'next' | 'remix' | 'vite' | 'node';
  packageManager?: 'pnpm' | 'yarn' | 'npm';
  tsVersion?: string;
  modules?: {
    config?: ConfigModuleConfig;
    api?: ApiModuleConfig;
    scaffold?: ScaffoldModuleConfig;
    profile?: ProfileModuleConfig;
    env?: EnvModuleConfig;
  };
}
```

### ConfigModuleConfig

```typescript
interface ConfigModuleConfig {
  eslint?: {
    extends?: string[];
    rules?: Record<string, unknown>;
    ignorePatterns?: string[];
  };
  prettier?: {
    semi?: boolean;
    singleQuote?: boolean;
    trailingComma?: 'all' | 'es5' | 'none';
    printWidth?: number;
    tabWidth?: number;
  };
  tsconfig?: {
    target?: string;
    module?: string;
    strict?: boolean;
    paths?: Record<string, string[]>;
  };
  tailwind?: {
    content?: string[];
    theme?: Record<string, unknown>;
    plugins?: string[];
  };
}
```

### ConfigTemplate

```typescript
interface ConfigTemplate {
  name: string;
  description: string;
  framework?: string;
  files: Record<string, string>; // filename → content
}
```

---

## API Module Types

### APIRequest

```typescript
interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  timeout?: number;
}

interface GraphQLRequest extends APIRequest {
  method: 'POST';
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}
```

### APIResponse

```typescript
interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number; // ms
  size: number; // bytes
}
```

### APIHistoryEntry

```typescript
interface APIHistoryEntry {
  id: string;
  timestamp: number;
  request: APIRequest;
  response: APIResponse;
}
```

---

## Scaffold Module Types

### TemplateManifest

```typescript
interface TemplateManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  variables: TemplateVariable[];
  files: TemplateFile[];
}
```

### TemplateFile

```typescript
interface TemplateFile {
  path: string; // e.g., "src/components/{{name}}.tsx"
  content: string; // Template string with {{variable}} placeholders
  condition?: string; // Optional condition for inclusion
}
```

### TemplateVariable

```typescript
interface TemplateVariable {
  name: string;
  description: string;
  default?: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'path';
  validate?: (value: string) => boolean;
}
```

---

## Profile Module Types

### ProfileReport

```typescript
interface ProfileReport {
  timestamp: number;
  bundle?: BundleAnalysis;
  deps?: DepsAnalysis;
  startup?: StartupAnalysis;
}

interface BundleAnalysis {
  totalSize: number;
  files: Array<{
    path: string;
    size: number;
    gzipSize: number;
  }>;
}

interface DepsAnalysis {
  totalSize: number;
  count: number;
  duplicates: Array<{
    name: string;
    versions: string[];
  }>;
  large: Array<{
    name: string;
    size: number;
  }>;
}

interface StartupAnalysis {
  avgMs: number;
  minMs: number;
  maxMs: number;
  runs: number;
}
```

---

## Env Module Types

### EnvSchema

```typescript
interface EnvSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'url' | 'path';
    required?: boolean;
    description?: string;
    default?: string;
    validate?: (value: string) => boolean;
  };
}
```

### EnvDiffResult

```typescript
interface EnvDiffResult {
  missing: string[];  // Keys in .env.example but not in .env
  extra: string[];   // Keys in .env but not in .env.example
  changed: Array<{
    key: string;
    expected: string;
    actual: string;
  }>;
}
```

---

## Module Interface

### DevhammerModule

```typescript
import { Command } from 'commander';

interface DevhammerModule {
  /** Module name (e.g., 'config', 'api') */
  name: string;
  /** Module version */
  version: string;
  /** Register CLI commands with the Commander program */
  register(program: Command): void;
  /** Initialize module with project config (optional) */
  init?(config: ProjectConfig): void | Promise<void>;
}
```

This interface is the contract that all built-in modules implement and that future plugins will implement.
