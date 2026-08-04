#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nodeModulesBin = join(__dirname, '../../node_modules/.bin');
import { delimiter } from 'path';
process.env.PATH = nodeModulesBin + delimiter + process.env.PATH;

const childArgs = [join(__dirname, '../dist/index.js'), ...process.argv.slice(2)];
const child = spawn('node', childArgs, {
  stdio: 'inherit',
});

process.on('exit', () => child.kill());

