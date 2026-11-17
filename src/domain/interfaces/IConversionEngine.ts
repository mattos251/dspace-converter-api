import type { ConversionOptions } from '../value-objects/ConversionOptions.js';

export interface IConversionEngine {
  execute(inputPath: string, outputDirectory: string, options: ConversionOptions): Promise<void>;
}
