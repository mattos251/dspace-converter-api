import { access, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { IConversionEngine } from '../../domain/interfaces/IConversionEngine.js';
import type { IFileStorage } from '../../domain/interfaces/IFileStorage.js';
import type { IArchiveService } from '../../domain/interfaces/IArchiveService.js';
import { InvalidFileError } from '../../domain/errors/InvalidFileError.js';
import { OutputValidationError } from '../../domain/errors/OutputValidationError.js';
import { DSpaceXmlValidator } from '../../domain/validators/DSpaceXmlValidator.js';
import type { ConversionArtifactDTO } from '../dto/ConversionArtifactDTO.js';

const OUTPUT_FILES = ['submission-forms.xml', 'item-submission.xml'] as const;
const parser = new XMLParser({ processEntities: false, ignoreAttributes: false });

export class ConvertDspaceFiles {
  constructor(
    private readonly storage: IFileStorage,
    private readonly engine: IConversionEngine,
    private readonly archive: IArchiveService,
  ) {}

  async execute(file: { filename: string; content: Buffer }): Promise<ConversionArtifactDTO> {
    DSpaceXmlValidator.validate(file.content, file.filename);

    const xml = file.content.toString('utf8');
    try {
      const parsed = parser.parse(xml);
      if (!parsed || typeof parsed !== 'object' || !('input-forms' in parsed)) {
        throw new InvalidFileError('O XML não possui a estrutura esperada de input-forms do DSpace 5.');
      }
    } catch (error) {
      if (error instanceof InvalidFileError) throw error;
      throw new InvalidFileError('Não foi possível interpretar o XML enviado.');
    }

    const workspace = await this.storage.createWorkspace();
    try {
      const inputPath = await this.storage.writeInput(workspace, 'input-forms.xml', file.content);
      const outputDirectory = join(workspace, 'output');
      await mkdir(outputDirectory, { recursive: true });
      await this.engine.execute(inputPath, outputDirectory);

      const outputPaths = OUTPUT_FILES.map((name) => join(outputDirectory, name));
      for (const outputPath of outputPaths) {
        try {
          await access(outputPath);
          const outputXml = await readFile(outputPath, 'utf8');
          if (XMLValidator.validate(outputXml) !== true) throw new OutputValidationError();
        } catch (error) {
          if (error instanceof OutputValidationError) throw error;
          throw new OutputValidationError();
        }
      }

      const zipPath = join(workspace, 'dspace-conversion.zip');
      await this.archive.createZip(
        outputPaths.map((path, index) => ({ path, name: OUTPUT_FILES[index] })),
        zipPath,
      );
      return { archivePath: zipPath, cleanup: () => this.storage.removeWorkspace(workspace) };
    } catch (error) {
      await this.storage.removeWorkspace(workspace);
      throw error;
    }
  }
}
