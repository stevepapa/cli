/**
 * Version Command - print CLI version
 */

import { version } from '../version.js';
import { writeJsonSuccess } from '../output.js';

export async function executeVersion(options?: { format?: 'text' | 'json' }): Promise<void> {
  const format = options?.format === 'json' ? 'json' : 'text';
  if (format === 'json') {
    writeJsonSuccess({ name: 'promptg', version });
    return;
  }
  process.stdout.write(`promptg v${version}\n`);
}
