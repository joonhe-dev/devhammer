# Quick Start Guide

Get up and running with devhammer in 5 minutes.

## Installation

```bash
pnpm add -g devhammer
```

That's it. No other dependencies needed.

## Step 1: Generate Config Files

```bash
cd your-project
devhammer config all
```

devhammer auto-detects your framework (Next.js, Remix, Vite, etc.) and generates consistent config files:

- `.eslintrc.json` — Framework-aware lint rules
- `.prettierrc` — Consistent formatting
- `tsconfig.json` — Optimized for your environment
- `tailwind.config.ts` — Common presets (if applicable)

Use `--dry-run` to preview before writing:

```bash
devhammer config all --dry-run
```

## Step 2: Test an API Endpoint

```bash
devhammer api get https://jsonplaceholder.typicode.com/posts/1
```

You'll see the response formatted with status code and timing:

```
200 OK (145ms)
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere...",
  "body": "quia et suscipit..."
}
```

For POST requests:

```bash
devhammer api post https://jsonplaceholder.typicode.com/posts \
  --body '{"title": "Hello", "body": "World", "userId": 1}'
```

## Step 3: Manage Your Environment

```bash
# Initialize .env from .env.example (interactive prompts)
devhammer env init

# Check for missing or changed keys
devhammer env diff

# Encrypt for safe sharing
devhammer env encrypt
```

## What's Next?

- **Scaffold templates**: `devhammer scaffold list` → `devhammer scaffold react-component`
- **Profile performance**: `devhammer profile all`
- **Customize**: Create a `devhammer.config.ts` for team defaults
- **Full docs**: See [README.md](./README.md) for all commands and options

## Troubleshooting

**"command not found: devhammer"**
- Make sure you installed globally: `pnpm add -g devhammer`
- Or use npx: `npx devhammer --help`

**"Cannot detect framework"**
- Ensure you're in a project directory with a `package.json`
- Or set it explicitly: `devhammer config all --framework next`
