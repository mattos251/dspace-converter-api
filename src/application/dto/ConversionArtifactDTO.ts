export interface ConversionArtifactDTO {
  archivePath: string;
  cleanup: () => Promise<void>;
}
