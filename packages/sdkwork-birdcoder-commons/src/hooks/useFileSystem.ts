import { useState, useEffect, useCallback } from 'react';
import type { IFileNode, LocalFolderMountSource } from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext';

function findFirstFile(nodes: IFileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file') {
      return node.path;
    }
    if (node.children && node.children.length > 0) {
      const childFile = findFirstFile(node.children);
      if (childFile) {
        return childFile;
      }
    }
  }
  return null;
}

export function useFileSystem(projectId: string) {
  const { fileSystemService } = useIDEServices();
  const [files, setFiles] = useState<IFileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(projectId);

  if (projectId !== currentProjectId) {
    setCurrentProjectId(projectId);
    setSelectedFile(null);
    setFileContent('');
  }

  useEffect(() => {
    let isMounted = true;
    const loadFiles = async () => {
      setIsLoading(true);
      try {
        const data = await fileSystemService.getFiles(projectId);
        if (isMounted) {
          setFiles(data);
          if (data.length > 0 && !selectedFile) {
            const defaultFile = findFirstFile(data);
            setSelectedFile(defaultFile);
          } else if (data.length === 0) {
            setSelectedFile(null);
            setFileContent('');
          }
        }
      } catch (error) {
        console.error("Failed to load files", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (projectId) {
      loadFiles();
    } else {
      setFiles([]);
      setSelectedFile(null);
      setFileContent('');
    }
    return () => { isMounted = false; };
  }, [projectId]);

  // Load content when selectedFile changes
  useEffect(() => {
    let isMounted = true;
    const loadContent = async () => {
      if (!selectedFile) return;
      setIsLoadingContent(true);
      try {
        const content = await fileSystemService.getFileContent(projectId, selectedFile);
        if (isMounted) setFileContent(content);
      } catch (error) {
        if (isMounted) setFileContent('// File content not found');
      } finally {
        if (isMounted) setIsLoadingContent(false);
      }
    };

    loadContent();
    return () => { isMounted = false; };
  }, [projectId, selectedFile]);

  const selectFile = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  const saveFileContent = useCallback(async (path: string, content: string) => {
    try {
      await fileSystemService.saveFileContent(projectId, path, content);
      if (selectedFile === path) {
        setFileContent(content);
      }
    } catch (error) {
      console.error("Failed to save file content", error);
    }
  }, [projectId, selectedFile]);

  const saveFile = useCallback(async (content: string) => {
    if (!selectedFile) return;
    return saveFileContent(selectedFile, content);
  }, [selectedFile, saveFileContent]);

  const createFile = useCallback(async (path: string) => {
    try {
      await fileSystemService.createFile(projectId, path);
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
      setSelectedFile(path);
    } catch (error) {
      console.error("Failed to create file", error);
    }
  }, [projectId]);

  const createFolder = useCallback(async (path: string) => {
    try {
      await fileSystemService.createFolder(projectId, path);
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
    } catch (error) {
      console.error("Failed to create folder", error);
    }
  }, [projectId]);

  const deleteFile = useCallback(async (path: string) => {
    try {
      await fileSystemService.deleteFile(projectId, path);
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
      if (selectedFile === path) {
        setSelectedFile(null);
        setFileContent('');
      }
    } catch (error) {
      console.error("Failed to delete file", error);
    }
  }, [projectId, selectedFile]);

  const deleteFolder = useCallback(async (path: string) => {
    try {
      await fileSystemService.deleteFolder(projectId, path);
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
      if (selectedFile?.startsWith(`${path}/`)) {
        setSelectedFile(null);
        setFileContent('');
      }
    } catch (error) {
      console.error("Failed to delete folder", error);
    }
  }, [projectId, selectedFile]);

  const renameNode = useCallback(async (oldPath: string, newPath: string) => {
    try {
      await fileSystemService.renameNode(projectId, oldPath, newPath);
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
      if (selectedFile === oldPath) {
        setSelectedFile(newPath);
      } else if (selectedFile?.startsWith(`${oldPath}/`)) {
        setSelectedFile(selectedFile.replace(`${oldPath}/`, `${newPath}/`));
      }
    } catch (error) {
      console.error("Failed to rename node", error);
    }
  }, [projectId, selectedFile]);

  const searchFiles = useCallback(async (query: string): Promise<{ path: string, line: number, content: string }[]> => {
    if (!query.trim()) return [];
    const results: { path: string, line: number, content: string }[] = [];
    
    const traverseAndSearch = async (nodes: IFileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') {
          try {
            const content = await fileSystemService.getFileContent(projectId, node.path);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                results.push({ path: node.path, line: index + 1, content: line.trim() });
              }
            });
          } catch (e) {
            console.error(`Failed to read ${node.path} for searching`, e);
          }
        } else if (node.children) {
          await traverseAndSearch(node.children);
        }
      }
    };
    
    setIsLoading(true);
    try {
      await traverseAndSearch(files);
    } finally {
      setIsLoading(false);
    }
    return results;
  }, [projectId, files, fileSystemService]);

  const mountFolder = useCallback(async (targetProjectId: string, folderInfo: LocalFolderMountSource) => {
    try {
      await fileSystemService.mountFolder(targetProjectId, folderInfo);
      if (targetProjectId !== projectId) {
        return;
      }
      const data = await fileSystemService.getFiles(targetProjectId);
      setFiles(data);
      if (data.length === 0) {
        setSelectedFile(null);
        setFileContent('');
        return;
      }
      if (!selectedFile) {
        setSelectedFile(findFirstFile(data));
      }
    } catch (error) {
      console.error("Failed to mount folder", error);
    }
  }, [projectId, selectedFile, fileSystemService]);

  const refreshFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fileSystemService.getFiles(projectId);
      setFiles(data);
    } catch (error) {
      console.error("Failed to refresh files", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, fileSystemService]);

  return {
    files,
    isLoading,
    selectedFile,
    fileContent,
    isLoadingContent,
    selectFile,
    saveFile,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    mountFolder,
    refreshFiles
  };
}
