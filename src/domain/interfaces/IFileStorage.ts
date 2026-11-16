export interface IFileStorage {
  createWorkspace(): Promise<string>;
  writeInput(workspace: string, filename: string, content: Buffer): Promise<string>;
  removeWorkspace(workspace: string): Promise<void>;
}
