export interface IArchiveService {
  createZip(files: Array<{ path: string; name: string }>, destination: string): Promise<void>;
}
