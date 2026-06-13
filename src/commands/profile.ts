import type { Command } from 'commander';
import type { DevhammerModule } from '../types.js';
import { profileModule } from '../modules/profile/index.js';

export const profileCommand: DevhammerModule = {
  name: 'profile',
  version: '0.1.0',
  register(program: Command): void {
    const cmd = program
      .command('profile')
      .description('Analyze performance of your project');

    cmd
      .command('bundle')
      .description('Analyze bundle size')
      .option('--json', 'Output raw JSON')
      .option('--compare', 'Compare with previous run')
      .action(async (options) => {
        await profileModule.bundle(options);
      });

    cmd
      .command('deps')
      .description('Analyze dependency tree')
      .option('--json', 'Output raw JSON')
      .option('--compare', 'Compare with previous run')
      .action(async (options) => {
        await profileModule.deps(options);
      });

    cmd
      .command('startup')
      .description('Measure startup time')
      .option('--json', 'Output raw JSON')
      .option('--compare', 'Compare with previous run')
      .option('-r, --runs <number>', 'Number of benchmark runs', '10')
      .action(async (options) => {
        await profileModule.startup(options);
      });

    cmd
      .command('all')
      .description('Run all profilers')
      .option('--json', 'Output raw JSON')
      .option('--compare', 'Compare with previous run')
      .action(async (options) => {
        await profileModule.all(options);
      });
  },
};

export function registerProfileCommand(program: Command): void {
  profileCommand.register(program);
}
