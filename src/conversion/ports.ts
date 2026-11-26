export interface IConversionEngine {
  execute(inputPath: string, outputDirectory: string): Promise<void>;
}

export interface IFileStorage {
  createWorkspace(): Promise<string>;
  writeInput(workspace: string, filename: string, content: Buffer): Promise<string>;
  prepareOutput(workspace: string): Promise<string>;
  readOutput(outputDirectory: string, filename: string): Promise<string | null>;
  removeWorkspace(workspace: string): Promise<void>;
}

export interface IArchiveService {
  createZip(files: Array<{ name: string; content: string }>, destination: string): Promise<void>;
}
