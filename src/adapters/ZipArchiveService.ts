import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { IArchiveService } from '../conversion/ports.js';

export class ZipArchiveService implements IArchiveService {
  async createZip(
    files: Array<{ name: string; content: string }>,
    destination: string,
  ): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
    const completion = pipeline(archive, output);
    for (const file of files) archive.append(file.content, { name: file.name });
    await archive.finalize();
    await completion;
  }
}
