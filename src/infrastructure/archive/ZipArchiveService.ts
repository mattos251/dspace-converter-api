import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { IArchiveService } from '../../domain/interfaces/IArchiveService.js';

export class ZipArchiveService implements IArchiveService {
  async createZip(
    files: Array<{ path: string; name: string }>,
    destination: string,
  ): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
    const completion = pipeline(archive, output);
    for (const file of files) archive.file(file.path, { name: file.name });
    await archive.finalize();
    await completion;
  }
}
