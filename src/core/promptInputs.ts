export type InteractiveMap = Record<
  string,
  { question?: string; help?: string; required?: boolean }
>;

export function extractPrefilledVars(source: unknown): Record<string, string> {
  if (!source || typeof source !== 'object') return {};

  const candidate = (source as { defaults?: unknown }).defaults;

  if (!candidate || typeof candidate !== 'object') return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value === 'string') {
      result[key] = value;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    }
  }

  return result;
}

export function extractInteractive(source: unknown): InteractiveMap {
  if (!source || typeof source !== 'object') return {};
  const candidate = (source as { 'x-promptg-interactive'?: unknown })['x-promptg-interactive'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};

  const out: InteractiveMap = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    out[key] = {
      question: typeof v.question === 'string' ? v.question : undefined,
      help: typeof v.help === 'string' ? v.help : undefined,
      required: v.required === true,
    };
  }
  return out;
}

export function parseVariableOptions(options: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith('var:')) {
      const varName = key.substring(4);
      vars[varName] = value as string;
    }
  }

  return vars;
}
