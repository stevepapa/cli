/**
 * Variable Substitution - Handles {{variable}} syntax in prompts
 */

const ESCAPE_TOKEN_RE = /\{\{!([a-zA-Z0-9_-]+)\}\}/g;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

function protectEscapedPlaceholders(content: string): {
  text: string;
  literalsBySentinel: Map<string, string>;
} {
  const literalsBySentinel = new Map<string, string>();
  let idx = 0;

  const text = content.replace(ESCAPE_TOKEN_RE, (_match, name: string) => {
    const sentinel = `@@PROMPTG_ESC_${idx}@@`;
    idx += 1;
    literalsBySentinel.set(sentinel, `{{${name}}}`);
    return sentinel;
  });

  return { text, literalsBySentinel };
}

function unprotectEscapedPlaceholders(
  content: string,
  literalsBySentinel: Map<string, string>
): string {
  let out = content;
  for (const [sentinel, literal] of literalsBySentinel.entries()) {
    out = out.split(sentinel).join(literal);
  }
  return out;
}

/**
 * Extract all {{variable}} patterns from content.
 * Returns unique variable names.
 * Ignores strict escaped placeholders {{!name}}.
 *
 * @example
 * extractVariables("Review {{language}} code for {{focus}}")
 * // Returns: ["language", "focus"]
 */
export function extractVariables(content: string): string[] {
  const withoutEscaped = content.replace(ESCAPE_TOKEN_RE, '');
  const matches = withoutEscaped.matchAll(PLACEHOLDER_RE);

  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Substitute {{variable}} placeholders with actual values.
 * Handles both {{variable}} and {{ variable }} (with spaces).
 * Leaves unmatched variables as-is.
 *
 * Strict escaped placeholders {{!name}} emit literal {{name}} and are never substituted
 * during the same render pass.
 */
export function substituteVariables(content: string, vars: Record<string, string>): string {
  const protectedEscapes = protectEscapedPlaceholders(content);
  let result = protectedEscapes.text;

  result = result.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    return String(vars[key] ?? '');
  });

  return unprotectEscapedPlaceholders(result, protectedEscapes.literalsBySentinel);
}

/**
 * Find variables that are required but missing.
 * Returns list of missing variable names.
 */
export function validateVariables(content: string, vars: Record<string, string>): string[] {
  const allVariables = extractVariables(content);
  const providedKeys = Object.keys(vars);
  return allVariables.filter(variable => !providedKeys.includes(variable));
}

export function hasVariables(content: string): boolean {
  return extractVariables(content).length > 0;
}

export function describeVariables(variables: string[]): string {
  if (variables.length === 0) return 'none';
  if (variables.length === 1) return variables[0];
  return variables.join(', ');
}
