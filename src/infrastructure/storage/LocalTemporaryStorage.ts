import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IFileStorage } from '../../domain/interfaces/IFileStorage.js';

export class LocalTemporaryStorage implements IFileStorage {
  async createWorkspace(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'dspace-converter-'));
  }

  async writeInput(workspace: string, filename: string, content: Buffer): Promise<string> {
    const inputDirectory = join(workspace, 'input');
    await mkdir(inputDirectory, { recursive: true });
    const filePath = join(inputDirectory, filename);
    await writeFile(filePath, content, { flag: 'wx', mode: 0o600 });
    return filePath;
  }

  async removeWorkspace(workspace: string): Promise<void> {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
