import type {
  FileRevisionLookupResult,
  IFileNode,
  LocalFolderMountSource,
  ProjectFileSystemChangeEvent,
  WorkspaceFileSearchExecutionResult,
  WorkspaceFileSearchOptions,
} from '@sdkwork/birdcoder-types';

export interface FileSystemChangeSubscriptionOptions {
  getTrackedFilePaths?: () => readonly string[];
}

export interface IFileSystemService {
  /**
   * Retrieves the file tree for a specific project.
   * @param projectId The ID of the project.
   */
  getFiles(projectId: string): Promise<IFileNode[]>;

  /**
   * Loads a single directory on demand and merges it into the current project tree.
   * @param projectId The ID of the project.
   * @param path Absolute mounted directory path.
   */
  loadDirectory(projectId: string, path: string): Promise<IFileNode[]>;

  /**
   * Reloads a mounted directory from the underlying file system.
   * @param projectId The ID of the project.
   * @param path Absolute mounted directory path. Omitting the path refreshes the mounted root.
   */
  refreshDirectory(projectId: string, path?: string): Promise<IFileNode[]>;

  /**
   * Reloads multiple mounted directories and returns a single updated file tree snapshot.
   * When no paths are provided the mounted root is refreshed.
   * @param projectId The ID of the project.
   * @param paths Absolute mounted directory paths.
   */
  refreshDirectories(projectId: string, paths: readonly string[]): Promise<IFileNode[]>;

  /**
   * Retrieves the content of a specific file.
   * @param projectId The ID of the project.
   * @param path The path of the file.
   */
  getFileContent(projectId: string, path: string): Promise<string>;

  /**
   * Retrieves a lightweight revision token for a specific file.
   * The revision changes whenever the underlying file metadata changes.
   * @param projectId The ID of the project.
   * @param path The path of the file.
   */
  getFileRevision(projectId: string, path: string): Promise<string>;

  /**
   * Retrieves lightweight revision tokens for multiple files in a single call.
   * Missing files are reported in-band so callers can reconcile open editor state
   * without treating the whole batch as failed.
   * @param projectId The ID of the project.
   * @param paths Absolute mounted file paths.
   */
  getFileRevisions(
    projectId: string,
    paths: readonly string[],
  ): Promise<ReadonlyArray<FileRevisionLookupResult>>;

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
   * Searches files within a project.
   * @param projectId The ID of the project.
   * @param options Search query and result shaping options.
   */
  searchFiles(
    projectId: string,
    options: WorkspaceFileSearchOptions,
  ): Promise<WorkspaceFileSearchExecutionResult>;

  /**
   * Subscribes to external file-system changes for a mounted project.
   * @param projectId The ID of the project.
   * @param listener Change listener invoked after the runtime cache is reconciled.
   */
  subscribeToFileChanges(
    projectId: string,
    listener: (event: ProjectFileSystemChangeEvent) => void,
    options?: FileSystemChangeSubscriptionOptions,
  ): () => void;

  /**
   * Mounts a local folder to the project's file system.
   * @param projectId The ID of the project.
   * @param folderInfo Information about the local folder (handle or path).
   */
  mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void>;
}
