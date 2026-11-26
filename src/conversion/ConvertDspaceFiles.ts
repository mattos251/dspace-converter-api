import { join } from 'node:path';
import type { IArchiveService, IConversionEngine, IFileStorage } from './ports.js';
import { OutputValidationError } from './errors.js';
import { DSpaceXmlValidator } from './DSpaceXmlValidator.js';
import type { ConversionArtifactDTO } from './ConversionArtifactDTO.js';

const OUTPUT_FILES = ['submission-forms.xml', 'item-submission.xml'] as const;

export class ConvertDspaceFiles {
  constructor(
    private readonly storage: IFileStorage,
    private readonly engine: IConversionEngine,
    private readonly archive: IArchiveService,
  ) {}

  async execute(file: { filename: string; content: Buffer }): Promise<ConversionArtifactDTO> {
    DSpaceXmlValidator.validate(file.content, file.filename);

    const workspace = await this.storage.createWorkspace();
    try {
      const inputPath = await this.storage.writeInput(workspace, 'input-forms.xml', file.content);
      const outputDirectory = await this.storage.prepareOutput(workspace);
      await this.engine.execute(inputPath, outputDirectory);

      const outputs: Array<{ name: string; content: string }> = [];
      for (const name of OUTPUT_FILES) {
        const content = await this.storage.readOutput(outputDirectory, name);
        if (content === null) throw new OutputValidationError();
        DSpaceXmlValidator.validateOutput(content);
        outputs.push({ name, content });
      }

      const zipPath = join(workspace, 'dspace-conversion.zip');
      await this.archive.createZip(outputs, zipPath);
      return { archivePath: zipPath, cleanup: () => this.storage.removeWorkspace(workspace) };
    } catch (error) {
      await this.storage.removeWorkspace(workspace);
      throw error;
    }
  }
}
