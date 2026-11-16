import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConvertDspaceFiles } from '../../src/application/use-cases/ConvertDspaceFiles.js';
import { InvalidFileError } from '../../src/domain/errors/InvalidFileError.js';
import type { IConversionEngine } from '../../src/domain/interfaces/IConversionEngine.js';
import type { IArchiveService } from '../../src/domain/interfaces/IArchiveService.js';
import { LocalTemporaryStorage } from '../../src/infrastructure/storage/LocalTemporaryStorage.js';

const validXml = Buffer.from(
  '<?xml version="1.0"?><input-forms><form-definitions /></input-forms>',
);
const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('ConvertDspaceFiles', () => {
  it('rejects an unexpected filename', async () => {
    const engine = { execute: vi.fn() } as unknown as IConversionEngine;
    const archive = { createZip: vi.fn() } as unknown as IArchiveService;
    const useCase = new ConvertDspaceFiles(new LocalTemporaryStorage(), engine, archive);

    await expect(
      useCase.execute({ filename: 'other.xml', content: validXml }),
    ).rejects.toBeInstanceOf(InvalidFileError);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('rejects malformed XML', async () => {
    const engine = { execute: vi.fn() } as unknown as IConversionEngine;
    const archive = { createZip: vi.fn() } as unknown as IArchiveService;
    const useCase = new ConvertDspaceFiles(new LocalTemporaryStorage(), engine, archive);

    await expect(
      useCase.execute({ filename: 'input-forms.xml', content: Buffer.from('<input-forms>') }),
    ).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('creates an archive from both generated XML files', async () => {
    const engine: IConversionEngine = {
      execute: async (_input, output) => {
        await mkdir(output, { recursive: true });
        await writeFile(join(output, 'submission-forms.xml'), '<input-forms />');
        await writeFile(join(output, 'item-submission.xml'), '<item-submission />');
      },
    };
    let archiveFiles: Array<{ path: string; name: string }> = [];
    let archiveDestination = '';
    const archive: IArchiveService = {
      createZip: async (files, destination) => {
        archiveFiles = files;
        archiveDestination = destination;
        await writeFile(destination, 'zip-test');
      },
    };
    const storage = new LocalTemporaryStorage();
    const createWorkspace = vi.spyOn(storage, 'createWorkspace').mockImplementation(async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'dspace-converter-test-'));
      workspaces.push(workspace);
      return workspace;
    });
    const useCase = new ConvertDspaceFiles(storage, engine, archive);

    const artifact = await useCase.execute({ filename: 'input-forms.xml', content: validXml });
    expect(createWorkspace).toHaveBeenCalledOnce();
    expect(archiveFiles.map((file) => file.name)).toEqual([
      'submission-forms.xml',
      'item-submission.xml',
    ]);
    expect(artifact.archivePath).toBe(archiveDestination);
    await artifact.cleanup();
  });
});
