import { Command } from 'commander';

const program = new Command();

program
  .name('devhammer')
  .description('🔨 A local-first CLI toolset for TypeScript full-stack developers')
  .version('0.1.0');

import { registerConfigCommand } from './commands/config.js';
import { registerApiCommand } from './commands/api.js';
import { registerScaffoldCommand } from './commands/scaffold.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerEnvCommand } from './commands/env.js';

registerConfigCommand(program);
registerApiCommand(program);
registerScaffoldCommand(program);
registerProfileCommand(program);
registerEnvCommand(program);

program.parse();
