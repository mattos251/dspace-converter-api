export interface IConversionEngine {
  execute(inputPath: string, outputDirectory: string): Promise<void>;
}
