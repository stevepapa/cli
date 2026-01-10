export const KEBAB_CASE_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isKebabCaseName(name: string): boolean {
  return KEBAB_CASE_NAME_REGEX.test(name);
}

export function validateKebabCaseName(name: string): string | null {
  if (!isKebabCaseName(name)) return 'Name must be kebab-case (lowercase with hyphens)';
  return null;
}
