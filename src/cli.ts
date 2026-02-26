import { Command } from 'commander';
import { ToolManager } from './index.js';

const program = new Command();
const manager = new ToolManager();

program
  .name('ishikawa')
  .description('Ishikawa-Toolkit CLI')
  .version('2.0.0');

program
  .command('list')
  .description('List all registered tools')
  .action(async () => {
    const tools = await manager.listTools();
    if (tools.length === 0) {
      console.log('No tools registered.');
      return;
    }
    tools.forEach(tool => console.log(`- ${tool}`));
  });

program.parse();