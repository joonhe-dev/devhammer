# 🔨 devhammer

[![npm version](https://img.shields.io/npm/v/devhammer.svg)](https://www.npmjs.com/package/devhammer)
[![CI](https://github.com/joonhe-dev/devhammer/actions/workflows/test.yml/badge.svg)](https://github.com/joonhe-dev/devhammer/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/joonhe-dev/devhammer.svg)](https://github.com/joonhe-dev/devhammer/blob/main/LICENSE)

A local-first CLI toolset for TypeScript full-stack developers.

## Why devhammer?

- **One install, five tools** — Stop juggling `eslint --init`, `httpie`, `create-*`, `webpack-bundle-analyzer`, and `dotenv-vault`. Install once, use everywhere.
- **Zero bloat** — Only one runtime dependency (`commander`). Fast install, fast startup (<100ms), small footprint (<2MB).
- **Smart defaults** — Auto-detects your framework, package manager, and TypeScript version. Works without any config file.

## Features

| Module | Command | What it does |
|--------|---------|-------------|
| ⚙️ Config Generator | `devhammer config` | Generate eslint, prettier, tsconfig, tailwind configs with smart defaults |
| 🌐 API Tester | `devhammer api` | Test REST & GraphQL endpoints from the terminal |
| 🏗️ Template Scaffolder | `devhammer scaffold` | Scaffold project templates and custom boilerplate |
| 📊 Performance Profiler | `devhammer profile` | Analyze bundle size, dependency tree, and startup time |
| 🔐 Env Manager | `devhammer env` | Manage, encrypt, diff, and validate .env files |

## Quick Start

```bash
# Install globally
pnpm add -g devhammer

# Or use with npx (no install)
npx devhammer --help

# Generate all config files
devhammer config all
```

## Usage

### ⚙️ Config Generator

```bash
# Generate specific config
devhammer config eslint
devhammer config prettier
devhammer config tsconfig
devhammer config tailwind

# Generate all configs at once
devhammer config all

# Preview without writing files
devhammer config all --dry-run
```

### 🌐 API Tester

```bash
# GET request
devhammer api get https://api.example.com/users

# POST request with JSON body
devhammer api post https://api.example.com/users --body '{"name": "test"}'

# GraphQL query
devhammer api graphql https://api.example.com/graphql --query '{ users { id name } }'

# View request history
devhammer api history
```

### 🏗️ Template Scaffolder

```bash
# List available templates
devhammer scaffold list

# Scaffold from a built-in template
devhammer scaffold react-component

# Create a custom template from current project
devhammer scaffold create my-template
```

### 📊 Performance Profiler

```bash
# Analyze bundle size
devhammer profile bundle

# Analyze dependency tree
devhammer profile deps

# Measure startup time
devhammer profile startup

# Run all profilers
devhammer profile all
```

### 🔐 Env Manager

```bash
# Initialize .env from .env.example
devhammer env init

# Encrypt .env file
devhammer env encrypt

# Decrypt .env.encrypted
devhammer env decrypt

# Compare .env and .env.example
devhammer env diff

# Validate .env against schema
devhammer env validate
```

## Configuration

devhammer works out of the box with zero configuration. For team consistency, create a `devhammer.config.ts`:

```typescript
import type { ProjectConfig } from 'devhammer';

export default {
  framework: 'next',
  packageManager: 'pnpm',
  modules: {
    config: {
      prettier: { semi: true, singleQuote: true, printWidth: 100 },
    },
  },
} satisfies ProjectConfig;
```

## Contributing

See [CONTRIBUTING.md](./docs/contributing.md) for guidelines.

## License

[MIT](./LICENSE) © Joonhe
