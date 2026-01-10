export function printHeader(params: {
  title: string;
  description?: string;
  sourceLabel: string;
  storeLabel?: string;
  tags?: string[];
  variableNames: string[];
  providedVarNames: string[];
  missingVarNames: string[];
}): void {
  process.stdout.write('---\n');
  process.stdout.write(`Title: ${params.title}\n`);
  process.stdout.write(`Source: ${params.sourceLabel}\n`);
  if (params.storeLabel) {
    process.stdout.write(`Store: ${params.storeLabel}\n`);
  }

  if (params.description) {
    process.stdout.write(`Description: ${params.description}\n`);
  }

  if (params.tags && params.tags.length > 0) {
    process.stdout.write(`Tags: ${params.tags.join(', ')}\n`);
  }

  if (params.variableNames.length > 0) {
    process.stdout.write(`Variables: ${params.variableNames.join(', ')}\n`);
  }

  if (params.providedVarNames.length > 0) {
    process.stdout.write(`Provided: ${params.providedVarNames.join(', ')}\n`);
  }

  if (params.missingVarNames.length > 0) {
    process.stdout.write(`Missing: ${params.missingVarNames.join(', ')}\n`);
  }

  process.stdout.write('---\n\n');
}
