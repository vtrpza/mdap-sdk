/**
 * Dashboard Server
 *
 * Serves the dashboard web UI and provides a REST API
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DashboardConfig, DashboardEvent } from './types.js';
import { getTracker, WorkflowTracker } from './tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * MIME types for serving static files
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Dashboard server
 */
export class DashboardServer {
  private server: http.Server | null = null;
  private tracker: WorkflowTracker;
  private config: Required<DashboardConfig>;
  private sseClients: Set<http.ServerResponse> = new Set();

  constructor(config: DashboardConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? 'localhost',
      maxWorkflows: config.maxWorkflows ?? 100,
      verbose: config.verbose ?? false
    };

    this.tracker = getTracker(this.config.maxWorkflows);

    // Subscribe to tracker events for SSE
    this.tracker.subscribe((event) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Broadcast an event to all SSE clients
   */
  private broadcastEvent(event: DashboardEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(data);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (this.config.verbose) {
      console.log(`[MDAP Dashboard] ${req.method} ${pathname}`);
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      this.handleApiRequest(pathname, req, res);
      return;
    }

    // SSE endpoint
    if (pathname === '/events') {
      this.handleSSE(req, res);
      return;
    }

    // Static files
    this.serveStaticFile(pathname, res);
  }

  /**
   * Handle API requests
   */
  private handleApiRequest(
    pathname: string,
    _req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (pathname === '/api/stats') {
        res.end(JSON.stringify(this.tracker.getStats()));
        return;
      }

      if (pathname === '/api/workflows') {
        res.end(JSON.stringify(this.tracker.getWorkflows()));
        return;
      }

      if (pathname.startsWith('/api/workflows/')) {
        const id = pathname.slice('/api/workflows/'.length);
        const workflow = this.tracker.getWorkflow(id);
        if (workflow) {
          res.end(JSON.stringify(workflow));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Workflow not found' }));
        }
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
  }

  /**
   * Handle Server-Sent Events connection
   */
  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial stats
    res.write(`data: ${JSON.stringify({ type: 'stats:update', stats: this.tracker.getStats() })}\n\n`);

    this.sseClients.add(res);

    req.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  /**
   * Serve static files
   */
  private serveStaticFile(pathname: string, res: http.ServerResponse): void {
    // Default to index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const publicDir = path.join(__dirname, 'public');
    const filePath = path.join(publicDir, pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // Serve index.html for SPA routing
          fs.readFile(path.join(publicDir, 'index.html'), (err2, data2) => {
            if (err2) {
              res.statusCode = 404;
              res.end('Not found');
            } else {
              res.setHeader('Content-Type', 'text/html');
              res.end(data2);
            }
          });
        } else {
          res.statusCode = 500;
          res.end('Server error');
        }
        return;
      }

      res.setHeader('Content-Type', mimeType);
      res.end(data);
    });
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`MDAP Dashboard running at http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all SSE connections
      for (const client of this.sseClients) {
        client.end();
      }
      this.sseClients.clear();

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the tracker instance
   */
  getTracker(): WorkflowTracker {
    return this.tracker;
  }
}

/**
 * Create and start a dashboard server
 */
export async function startDashboard(config: DashboardConfig = {}): Promise<DashboardServer> {
  const server = new DashboardServer(config);
  await server.start();
  return server;
}
