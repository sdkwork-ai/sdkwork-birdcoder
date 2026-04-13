import type { IFileNode, LocalFolderMountSource } from '@sdkwork/birdcoder-types';

export interface IFileSystemService {
  /**
   * Retrieves the file tree for a specific project.
   * @param projectId The ID of the project.
   */
  getFiles(projectId: string): Promise<IFileNode[]>;

  /**
   * Retrieves the content of a specific file.
   * @param projectId The ID of the project.
   * @param path The path of the file.
   */
  getFileContent(projectId: string, path: string): Promise<string>;

  /**
   * Saves content to a specific file.
   * @param projectId The ID of the project.
   * @param path The path of the file.
   * @param content The new content of the file.
   */
  saveFileContent(projectId: string, path: string, content: string): Promise<void>;

  /**
   * Creates a new file.
   * @param projectId The ID of the project.
   * @param path The path of the new file.
   */
  createFile(projectId: string, path: string): Promise<void>;

  /**
   * Creates a new folder.
   * @param projectId The ID of the project.
   * @param path The path of the new folder.
   */
  createFolder(projectId: string, path: string): Promise<void>;

  /**
   * Deletes a file.
   * @param projectId The ID of the project.
   * @param path The path of the file to delete.
   */
  deleteFile(projectId: string, path: string): Promise<void>;

  /**
   * Deletes a folder.
   * @param projectId The ID of the project.
   * @param path The path of the folder to delete.
   */
  deleteFolder(projectId: string, path: string): Promise<void>;

  /**
   * Renames a file or folder.
   * @param projectId The ID of the project.
   * @param oldPath The current path of the file or folder.
   * @param newPath The new path of the file or folder.
   */
  renameNode(projectId: string, oldPath: string, newPath: string): Promise<void>;

  /**
   * Mounts a local folder to the project's file system.
   * @param projectId The ID of the project.
   * @param folderInfo Information about the local folder (handle or path).
   */
  mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void>;
}
