import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface ProjectInfo {
  framework: 'next' | 'remix' | 'vite' | 'node' | 'unknown';
  packageManager: 'pnpm' | 'yarn' | 'npm' | 'unknown';
  hasTypeScript: boolean;
  tsVersion?: string;
}

const FRAMEWORK_INDICATORS: Record<string, (deps: Record<string, string>) => boolean> = {
  next: (deps) => 'next' in deps,
  remix: (deps) => '@remix-run/node' in deps || '@remix-run/react' in deps,
  vite: (deps) => 'vite' in deps,
};

export async function detectProject(rootDir: string = process.cwd()): Promise<ProjectInfo> {
  const packageJsonPath = join(rootDir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return { framework: 'unknown', packageManager: 'unknown', hasTypeScript: false };
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Detect framework
  let framework: ProjectInfo['framework'] = 'node';
  for (const [name, detector] of Object.entries(FRAMEWORK_INDICATORS)) {
    if (detector(allDeps)) {
      framework = name as ProjectInfo['framework'];
      break;
    }
  }

  // Detect package manager
  let packageManager: ProjectInfo['packageManager'] = 'npm';
  if (existsSync(join(rootDir, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (existsSync(join(rootDir, 'yarn.lock'))) {
    packageManager = 'yarn';
  }

  // Detect TypeScript
  const hasTypeScript = 'typescript' in allDeps;
  const tsVersion = allDeps['typescript']?.replace(/^\^|~/, '');

  return { framework, packageManager, hasTypeScript, tsVersion };
}

export async function loadProjectConfig(rootDir: string = process.cwd()): Promise<unknown | null> {
  const configPath = join(rootDir, 'devhammer.config.ts');

  if (!existsSync(configPath)) {
    return null;
  }

  // Dynamic import for .ts config files
  // In production, this would use tsx or a similar loader
  try {
    const config = await import(configPath);
    return config.default ?? config;
  } catch {
    return null;
  }
}
