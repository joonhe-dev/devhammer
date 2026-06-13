import type { Command } from 'commander';
import type { DevhammerModule } from '../types.js';
import { envModule } from '../modules/env/index.js';

export const envCommand: DevhammerModule = {
  name: 'env',
  version: '0.1.0',
  register(program: Command): void {
    const cmd = program
      .command('env')
      .description('Manage environment variables safely');

    cmd
      .command('init')
      .description('Create .env from .env.example with interactive prompts')
      .option('-s, --source <file>', 'Source file', '.env.example')
      .option('-o, --output <file>', 'Output file', '.env')
      .option('--no-interactive', 'Skip interactive prompts, use defaults')
      .action(async (options) => {
        await envModule.init(options);
      });

    cmd
      .command('encrypt')
      .description('Encrypt .env to .env.encrypted')
      .option('-i, --input <file>', 'Input file', '.env')
      .option('-o, --output <file>', 'Output file', '.env.encrypted')
      .option('-k, --key <key>', 'Encryption key (or set ENCRYPTION_KEY env)')
      .action(async (options) => {
        await envModule.encrypt(options);
      });

    cmd
      .command('decrypt')
      .description('Decrypt .env.encrypted to .env')
      .option('-i, --input <file>', 'Input file', '.env.encrypted')
      .option('-o, --output <file>', 'Output file', '.env')
      .option('-k, --key <key>', 'Decryption key (or set ENCRYPTION_KEY env)')
      .action(async (options) => {
        await envModule.decrypt(options);
      });

    cmd
      .command('diff')
      .description('Compare .env and .env.example for missing keys')
      .option('--source <file>', 'Reference file', '.env.example')
      .option('--target <file>', 'Target file', '.env')
      .action(async (options) => {
        await envModule.diff(options);
      });

    cmd
      .command('validate')
      .description('Validate .env against a schema')
      .option('-f, --file <file>', 'Env file to validate', '.env')
      .option('-s, --schema <file>', 'Schema file (auto-inferred from .env.example if omitted)')
      .action(async (options) => {
        await envModule.validate(options);
      });
  },
};

export function registerEnvCommand(program: Command): void {
  envCommand.register(program);
}
