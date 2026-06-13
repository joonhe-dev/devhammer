// devhammer — Performance Profiler Module
// Analyze bundle size, dependency tree, and startup time

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { logger } from '../../utils/logger.js';
import { ensureDir, readJson, writeJson, fileExists } from '../../utils/fs.js';
import type {
  BundleAnalysis,
  DepsAnalysis,
  StartupAnalysis,
  ProfileReport,
  ProfileModuleConfig,
} from '../../types.js';

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_PROFILE_DIR = '.devhammer/profile';
const DEFAULT_BUNDLE_WARNING_KB = 500;
const SINGLE_FILE_WARNING_KB = 100;
const DEFAULT_DEPS_WARNING_COUNT = 50;
const DEFAULT_STARTUP_WARNING_MS = 200;
const LARGE_DEP_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const DEFAULT_STARTUP_RUNS = 10;

// ── Helpers ──────────────────────────────────────────────────────────

function getProfileDir(rootDir: string, config?: ProfileModuleConfig): string {
  return config?.historyDir
    ? join(rootDir, config.historyDir)
    : join(rootDir, DEFAULT_PROFILE_DIR);
}

function getConfig(rootDir: string): ProfileModuleConfig {
  const configPath = join(rootDir, 'devhammer.config.json');
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return raw?.modules?.profile ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatDelta(current: number, previous: number): string {
  if (previous === 0) return 'N/A';
  const pct = ((current - previous) / previous) * 100;
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const RESET = '\x1b[0m';
  const color = pct <= 0 ? GREEN : RED;
  return `${color}${formatPercent(pct)}${RESET}`;
}

/** Compute gzip size synchronously */
function gzipSizeSync(buffer: Buffer): number {
  // Use a simple approach: spawn node -e to compute gzip
  try {
    const result = execSync(
      `node -e "const {gzipSync}=require('node:zlib');const b=Buffer.from(process.argv[1],'base64');process.stdout.write(String(gzipSync(b).length))" "${buffer.toString('base64')}"`,
      { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return parseInt(result, 10);
  } catch {
    // Fallback: rough estimate (gzip ~30% of original for text)
    return Math.round(buffer.length * 0.3);
  }
}

async function saveReport(report: ProfileReport, profileDir: string, filename: string): Promise<void> {
  await ensureDir(profileDir);
  await writeJson(join(profileDir, filename), report);
}

async function loadPreviousReport(profileDir: string, filename: string): Promise<ProfileReport | null> {
  const filePath = join(profileDir, filename);
  if (!fileExists(filePath)) return null;
  try {
    return await readJson<ProfileReport>(filePath);
  } catch {
    return null;
  }
}

function showComparison(current: ProfileReport, previous: ProfileReport): void {
  logger.heading('Comparison with Previous Run');

  if (current.bundle && previous.bundle) {
    logger.info('Bundle:');
    logger.dim(`  Total: ${formatBytes(current.bundle.totalSize)} (${formatDelta(current.bundle.totalSize, previous.bundle.totalSize)})`);
  }

  if (current.deps && previous.deps) {
    logger.info('Dependencies:');
    logger.dim(`  Count: ${current.deps.count} (${formatDelta(current.deps.count, previous.deps.count)})`);
    logger.dim(`  Total size: ${formatBytes(current.deps.totalSize)} (${formatDelta(current.deps.totalSize, previous.deps.totalSize)})`);
  }

  if (current.startup && previous.startup) {
    logger.info('Startup:');
    logger.dim(`  Avg: ${current.startup.avgMs.toFixed(1)}ms (${formatDelta(current.startup.avgMs, previous.startup.avgMs)})`);
    logger.dim(`  Min: ${current.startup.minMs.toFixed(1)}ms (${formatDelta(current.startup.minMs, previous.startup.minMs)})`);
    logger.dim(`  Max: ${current.startup.maxMs.toFixed(1)}ms (${formatDelta(current.startup.maxMs, previous.startup.maxMs)})`);
  }
}

// ── bundle ────────────────────────────────────────────────────────────

function analyzeBundle(rootDir: string, _config: ProfileModuleConfig): BundleAnalysis {
  const distDir = join(rootDir, 'dist');

  // Try to find tsup metafile
  const metafilePath =
    fileExists(join(distDir, '.tsup', 'build.json'))
      ? join(distDir, '.tsup', 'build.json')
      : fileExists(join(distDir, 'metafile.json'))
        ? join(distDir, 'metafile.json')
        : null;

  if (metafilePath) {
    return parseMetafile(metafilePath, rootDir);
  }

  // Try running tsup with metafile
  logger.info('No metafile found, attempting to build with --metafile...');
  try {
    execSync('npx tsup --metafile', {
      cwd: rootDir,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });

    // Check again after build
    const afterBuildMetafile =
      fileExists(join(distDir, '.tsup', 'build.json'))
        ? join(distDir, '.tsup', 'build.json')
        : fileExists(join(distDir, 'metafile.json'))
          ? join(distDir, 'metafile.json')
          : null;

    if (afterBuildMetafile) {
      return parseMetafile(afterBuildMetafile, rootDir);
    }
  } catch {
    // Build failed, fall through to directory scan
  }

  // Fallback: scan dist directory
  return scanDistDirectory(distDir, rootDir);
}

export function parseMetafile(metafilePath: string, rootDir: string): BundleAnalysis {
  const raw = JSON.parse(readFileSync(metafilePath, 'utf-8'));
  const files: BundleAnalysis['files'] = [];

  // esbuild metafile format: { outputs: { [path]: { bytes, inputs } } }
  const outputs = raw.outputs ?? raw;

  let totalSize = 0;

  for (const [outputPath, info] of Object.entries(outputs)) {
    const entry = info as { bytes?: number; inputs?: Record<string, unknown> };
    if (typeof entry.bytes !== 'number') continue;

    const absPath = join(rootDir, outputPath);
    let gzipSize = 0;
    try {
      if (existsSync(absPath)) {
        const buf = readFileSync(absPath);
        gzipSize = gzipSizeSync(buf);
      }
    } catch {
      gzipSize = Math.round(entry.bytes * 0.3);
    }

    const relPath = relative(rootDir, outputPath);
    files.push({
      path: relPath,
      size: entry.bytes,
      gzipSize,
    });

    totalSize += entry.bytes;
  }

  // Sort by size descending
  files.sort((a, b) => b.size - a.size);

  return { totalSize, files };
}

export function scanDistDirectory(distDir: string, rootDir: string): BundleAnalysis {
  const files: BundleAnalysis['files'] = [];
  let totalSize = 0;

  if (!existsSync(distDir)) {
    return { totalSize: 0, files: [] };
  }

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = statSync(fullPath);
          const buf = readFileSync(fullPath);
          const gzipSize = gzipSizeSync(buf);
          const relPath = relative(rootDir, fullPath);

          files.push({
            path: relPath,
            size: stat.size,
            gzipSize,
          });
          totalSize += stat.size;
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walk(distDir);
  files.sort((a, b) => b.size - a.size);

  return { totalSize, files };
}

// ── deps ──────────────────────────────────────────────────────────────

export function analyzeDeps(rootDir: string, _config: ProfileModuleConfig): DepsAnalysis {
  const pkgPath = join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return { totalSize: 0, count: 0, duplicates: [], large: [] };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const depNames = Object.keys(deps);

  const nodeModulesDir = join(rootDir, 'node_modules');
  if (!existsSync(nodeModulesDir)) {
    return { totalSize: 0, count: depNames.length, duplicates: [], large: [] };
  }

  // Track package versions across nested node_modules
  const versionMap = new Map<string, Set<string>>();
  const sizeMap = new Map<string, number>();

  function walkNodeModules(dir: string): void {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip .cache, .bin, .package-lock.json etc.
      if (entry.name.startsWith('.')) continue;

      const pkgJsonPath = join(dir, entry.name, 'package.json');

      // Handle scoped packages (@scope/name)
      if (entry.name.startsWith('@')) {
        const scopeDir = join(dir, entry.name);
        try {
          const scopeEntries = readdirSync(scopeDir, { withFileTypes: true });
          for (const scopedEntry of scopeEntries) {
            if (!scopedEntry.isDirectory()) continue;
            const scopedPkgJsonPath = join(scopeDir, scopedEntry.name, 'package.json');
            processPackage(scopedPkgJsonPath, `${entry.name}/${scopedEntry.name}`, scopeDir);
          }
        } catch {
          // Skip unreadable directories
        }
        continue;
      }

      processPackage(pkgJsonPath, entry.name, dir);
    }
  }

  function processPackage(pkgJsonPath: string, name: string, parentDir: string): void {
    try {
      if (!existsSync(pkgJsonPath)) return;
      const pkgData = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const version = String(pkgData.version ?? '0.0.0');

      // Track version
      if (!versionMap.has(name)) {
        versionMap.set(name, new Set());
      }
      versionMap.get(name)!.add(version);

      // Calculate size of the package directory
      // For scoped packages, the actual dir is the scope dir
      const actualDir = name.includes('/') ? join(parentDir, name) : join(parentDir, name.split('/')[0]!);

      if (!sizeMap.has(name)) {
        try {
          const size = calcDirSize(actualDir);
          sizeMap.set(name, size);
        } catch {
          sizeMap.set(name, 0);
        }
      }

      // Walk nested node_modules
      const nestedModules = join(actualDir, 'node_modules');
      if (existsSync(nestedModules)) {
        walkNodeModules(nestedModules);
      }
    } catch {
      // Skip unreadable packages
    }
  }

  function calcDirSize(dir: string): number {
    let size = 0;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue; // Don't count nested node_modules in size
          size += calcDirSize(fullPath);
        } else if (entry.isFile()) {
          try {
            size += statSync(fullPath).size;
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Skip
    }
    return size;
  }

  walkNodeModules(nodeModulesDir);

  // Find duplicates (same package, multiple versions)
  const duplicates: DepsAnalysis['duplicates'] = [];
  for (const [name, versions] of versionMap) {
    if (versions.size > 1) {
      duplicates.push({ name, versions: [...versions] });
    }
  }
  duplicates.sort((a, b) => a.name.localeCompare(b.name));

  // Find large packages
  const large: DepsAnalysis['large'] = [];
  for (const [name, size] of sizeMap) {
    if (size > LARGE_DEP_THRESHOLD) {
      large.push({ name, size });
    }
  }
  large.sort((a, b) => b.size - a.size);

  // Total size of direct node_modules children
  let totalSize = 0;
  for (const size of sizeMap.values()) {
    totalSize += size;
  }

  return {
    totalSize,
    count: versionMap.size,
    duplicates,
    large,
  };
}

// ── startup ───────────────────────────────────────────────────────────

export function measureStartup(rootDir: string, runs: number, _config: ProfileModuleConfig): StartupAnalysis {
  const entryFile = join(rootDir, 'dist', 'index.js');

  if (!existsSync(entryFile)) {
    logger.warn('No dist/index.js found. Run build first.');
    return { avgMs: 0, minMs: 0, maxMs: 0, runs: 0 };
  }

  const times: number[] = [];

  // Create a measurement script that uses performance.now() for precision
  const measureScript = `
    const { execSync } = require('node:child_process');
    const times = [];
    for (let i = 0; i < ${runs}; i++) {
      const start = process.hrtime.bigint();
      try {
        execSync('node "${entryFile.replace(/\\/g, '\\\\')}" --help', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 10000,
        });
      } catch {}
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1e6);
    }
    process.stdout.write(JSON.stringify(times));
  `;

  try {
    const result = execSync(`node -e "${measureScript.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      timeout: 300000, // 5 min max
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      for (const t of parsed) {
        if (typeof t === 'number' && t > 0) {
          times.push(t);
        }
      }
    }
  } catch {
    // Fallback: individual measurements
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      try {
        execSync(`node "${entryFile}" --help`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 10000,
        });
      } catch {
        // Command may fail, still measure time
      }
      const end = Date.now();
      times.push(end - start);
    }
  }

  if (times.length === 0) {
    return { avgMs: 0, minMs: 0, maxMs: 0, runs: 0 };
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return { avgMs, minMs, maxMs, runs: times.length };
}

// ── Public API ───────────────────────────────────────────────────────

export const profileModule = {
  async bundle(options: { json?: boolean; compare?: boolean }): Promise<void> {
    const rootDir = process.cwd();
    const config = getConfig(rootDir);
    const profileDir = getProfileDir(rootDir, config);
    const warningKB = config.bundleWarningKB ?? DEFAULT_BUNDLE_WARNING_KB;

    logger.info('Analyzing bundle size...');

    const analysis = analyzeBundle(rootDir, config);
    const report: ProfileReport = { timestamp: Date.now(), bundle: analysis };

    // Save report
    await saveReport(report, profileDir, 'bundle.json');

    // Compare with previous
    if (options.compare) {
      const previous = await loadPreviousReport(profileDir, 'bundle.json.previous');
      if (previous?.bundle) {
        showComparison(report, previous);
      } else {
        logger.info('No previous bundle report found for comparison.');
      }
    }

    // Save current as previous for next comparison
    const prevPath = join(profileDir, 'bundle.json.previous');
    if (existsSync(join(profileDir, 'bundle.json'))) {
      mkdirSync(profileDir, { recursive: true });
      writeFileSync(prevPath, JSON.stringify(report, null, 2), 'utf-8');
    }

    // Output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Human-readable output
    logger.heading('Bundle Analysis');

    if (analysis.files.length === 0) {
      logger.warn('No bundle files found. Run a build first.');
      return;
    }

    logger.info(`Total size: ${formatBytes(analysis.totalSize)}`);

    if (analysis.totalSize > warningKB * 1024) {
      logger.warn(`Bundle exceeds ${warningKB}KB threshold!`);
    } else {
      logger.success(`Bundle is under ${warningKB}KB threshold.`);
    }

    // Warn about individual large files (>100KB)
    const largeFiles = analysis.files.filter((f) => f.size > SINGLE_FILE_WARNING_KB * 1024);
    if (largeFiles.length > 0) {
      logger.warn(`${largeFiles.length} file(s) exceed ${SINGLE_FILE_WARNING_KB}KB:`);
      for (const f of largeFiles) {
        logger.dim(`  ${f.path}: ${formatBytes(f.size)}`);
      }
    }

    logger.dim('');
    logger.info('Files:');

    const tableData = analysis.files.slice(0, 20).map((f) => ({
      File: f.path.length > 50 ? '...' + f.path.slice(-47) : f.path,
      Size: formatBytes(f.size),
      Gzip: formatBytes(f.gzipSize),
    }));

    if (analysis.files.length > 20) {
      logger.dim(`  (showing top 20 of ${analysis.files.length} files)`);
    }

    logger.table(tableData as Record<string, unknown>[]);
  },

  async deps(options: { json?: boolean; compare?: boolean }): Promise<void> {
    const rootDir = process.cwd();
    const config = getConfig(rootDir);
    const profileDir = getProfileDir(rootDir, config);
    const warningCount = config.depsWarningCount ?? DEFAULT_DEPS_WARNING_COUNT;

    logger.info('Analyzing dependency tree...');

    const analysis = analyzeDeps(rootDir, config);
    const report: ProfileReport = { timestamp: Date.now(), deps: analysis };

    // Save report
    await saveReport(report, profileDir, 'deps.json');

    // Compare with previous
    if (options.compare) {
      const previous = await loadPreviousReport(profileDir, 'deps.json.previous');
      if (previous?.deps) {
        showComparison(report, previous);
      } else {
        logger.info('No previous deps report found for comparison.');
      }
    }

    // Save current as previous
    const prevPath = join(profileDir, 'deps.json.previous');
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(prevPath, JSON.stringify(report, null, 2), 'utf-8');

    // Output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    logger.heading('Dependency Analysis');

    logger.info(`Total packages: ${analysis.count}`);
    logger.info(`Total size: ${formatBytes(analysis.totalSize)}`);

    if (analysis.count > warningCount) {
      logger.warn(`Dependency count exceeds ${warningCount} threshold!`);
    } else {
      logger.success(`Dependency count is under ${warningCount} threshold.`);
    }

    if (analysis.duplicates.length > 0) {
      logger.dim('');
      logger.warn(`Duplicate packages found (${analysis.duplicates.length}):`);
      for (const dup of analysis.duplicates.slice(0, 10)) {
        logger.dim(`  ${dup.name}: ${dup.versions.join(', ')}`);
      }
      if (analysis.duplicates.length > 10) {
        logger.dim(`  (and ${analysis.duplicates.length - 10} more)`);
      }
    } else {
      logger.success('No duplicate packages found.');
    }

    if (analysis.large.length > 0) {
      logger.dim('');
      logger.warn(`Large packages (>5MB):`);
      const largeData = analysis.large.slice(0, 10).map((l) => ({
        Package: l.name,
        Size: formatBytes(l.size),
      }));
      logger.table(largeData as Record<string, unknown>[]);
    }
  },

  async startup(options: { json?: boolean; compare?: boolean; runs?: string }): Promise<void> {
    const rootDir = process.cwd();
    const config = getConfig(rootDir);
    const profileDir = getProfileDir(rootDir, config);
    const warningMs = config.startupWarningMs ?? DEFAULT_STARTUP_WARNING_MS;
    const runs = Math.max(1, parseInt(options.runs ?? String(DEFAULT_STARTUP_RUNS), 10) || DEFAULT_STARTUP_RUNS);

    logger.info(`Benchmarking startup time (${runs} runs)...`);

    const analysis = measureStartup(rootDir, runs, config);
    const report: ProfileReport = { timestamp: Date.now(), startup: analysis };

    // Save report
    await saveReport(report, profileDir, 'startup.json');

    // Compare with previous
    if (options.compare) {
      const previous = await loadPreviousReport(profileDir, 'startup.json.previous');
      if (previous?.startup) {
        showComparison(report, previous);
      } else {
        logger.info('No previous startup report found for comparison.');
      }
    }

    // Save current as previous
    const prevPath = join(profileDir, 'startup.json.previous');
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(prevPath, JSON.stringify(report, null, 2), 'utf-8');

    // Output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    logger.heading('Startup Benchmark');

    if (analysis.runs === 0) {
      logger.warn('Could not measure startup time. Is the project built?');
      return;
    }

    logger.info(`Runs: ${analysis.runs}`);
    logger.info(`Average: ${analysis.avgMs.toFixed(1)}ms`);
    logger.info(`Min: ${analysis.minMs.toFixed(1)}ms`);
    logger.info(`Max: ${analysis.maxMs.toFixed(1)}ms`);

    if (analysis.avgMs > warningMs) {
      logger.warn(`Average startup time exceeds ${warningMs}ms threshold!`);
    } else {
      logger.success(`Startup time is under ${warningMs}ms threshold.`);
    }
  },

  async all(options: { json?: boolean; compare?: boolean }): Promise<void> {
    const rootDir = process.cwd();
    const config = getConfig(rootDir);
    const profileDir = getProfileDir(rootDir, config);

    logger.heading('Running All Profilers');

    const bundleAnalysis = analyzeBundle(rootDir, config);
    const depsAnalysis = analyzeDeps(rootDir, config);
    const startupAnalysis = measureStartup(rootDir, DEFAULT_STARTUP_RUNS, config);

    const report: ProfileReport = {
      timestamp: Date.now(),
      bundle: bundleAnalysis,
      deps: depsAnalysis,
      startup: startupAnalysis,
    };

    // Save combined report
    await saveReport(report, profileDir, 'report.json');

    // Compare with previous
    if (options.compare) {
      const previous = await loadPreviousReport(profileDir, 'report.json.previous');
      if (previous) {
        showComparison(report, previous);
      } else {
        logger.info('No previous report found for comparison.');
      }
    }

    // Save current as previous
    const prevPath = join(profileDir, 'report.json.previous');
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(prevPath, JSON.stringify(report, null, 2), 'utf-8');

    // Output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Human-readable summary
    const warningKB = config.bundleWarningKB ?? DEFAULT_BUNDLE_WARNING_KB;
    const warningCount = config.depsWarningCount ?? DEFAULT_DEPS_WARNING_COUNT;
    const warningMs = config.startupWarningMs ?? DEFAULT_STARTUP_WARNING_MS;

    logger.heading('Bundle');
    logger.info(`  Total size: ${formatBytes(bundleAnalysis.totalSize)}`);
    logger.info(`  Files: ${bundleAnalysis.files.length}`);
    if (bundleAnalysis.totalSize > warningKB * 1024) {
      logger.warn(`  Exceeds ${warningKB}KB threshold!`);
    }

    logger.heading('Dependencies');
    logger.info(`  Count: ${depsAnalysis.count}`);
    logger.info(`  Total size: ${formatBytes(depsAnalysis.totalSize)}`);
    logger.info(`  Duplicates: ${depsAnalysis.duplicates.length}`);
    logger.info(`  Large (>5MB): ${depsAnalysis.large.length}`);
    if (depsAnalysis.count > warningCount) {
      logger.warn(`  Exceeds ${warningCount} package threshold!`);
    }

    logger.heading('Startup');
    logger.info(`  Runs: ${startupAnalysis.runs}`);
    logger.info(`  Average: ${startupAnalysis.avgMs.toFixed(1)}ms`);
    logger.info(`  Min: ${startupAnalysis.minMs.toFixed(1)}ms`);
    logger.info(`  Max: ${startupAnalysis.maxMs.toFixed(1)}ms`);
    if (startupAnalysis.avgMs > warningMs) {
      logger.warn(`  Exceeds ${warningMs}ms threshold!`);
    }

    logger.dim('');
    logger.success(`Report saved to ${join(profileDir, 'report.json')}`);
  },
};
