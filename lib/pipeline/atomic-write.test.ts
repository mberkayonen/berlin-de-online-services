import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeJsonAtomic } from './atomic-write';

let tempDir: string;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

describe('writeJsonAtomic', () => {
  it('writes JSON content that can be read back correctly', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'atomic-write-'));
    const filePath = path.join(tempDir, 'data.json');
    const data = { hello: 'world', nested: { count: 3 } };

    await writeJsonAtomic(filePath, data);

    const raw = await readFile(filePath, 'utf-8');
    expect(JSON.parse(raw)).toEqual(data);
  });

  it('does not leave a .tmp file behind after a successful write', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'atomic-write-'));
    const filePath = path.join(tempDir, 'data.json');

    await writeJsonAtomic(filePath, { a: 1 });

    const entries = await readdir(tempDir);
    expect(entries).toEqual(['data.json']);
  });

  it('overwrites an existing file in place', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'atomic-write-'));
    const filePath = path.join(tempDir, 'data.json');

    await writeJsonAtomic(filePath, { version: 1 });
    await writeJsonAtomic(filePath, { version: 2 });

    const raw = await readFile(filePath, 'utf-8');
    expect(JSON.parse(raw)).toEqual({ version: 2 });
  });
});
