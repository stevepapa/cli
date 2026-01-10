import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNodeErrorCode } from '../../core/lib/errors.js';

export async function writeTextFileAtomic(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${randomUUID()}.tmp`);

  await fs.writeFile(tmpPath, content, encoding);

  try {
    await fs.rename(tmpPath, filePath);
    return;
  } catch (error) {
    const code = getNodeErrorCode(error);

    // Windows doesn't reliably allow overwriting via rename() if the target exists.
    if (code === 'EEXIST' || code === 'EPERM') {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        if (getNodeErrorCode(e) !== 'ENOENT') throw e;
      }
      await fs.rename(tmpPath, filePath);
      return;
    }

    // Fallback: best-effort write + cleanup.
    await fs.copyFile(tmpPath, filePath);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
