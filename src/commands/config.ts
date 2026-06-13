import { Command } from 'commander';
import { generateConfig, generateAllConfigs, listConfigTypes } from '../modules/config/index.js';

/**
 * Register the `devhammer config` command and its subcommands
 * with the Commander program.
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Generate configuration files with smart defaults')
    .action(() => {
      listConfigTypes();
    });

  configCmd
    .command('eslint')
    .description('Generate .eslintrc.* with framework-aware rules')
    .option('--dry-run', 'Print to stdout without writing files')
    .action(async (opts) => {
      try {
        await generateConfig('eslint', { dryRun: opts.dryRun ?? false, rootDir: process.cwd() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
      }
    });

  configCmd
    .command('prettier')
    .description('Generate .prettierrc with sensible defaults')
    .option('--dry-run', 'Print to stdout without writing files')
    .action(async (opts) => {
      try {
        await generateConfig('prettier', { dryRun: opts.dryRun ?? false, rootDir: process.cwd() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
      }
    });

  configCmd
    .command('tsconfig')
    .description('Generate tsconfig.json for the detected environment')
    .option('--dry-run', 'Print to stdout without writing files')
    .action(async (opts) => {
      try {
        await generateConfig('tsconfig', { dryRun: opts.dryRun ?? false, rootDir: process.cwd() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
      }
    });

  configCmd
    .command('tailwind')
    .description('Generate tailwind.config.ts with common presets')
    .option('--dry-run', 'Print to stdout without writing files')
    .action(async (opts) => {
      try {
        await generateConfig('tailwind', { dryRun: opts.dryRun ?? false, rootDir: process.cwd() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
      }
    });

  configCmd
    .command('all')
    .description('Generate all config files with consistent settings')
    .option('--dry-run', 'Print to stdout without writing files')
    .action(async (opts) => {
      try {
        await generateAllConfigs({ dryRun: opts.dryRun ?? false, rootDir: process.cwd() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
      }
    });
}
