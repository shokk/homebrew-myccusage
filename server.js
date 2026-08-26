#!/usr/bin/env node
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const pkg = require('./package.json');

function parseArgs(argv) {
  const opts = { port: Number(process.env.PORT) || 4317, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--version' || arg === '-v') {
      opts.showVersion = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.showHelp = true;
    } else if (arg === '--port' || arg === '-p') {
      opts.port = Number(argv[++i]);
    } else if (arg === '--host') {
      opts.host = argv[++i];
    }
  }
  return opts;
}

function printHelp() {
  console.log(`myccusage ${pkg.version}

Usage: myccusage [options]

Options:
  -p, --port <number>   Port to listen on (default: 4317, or $PORT)
      --host <address>  Address to bind to (default: 127.0.0.1)
  -v, --version          Print the version and exit
  -h, --help             Print this help and exit

Requires the \`ccusage\` CLI to be installed and on your PATH.`);
}

function checkCcusageAvailable(callback) {
  execFile('ccusage', ['--version'], (err) => {
    callback(!err);
  });
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const GRANULARITIES = new Set(['daily', 'weekly', 'monthly']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function runCcusage(granularity, since, until) {
  return new Promise((resolve, reject) => {
    const args = [granularity, '--json', '--by-agent'];
    if (since) args.push('--since', since);
    if (until) args.push('--until', until);
    execFile('ccusage', args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (parseErr) {
        reject(new Error(`Failed to parse ccusage output: ${parseErr.message}`));
      }
    });
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.join(PUBLIC_DIR, filePath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/usage') {
      const granularity = url.searchParams.get('granularity') || 'daily';
      if (!GRANULARITIES.has(granularity)) {
        sendJson(res, 400, { error: `granularity must be one of ${[...GRANULARITIES].join(', ')}` });
        return;
      }
      const since = url.searchParams.get('since') || undefined;
      const until = url.searchParams.get('until') || undefined;
      try {
        const data = await runCcusage(granularity, since, until);
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, 502, { error: err.message });
      }
      return;
    }

    serveStatic(req, res, url.pathname);
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.showVersion) {
    console.log(pkg.version);
    return;
  }
  if (opts.showHelp) {
    printHelp();
    return;
  }

  checkCcusageAvailable((available) => {
    if (!available) {
      console.error('myccusage: the `ccusage` CLI was not found on your PATH.');
      console.error('Install it with: brew install ccusage');
      process.exitCode = 1;
      return;
    }

    const server = createServer();
    server.listen(opts.port, opts.host, () => {
      console.log(`myccusage running at http://${opts.host}:${opts.port}`);
    });
  });
}

if (require.main === module) {
  main();
}

module.exports = { createServer, parseArgs };
