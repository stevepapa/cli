import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { InfraError } from '../../core/infra/errors.js';
import {
  getTemplatesDir,
  initializeDirectories,
  loadPrompt,
  promptExists,
  savePrompt,
  type StorageOptions,
} from '../storage/storage.js';
import {
  detectImportKind,
  normalizeImportedPrompt,
  normalizeImportedTemplate,
  type ImportKind,
} from '../../core/importing/normalize.js';
import { TEMPLATE_FILE_PREFIX, TEMPLATE_SCHEMA_URL, X_PROMPTG_TIME } from '../../core/spec.js';
import { writeTextFileAtomic } from '../fs/writeAtomic.js';
import { parseTemplateJsonText } from '../../core/parsing/template.js';
import { validateEncoding } from '../../core/parsing/bomDetection.js';

export { detectImportKind, normalizeImportedPrompt, normalizeImportedTemplate };
export type { ImportKind };

export async function readJsonFromFile(filePathInput: string): Promise<unknown> {
  const filePath = filePathInput.trim().replace(/^"(.*)"$/, '$1');
  try {
    const buffer = await fs.readFile(filePath);

    // Validate encoding (no BOM allowed)
    const encodingCheck = validateEncoding(buffer);
    if (!encodingCheck.ok) {
      throw new InfraError({
        infraCode: 'INVALID_DATA',
        message: encodingCheck.error,
        details: { filePath },
      });
    }

    const content = buffer.toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof InfraError) throw error;
    throw new InfraError({
      infraCode: 'IO',
      message: `Failed to read JSON from file: ${filePath}`,
      details: { filePath, cause: error instanceof Error ? error.message : String(error) },
    });
  }
}

const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_REDIRECTS = 5;

async function readTextFromUrl(
  url: URL,
  maxBytes = 2_000_000,
  opts?: { timeoutMs?: number; maxRedirects?: number }
): Promise<string> {
  const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts.timeoutMs : DEFAULT_HTTP_TIMEOUT_MS;
  const maxRedirects =
    typeof opts?.maxRedirects === 'number' ? opts.maxRedirects : DEFAULT_MAX_REDIRECTS;

  let current = url;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(current, { redirect: 'manual', signal: controller.signal });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      throw new InfraError({
        infraCode: 'NETWORK',
        message: isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : `Failed to fetch URL: ${current.toString()}`,
        details: {
          url: current.toString(),
          timeoutMs,
          cause: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location) {
        throw new InfraError({
          infraCode: 'NETWORK',
          message: `Redirect response missing Location header (HTTP ${res.status})`,
          details: { url: current.toString(), status: res.status },
        });
      }
      if (redirects >= maxRedirects) {
        throw new InfraError({
          infraCode: 'NETWORK',
          message: 'Too many redirects.',
          details: { url: url.toString(), maxRedirects },
        });
      }
      current = new URL(location, current);
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new InfraError({
        infraCode: 'NETWORK',
        message: `HTTP ${res.status}`,
        details: { url: current.toString(), status: res.status, statusText: res.statusText },
      });
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return await res.text();
    }

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new InfraError({
            infraCode: 'NETWORK',
            message: 'Response too large',
            details: { url: current.toString(), maxBytes, receivedBytes: total },
          });
        }
        chunks.push(value);
      }
    }

    const buffers = chunks.map(chunk => Buffer.from(chunk));
    return Buffer.concat(buffers).toString('utf8');
  }

  throw new InfraError({
    infraCode: 'NETWORK',
    message: 'Too many redirects.',
    details: { url: url.toString(), maxRedirects },
  });
}

export async function readJsonFromUrl(urlInput: string): Promise<unknown> {
  const url = new URL(urlInput.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: 'URL must start with http:// or https://',
      details: { url: urlInput.trim() },
    });
  }
  const text = await readTextFromUrl(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: 'Invalid JSON from URL.',
      details: {
        url: url.toString(),
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export async function importJsonData(params: {
  data: unknown;
  store?: StorageOptions;
  force: boolean;
}): Promise<{ kind: ImportKind; name: string }> {
  const kind = detectImportKind(params.data);

  if (kind === 'template') {
    const normalized = normalizeImportedTemplate(params.data);
    if (!normalized.ok) {
      throw new InfraError({
        infraCode: 'INVALID_DATA',
        message: `Invalid template JSON: ${normalized.error}`,
      });
    }

    await initializeDirectories(params.store);
    const outPath = path.join(
      getTemplatesDir(params.store),
      `${TEMPLATE_FILE_PREFIX}${normalized.value.name}.json`
    );

    const alreadyExists = await fs
      .access(outPath)
      .then(() => true)
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') return false;
        throw e;
      });

    if (alreadyExists && !params.force) {
      throw new InfraError({
        infraCode: 'CONFLICT',
        message: `Template "${normalized.value.name}" already exists. Use --force to overwrite.`,
        details: { kind: 'template', name: normalized.value.name },
      });
    }

    if (alreadyExists && params.force) {
      try {
        const existingText = await fs.readFile(outPath, 'utf8');
        const existing = parseTemplateJsonText(existingText);
        const prevCreatedAt = existing.ok ? existing.value[X_PROMPTG_TIME]?.createdAt : undefined;
        if (prevCreatedAt) {
          const next = normalized.value[X_PROMPTG_TIME] ?? {};
          normalized.value[X_PROMPTG_TIME] = { ...next, createdAt: prevCreatedAt };
        }
      } catch {
        // best effort
      }
    }

    await writeTextFileAtomic(
      outPath,
      JSON.stringify({ $schema: TEMPLATE_SCHEMA_URL, ...normalized.value }, null, 2),
      'utf8'
    );
    return { kind, name: normalized.value.name };
  }

  const normalized = normalizeImportedPrompt(params.data);
  if (!normalized.ok) {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: `Invalid prompt JSON: ${normalized.error}`,
    });
  }

  const exists = await promptExists(normalized.value.name, params.store);
  if (exists) {
    if (!params.force) {
      throw new InfraError({
        infraCode: 'CONFLICT',
        message: `Prompt "${normalized.value.name}" already exists. Use --force to overwrite.`,
        details: { kind: 'prompt', name: normalized.value.name },
      });
    }

    try {
      const existing = await loadPrompt(normalized.value.name, params.store);
      const prevCreatedAt = existing[X_PROMPTG_TIME]?.createdAt;
      if (prevCreatedAt) {
        const next = normalized.value[X_PROMPTG_TIME] ?? {};
        normalized.value[X_PROMPTG_TIME] = { ...next, createdAt: prevCreatedAt };
      }
    } catch {
      // ignore: best effort
    }
  }

  await savePrompt(normalized.value, params.store);
  return { kind, name: normalized.value.name };
}

export async function importFromSource(params: {
  source: string;
  store?: StorageOptions;
  force: boolean;
  asFile?: boolean;
  asUrl?: boolean;
}): Promise<{ kind: ImportKind; name: string }> {
  if (params.asFile && params.asUrl) {
    throw new InfraError({
      infraCode: 'INVALID_DATA',
      message: 'Cannot combine --file and --url.',
    });
  }

  const trimmed = params.source.trim();
  const inferredIsUrl = /^https?:\/\//i.test(trimmed);
  const isUrl = params.asUrl ? true : params.asFile ? false : inferredIsUrl;
  const data = isUrl ? await readJsonFromUrl(trimmed) : await readJsonFromFile(trimmed);

  return await importJsonData({ data, store: params.store, force: params.force });
}
