# devhammer — Feature Specifications

## Module 1: Config Generator (`devhammer config`)

### Commands

| Command | Description |
|---------|-------------|
| `devhammer config eslint` | Generate `.eslintrc.*` with framework-aware rules |
| `devhammer config prettier` | Generate `.prettierrc` with sensible defaults |
| `devhammer config tsconfig` | Generate `tsconfig.json` for the detected environment |
| `devhammer config tailwind` | Generate `tailwind.config.ts` with common presets |
| `devhammer config all` | Generate all config files with consistent settings |

### Smart Defaults

- **Framework detection**: Auto-detect Next.js, Remix, Vite, or vanilla TS project
- **Package manager awareness**: Detect pnpm/yarn/npm and adjust config accordingly
- **TypeScript version**: Read `tsVersion` from `package.json` and set appropriate `target`
- **Existing config merge**: Prompt before overwriting; offer merge mode

### Output

- Writes config files to the project root
- Prints a summary of generated files and key settings
- `--dry-run` flag prints files to stdout without writing

---

## Module 2: API Tester (`devhammer api`)

### Commands

| Command | Description |
|---------|-------------|
| `devhammer api get <url>` | Send GET request |
| `devhammer api post <url>` | Send POST request with body |
| `devhammer api graphql <url>` | Send GraphQL query/mutation |
| `devhammer api history` | Show request history |

### Smart Defaults

- **JSON formatting**: Auto-detect and pretty-print JSON responses
- **Header presets**: Common headers (auth, content-type) saved in project config
- **Environment variables**: Substitute `{{API_KEY}}` from `.env` files
- **History persistence**: Store last 100 requests per project in `.devhammer/`

### Output

- Response body (formatted), status code, timing
- `--verbose` flag includes headers
- `--json` flag outputs raw JSON for piping

---

## Module 3: Template Scaffolder (`devhammer scaffold`)

### Commands

| Command | Description |
|---------|-------------|
| `devhammer scaffold list` | List available templates |
| `devhammer scaffold <template>` | Scaffold from a built-in template |
| `devhammer scaffold create <name>` | Create a custom template from current project |

### Smart Defaults

- **Built-in templates**: react-component, next-page, api-route, express-middleware, cli-command
- **Variable interpolation**: Templates use `{{variableName}}` syntax
- **Interactive prompts**: Collect variable values with smart defaults
- **Git-aware**: Skip `.git/` and `node_modules/` when creating templates

### Output

- Created files list with paths
- `--dry-run` shows what would be created
- Next steps hint (e.g., "Run `pnpm install` to get started")

---

## Module 4: Performance Profiler (`devhammer profile`)

### Commands

| Command | Description |
|---------|-------------|
| `devhammer profile bundle` | Analyze bundle size |
| `devhammer profile deps` | Analyze dependency tree |
| `devhammer profile startup` | Measure startup time |
| `devhammer profile all` | Run all profilers |

### Smart Defaults

- **Bundle analysis**: Parse build output or run `tsup` with `--metafile`
- **Dependency audit**: Read `node_modules` size, identify duplicates, flag large packages
- **Startup benchmark**: Measure `time node dist/index.js --help` over 10 runs
- **Comparison**: Compare against previous run stored in `.devhammer/profile/`

### Output

- Summary table with metrics
- `--json` for machine-readable output
- Warnings for bundles >500KB, deps >50, startup >200ms

---

## Module 5: Env Manager (`devhammer env`)

### Commands

| Command | Description |
|---------|-------------|
| `devhammer env init` | Create `.env` from `.env.example` with interactive prompts |
| `devhammer env encrypt` | Encrypt `.env` to `.env.encrypted` |
| `devhammer env decrypt` | Decrypt `.env.encrypted` to `.env` |
| `devhammer env diff` | Compare `.env` and `.env.example` for missing keys |
| `devhammer env validate` | Validate `.env` against a schema |

### Smart Defaults

- **AES-256-GCM encryption**: Using Node.js `crypto` module, no external deps
- **Schema inference**: Auto-generate schema from `.env.example` comments
- **Git safety**: Warn if `.env` is not in `.gitignore`
- **Key type inference**: Detect number, boolean, URL, path types from values

### Output

- `init`: Created `.env` with filled values
- `encrypt`/`decrypt`: Confirmation of file path
- `diff`: Table of missing, extra, and changed keys
- `validate`: Pass/fail with details on invalid keys
