import type { Command } from 'commander';
import type { DevhammerModule } from '../types.js';
import { scaffoldModule } from '../modules/scaffold/index.js';

export const scaffoldCommand: DevhammerModule = {
  name: 'scaffold',
  version: '0.1.0',
  register(program: Command): void {
    const cmd = program
      .command('scaffold')
      .description('Scaffold from built-in or custom templates');

    cmd
      .command('list')
      .description('List available templates')
      .option('--tags <tags...>', 'Filter by tags')
      .action(async (options) => {
        await scaffoldModule.list(options);
      });

    cmd
      .command('<template>')
      .description('Scaffold from a built-in template')
      .option('--dry-run', 'Show what would be created')
      .option('-v, --var <vars...>', 'Variable values in key=value format')
      .option('-o, --output <dir>', 'Output directory', '.')
      .action(async (templateName, options) => {
        await scaffoldModule.scaffold(templateName, options);
      });

    cmd
      .command('create <name>')
      .description('Create a custom template from current project')
      .option('-d, --description <desc>', 'Template description')
      .option('--tags <tags...>', 'Template tags')
      .action(async (name, options) => {
        await scaffoldModule.create(name, options);
      });
  },
};

export function registerScaffoldCommand(program: Command): void {
  scaffoldCommand.register(program);
}
