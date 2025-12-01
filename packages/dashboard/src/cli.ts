#!/usr/bin/env node
/**
 * MDAP Dashboard CLI
 *
 * Usage:
 *   npx mdap-dashboard
 *   npx mdap-dashboard --port 8080
 */

import { startDashboard } from './server.js';

const args = process.argv.slice(2);

interface CliOptions {
  port: number;
  host: string;
  verbose: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    port: 3000,
    host: 'localhost',
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--port':
      case '-p':
        options.port = parseInt(next, 10);
        i++;
        break;
      case '--host':
      case '-h':
        options.host = next;
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
MDAP Dashboard

Monitor your MDAP workflows in real-time.

USAGE
  mdap-dashboard [options]

OPTIONS
  --port, -p <port>    Port to run on (default: 3000)
  --host, -h <host>    Host to bind to (default: localhost)
  --verbose, -v        Enable verbose logging
  --help               Show this help message

EXAMPLES
  mdap-dashboard
  mdap-dashboard --port 8080
  mdap-dashboard --host 0.0.0.0 --port 3000
`);
}

async function main() {
  const options = parseArgs(args);

  console.log(`
  ╔═══════════════════════════════════════╗
  ║          MDAP Dashboard               ║
  ║   Make your AI agents reliable        ║
  ╚═══════════════════════════════════════╝
  `);

  try {
    await startDashboard({
      port: options.port,
      host: options.host,
      verbose: options.verbose
    });

    console.log(`
  Open http://${options.host}:${options.port} in your browser

  Press Ctrl+C to stop
    `);
  } catch (error) {
    console.error('Failed to start dashboard:', error);
    process.exit(1);
  }
}

main();
