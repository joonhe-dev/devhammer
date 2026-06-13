# devhammer — Project Proposal

## Problem

TypeScript full-stack developers juggle multiple CLI tools daily — `eslint --init`, `prettier`, `httpie`/`curl`, `create-*` scaffolders, `webpack-bundle-analyzer`, `dotenv-vault`, and more. Each tool:

- Requires a separate install and configuration
- Has its own config format and conventions
- Adds to `node_modules` bloat and startup overhead
- Operates in isolation with no shared context about the project

For indie makers and small teams, this fragmentation means lost time on tooling instead of shipping features.

## Solution

**devhammer** is a single CLI that bundles 5 essential developer utilities into one `pnpm add -g devhammer` install:

| # | Module | Command | Purpose |
|---|--------|---------|---------|
| 1 | Config Generator | `devhammer config` | Generate eslint, prettier, tsconfig, tailwind configs with smart defaults |
| 2 | API Tester | `devhammer api` | Test REST & GraphQL endpoints from the terminal |
| 3 | Template Scaffolder | `devhammer scaffold` | Scaffold project templates and custom boilerplate |
| 4 | Performance Profiler | `devhammer profile` | Analyze bundle size, dependency tree, and startup time |
| 5 | Env Manager | `devhammer env` | Manage, encrypt, diff, and validate .env files |

### Key Differentiators

- **Zero external runtime deps** — only `commander` + Node.js built-ins
- **Fast startup** — <100ms cold start, no dynamic imports at boot
- **Smart defaults** — auto-detects framework, package manager, TypeScript version
- **Local-first** — all data stays on your machine, no cloud services
- **Composable** — modules share a common config and utility layer

## Target Users

1. **TypeScript/React/Next.js developers** — the most common TS full-stack stack
2. **Indie makers** — one-person teams who need maximum efficiency
3. **Dev teams** — standardized tooling across the team via `devhammer.config.ts`

## Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| GitHub Stars | 500+ | Month 1 |
| Weekly npm Downloads | 100+ | Month 1 |
| Cold Start Time | <100ms | Always |
| Bundle Size | <2MB | Always |
| Test Coverage | >90% | Launch |

## Scope

- **In scope (v0.1.0)**: All 5 modules with core commands, smart defaults, project config
- **Out of scope (v0.1.0)**: Plugin system, IDE integrations, cloud sync, Windows-specific features
- **Future (v0.2.0+)**: Plugin architecture, custom module registration, team sharing
