import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { executeImport } from '../src/cli/commands/import.js';
import { loadPrompt } from '../src/node/storage/storage.js';
import { cleanupTempStore, makeTempStore, type TempStore } from './helpers/tempStore.js';

function sendJson(res: ServerResponse<IncomingMessage>, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

describe('Import Command (URL)', () => {
  let baseUrl = '';
  let server: ReturnType<typeof createServer> | null = null;
  let temp: TempStore;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = req.url ?? '/';
      if (url === '/prompt') {
        sendJson(res, 200, {
          kind: 'prompt',
          schemaVersion: '1',
          name: 'import-url-test-prompt',
          content: 'Hello from URL',
        });
        return;
      }

      if (url === '/redirect') {
        res.writeHead(302, { location: '/prompt' });
        res.end();
        return;
      }

      if (url === '/loop') {
        res.writeHead(302, { location: '/loop' });
        res.end();
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    await new Promise<void>(resolve => server!.listen(0, resolve));
    const addr = server!.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server?.close(() => resolve()));
  });

  beforeEach(async () => {
    temp = await makeTempStore('promptg-import-url-store-');
  });

  afterEach(async () => {
    await cleanupTempStore(temp.tmpDir);
  });

  it('imports a prompt from a URL', async () => {
    await executeImport(`${baseUrl}/prompt`, { url: true, quiet: true }, temp.store);
    const loaded = await loadPrompt('import-url-test-prompt', temp.store);
    expect(loaded.content).toBe('Hello from URL');
  });

  it('follows redirects (up to maxRedirects)', async () => {
    await executeImport(`${baseUrl}/redirect`, { url: true, quiet: true }, temp.store);
    const loaded = await loadPrompt('import-url-test-prompt', temp.store);
    expect(loaded.content).toBe('Hello from URL');
  });

  it('fails on redirect loops', async () => {
    await expect(
      executeImport(`${baseUrl}/loop`, { url: true, quiet: true }, temp.store)
    ).rejects.toThrow(/Too many redirects/i);
  });

  it('fails on non-2xx responses', async () => {
    await expect(
      executeImport(`${baseUrl}/nope`, { url: true, quiet: true }, temp.store)
    ).rejects.toThrow(/HTTP 404/);
  });
});
