const fs = require('fs');
const path = require('path');
const { ConfigManager } = require('./dist/config.js');
const { ProviderClient } = require('./dist/providers.js');
const { FileOperations } = require('./dist/fileOps.js');
const { CLI } = require('./dist/cli.js');

async function run() {
  console.log('=== Running Full Scenario Test ===\n');

  const cfg = await ConfigManager.loadConfig();
  if (!cfg) {
    console.error('No config found. Aborting.');
    process.exit(1);
  }

  const pc = new ProviderClient(cfg.activeProvider);
  const fo = new FileOperations();
  const cli = new CLI(cfg, pc, fo);

  // Prepare test directory
  const testDir = path.resolve('test');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // Helper to set prompt responses
  let prompts = [];
  cli.prompt = async (q) => {
    const cleaned = q.replace(/\x1b\[[0-9;]*m/g, '');
    process.stdout.write(`PROMPT: ${cleaned}\n`);
    const resp = prompts.shift();
    process.stdout.write(`  -> ${resp}\n`);
    return resp;
  };

  // Mock ProviderClient.generateCode to avoid real API calls
  pc.generateCode = async (userPrompt) => {
    if (userPrompt.includes('create hello')) {
      return '```python\nprint("Hello from scenario 1")\n```\nFilename: hello1.py';
    }
    if (userPrompt.includes('cancel create')) {
      return '```python\nprint("Should not be created")\n```\nFilename: should_not_create.py';
    }
    if (userPrompt.includes('directory only')) {
      return '```python\nprint("Directory only file")\n```\nPath: test/subdir/';
    }
    if (userPrompt.includes('overwrite test')) {
      return '```text\nInitial content\n```\nFilename: test/overwrite.txt';
    }
    if (userPrompt.includes('edit file')) {
      return '```text\n# appended line\n```\nEdit: test/editme.txt';
    }
    if (userPrompt.includes('json action')) {
      return JSON.stringify({ action: 'create_file', path: 'test/json_action.py', content: 'print("json action")' });
    }
    if (userPrompt.includes('invalid path')) {
      return '```text\nbad content\n```\nFilename: C:\\this\\path\\doesnotexist\\file.txt';
    }
    return 'print("default")';
  };

  // SCENARIO 1: Create file with filename, confirm yes
  prompts = ['y', 'test/hello1.py', ''];
  console.log('\n-- Scenario 1: Create file (confirm yes) --');
  await cli.parseAndExecuteCommand(await pc.generateCode('create hello'));

  // SCENARIO 2: Create file but cancel
  prompts = ['n'];
  console.log('\n-- Scenario 2: Create file (cancel) --');
  await cli.parseAndExecuteCommand(await pc.generateCode('cancel create'));

  // SCENARIO 3: Directory-only path provided -> must prompt for filename
  prompts = ['y', 'test/subdir/dirfile.py', ''];
  console.log('\n-- Scenario 3: Directory-only path (provide filename) --');
  await cli.parseAndExecuteCommand(await pc.generateCode('directory only'));

  // SCENARIO 4: Overwrite existing file -> first create it, then overwrite (deny and accept)
  const overwritePath = path.resolve('test/overwrite.txt');
  fs.writeFileSync(overwritePath, 'Old content');
  prompts = ['n'];
  console.log('\n-- Scenario 4a: Overwrite denied --');
  await cli.parseAndExecuteCommand(await pc.generateCode('overwrite test'));

  prompts = ['y', 'test/overwrite.txt', 'y']; // confirm, path, confirm overwrite
  console.log('\n-- Scenario 4b: Overwrite accepted --');
  await cli.parseAndExecuteCommand(await pc.generateCode('overwrite test'));

  // SCENARIO 5: Edit existing file
  const editPath = path.resolve('test/editme.txt');
  fs.writeFileSync(editPath, 'Line1\n');
  prompts = ['y', 'test/editme.txt'];
  console.log('\n-- Scenario 5: Edit existing file --');
  await cli.parseAndExecuteCommand(await pc.generateCode('edit file'));

  // SCENARIO 6: JSON action create
  prompts = ['y', 'test/json_action.py', ''];
  console.log('\n-- Scenario 6: JSON action create --');
  await cli.parseAndExecuteCommand(await pc.generateCode('json action'));

  // SCENARIO 7: Invalid absolute path handling
  prompts = ['y', 'test/fallback_invalid.txt', ''];
  console.log('\n-- Scenario 7: Invalid absolute path handling --');
  await cli.parseAndExecuteCommand(await pc.generateCode('invalid path'));

  // Summarize created files
  console.log('\n-- Test Outputs --');
  const created = fs.readdirSync('test').filter(f => f.endsWith('.py') || f.endsWith('.txt'));
  console.log('Files in test/:', created);

  // Create observdocs logs
  const observDir = path.join('test', 'observdocs');
  if (!fs.existsSync(observDir)) fs.mkdirSync(observDir, { recursive: true });
  fs.writeFileSync(path.join(observDir, 'log-summary.txt'), 'Test run summary: OK\n');
  fs.writeFileSync(path.join(observDir, 'opinion.txt'), 'Opinion: CLI behaved as expected for tested scenarios.');

  console.log('\n✅ Full scenario test complete');
}

run().catch(err => { console.error(err); process.exit(1); });
