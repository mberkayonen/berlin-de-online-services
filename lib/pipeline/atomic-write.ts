import { rename, writeFile } from 'node:fs/promises';

/**
 * Writes JSON to `filePath` atomically: serializes to a `.tmp` file in the
 * same directory, then renames it into place. `rename()` on the same
 * filesystem is atomic, so a crash mid-write leaves either the old complete
 * file or the new complete file, never a truncated/corrupt one.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  await rename(tmpPath, filePath);
}
