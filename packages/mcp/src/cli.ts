#!/usr/bin/env node
/**
 * MDAP MCP Server CLI
 *
 * Run with: npx @mdap/mcp
 * Or add to your MCP config:
 *
 * {
 *   "mcpServers": {
 *     "mdap": {
 *       "command": "npx",
 *       "args": ["@mdap/mcp"]
 *     }
 *   }
 * }
 */

import { startServer } from './index.js';

startServer()
  .then(() => {
    // Server is running, keep process alive
  })
  .catch((error) => {
    console.error('Failed to start MDAP MCP server:', error);
    process.exit(1);
  });
