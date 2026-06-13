# devhammer — Task Breakdown

## Phase 1: Foundation (Week 1)

### Project Setup
- [ ] Initialize git repository and push initial commit
- [ ] Set up `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- [ ] Configure ESLint + Prettier
- [ ] Set up GitHub Actions (test workflow)
- [ ] Create `src/index.ts` CLI entry point with Commander.js
- [ ] Create `src/utils/` shared utilities (logger, config, fs)

### Module Interfaces
- [ ] Define `DevhammerModule` interface
- [ ] Define all TypeScript interfaces in `spec/data-model.md`
- [ ] Create stub command files in `src/commands/`
- [ ] Create stub module files in `src/modules/`

### Documentation
- [ ] Write README.md
- [ ] Write QUICK_START.md
- [ ] Write docs/contributing.md
- [ ] Write docs/architecture.md

---

## Phase 2: Implementation (Week 2–3)

### Agent A: Config Generator + API Tester

#### Config Generator (`devhammer config`)
- [ ] Implement framework detection (Next.js, Remix, Vite, Node)
- [ ] Implement `devhammer config eslint`
- [ ] Implement `devhammer config prettier`
- [ ] Implement `devhammer config tsconfig`
- [ ] Implement `devhammer config tailwind`
- [ ] Implement `devhammer config all`
- [ ] Implement `--dry-run` flag
- [ ] Implement existing config merge/overwrite prompts
- [ ] Write unit tests for config generator
- [ ] Write integration tests

#### API Tester (`devhammer api`)
- [ ] Implement HTTP client using `node:http`/`node:https`
- [ ] Implement `devhammer api get <url>`
- [ ] Implement `devhammer api post <url>`
- [ ] Implement `devhammer api graphql <url>`
- [ ] Implement `devhammer api history`
- [ ] Implement JSON formatting and response display
- [ ] Implement `{{variable}}` substitution from .env
- [ ] Implement request history persistence
- [ ] Write unit tests for API tester
- [ ] Write integration tests

### Agent B: Template Scaffolder + Env Manager

#### Template Scaffolder (`devhammer scaffold`)
- [ ] Define built-in template format
- [ ] Implement `devhammer scaffold list`
- [ ] Implement `devhammer scaffold <template>`
- [ ] Implement `devhammer scaffold create <name>`
- [ ] Implement `{{variable}}` interpolation engine
- [ ] Implement interactive prompts via `readline`
- [ ] Implement `--dry-run` flag
- [ ] Create built-in templates (react-component, next-page, api-route, express-middleware, cli-command)
- [ ] Write unit tests for scaffolder
- [ ] Write integration tests

#### Env Manager (`devhammer env`)
- [ ] Implement `devhammer env init`
- [ ] Implement AES-256-GCM encryption/decryption using `node:crypto`
- [ ] Implement `devhammer env encrypt`
- [ ] Implement `devhammer env decrypt`
- [ ] Implement `devhammer env diff`
- [ ] Implement `devhammer env validate`
- [ ] Implement schema inference from `.env.example`
- [ ] Implement `.gitignore` safety check
- [ ] Write unit tests for env manager
- [ ] Write integration tests

### Agent C: Performance Profiler + Shared Utils

#### Performance Profiler (`devhammer profile`)
- [ ] Implement `devhammer profile bundle` (parse tsup metafile)
- [ ] Implement `devhammer profile deps` (analyze node_modules)
- [ ] Implement `devhammer profile startup` (benchmark CLI startup)
- [ ] Implement `devhammer profile all`
- [ ] Implement historical comparison (`.devhammer/profile/`)
- [ ] Implement `--json` output flag
- [ ] Write unit tests for profiler
- [ ] Write integration tests

#### Shared Utils
- [ ] Finalize `src/utils/logger.ts` (colored output)
- [ ] Finalize `src/utils/config.ts` (project config detection)
- [ ] Finalize `src/utils/fs.ts` (file system helpers)
- [ ] Implement `src/utils/crypto.ts` (encryption helpers)
- [ ] Implement `src/utils/http.ts` (HTTP request helper)
- [ ] Write unit tests for all utils

---

## Phase 3: Integration & Release (Week 3–4)

### Integration
- [ ] Register all modules in `src/index.ts`
- [ ] End-to-end testing of all commands
- [ ] Cross-platform testing (macOS, Linux, Windows)
- [ ] Performance benchmark (verify <100ms startup)
- [ ] Bundle size check (verify <2MB)

### Documentation
- [ ] Update README with final API
- [ ] Write comprehensive docs for each module
- [ ] Add JSDoc comments to public APIs
- [ ] Record demo GIF/video

### Release
- [ ] Set up GitHub Actions release workflow
- [ ] Configure npm publishing
- [ ] Tag v0.1.0 release
- [ ] Announce on social media
- [ ] Submit to awesome-typescript-tooling list
