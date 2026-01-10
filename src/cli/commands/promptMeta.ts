import type { StorageOptions } from '../../node/storage/storage.js';
import { loadPrompt, savePrompt } from '../../node/storage/storage.js';
import { status } from '../cliKit.js';
import { UsageError } from '../errors.js';

function normalizeTag(tag: string): string | null {
  const trimmed = tag.trim();
  if (!trimmed) return null;
  return trimmed;
}

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const v = item.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export async function executePromptMeta(
  name: string,
  store: StorageOptions | undefined,
  options: {
    displayName?: unknown;
    description?: unknown;
    tag?: unknown;
    removeTag?: unknown;
    quiet?: boolean;
  }
): Promise<void> {
  const quiet = options.quiet === true;
  const log = (msg: string) => {
    if (!quiet) status(msg);
  };

  const displayName = typeof options.displayName === 'string' ? options.displayName : undefined;
  const description = typeof options.description === 'string' ? options.description : undefined;
  const addTags = Array.isArray(options.tag) ? options.tag.filter(t => typeof t === 'string') : [];
  const removeTags = Array.isArray(options.removeTag)
    ? options.removeTag.filter(t => typeof t === 'string')
    : [];

  const hasAnyChange =
    displayName !== undefined ||
    description !== undefined ||
    addTags.length > 0 ||
    removeTags.length > 0;
  if (!hasAnyChange) {
    throw new UsageError(
      'No changes specified. Provide --display-name, --description, --tag, or --remove-tag.'
    );
  }

  const prompt = await loadPrompt(name, store);

  const next = { ...prompt };
  if (displayName !== undefined) next.displayName = displayName;
  if (description !== undefined) next.description = description;

  let tags = Array.isArray(next.tags) ? [...next.tags] : [];
  for (const t of addTags) {
    const normalized = normalizeTag(t);
    if (normalized) tags.push(normalized);
  }
  tags = uniqStrings(tags);

  if (removeTags.length > 0 && tags.length > 0) {
    const removeSet = new Set(removeTags.map(t => t.trim()).filter(Boolean));
    tags = tags.filter(t => !removeSet.has(t));
  }

  next.tags = tags.length > 0 ? tags : undefined;

  await savePrompt(next, store);
  log(`Updated prompt "${name}".`);
}
