import { useState, useEffect, useCallback } from 'react';
import type { IWorkspace } from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/IDEContext.ts';

export function useWorkspaces() {
  const { workspaceService } = useIDEServices();
  const [workspaces, setWorkspaces] = useState<IWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workspaceService.getWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      console.error("Failed to load workspaces", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const createWorkspace = useCallback(async (name: string, description?: string) => {
    try {
      const newWs = await workspaceService.createWorkspace(name, description);
      setWorkspaces(prev => [...prev, newWs]);
      return newWs;
    } catch (error) {
      console.error("Failed to create workspace", error);
      throw error;
    }
  }, []);

  const updateWorkspace = useCallback(async (id: string, name: string) => {
    try {
      const updatedWs = await workspaceService.updateWorkspace(id, name);
      setWorkspaces(prev => prev.map(w => w.id === id ? updatedWs : w));
      return updatedWs;
    } catch (error) {
      console.error("Failed to update workspace", error);
      throw error;
    }
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      await workspaceService.deleteWorkspace(id);
      setWorkspaces(prev => prev.filter(w => w.id !== id));
    } catch (error) {
      console.error("Failed to delete workspace", error);
      throw error;
    }
  }, []);

  return {
    workspaces,
    isLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces: loadWorkspaces
  };
}
