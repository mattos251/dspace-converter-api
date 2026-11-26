import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IFileStorage } from '../conversion/ports.js';

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

  async prepareOutput(workspace: string): Promise<string> {
    const outputDirectory = join(workspace, 'output');
    await mkdir(outputDirectory, { recursive: true });
    return outputDirectory;
  }

  // Retorna null quando o arquivo não existe ou não pode ser lido
  async readOutput(outputDirectory: string, filename: string): Promise<string | null> {
    try {
      return await readFile(join(outputDirectory, filename), 'utf8');
    } catch {
      return null;
    }
  }

  async removeWorkspace(workspace: string): Promise<void> {
    await rm(workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
