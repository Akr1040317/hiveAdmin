'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useProject } from './ProjectContext';
import { View, ViewType } from '@/lib/views';
import { getViews, createView, updateView, deleteView, setDefaultView } from '@/app/actions/views';
import { useServerAction } from '@/hooks/useServerAction';
import { ProjectId } from '@/lib/projects';

interface ViewContextValue {
  views: View[];
  currentView: View | null;
  loading: boolean;
  error: string | null;
  setCurrentView: (view: View | null) => void;
  createNewView: (view: Omit<View, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCurrentView: (updates: Partial<View>) => Promise<void>;
  deleteCurrentView: () => Promise<void>;
  setAsDefault: () => Promise<void>;
  switchViewType: (viewType: ViewType) => Promise<void>;
}

const ViewContext = createContext<ViewContextValue | undefined>(undefined);

export function ViewProvider({
  children,
  moduleName,
  defaultViewType = 'table',
}: {
  children: React.ReactNode;
  moduleName: string;
  defaultViewType?: ViewType;
}) {
  const { projectId } = useProject();
  const [views, setViews] = useState<View[]>([]);
  const [currentView, setCurrentView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { execute: loadViews } = useServerAction(getViews);
  const { execute: handleCreateView } = useServerAction(createView);
  const { execute: handleUpdateView } = useServerAction(updateView);
  const { execute: handleDeleteView } = useServerAction(deleteView);
  const { execute: handleSetDefault } = useServerAction(setDefaultView);

  const loadViewsData = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await loadViews(projectId, moduleName);
      if (data) {
        setViews(data);
        // Set current view to default or first view
        const defaultView = data.find(v => v.isDefault) || data[0];
        if (defaultView) {
          setCurrentView(defaultView);
        } else if (data.length === 0) {
          // No views exist, create a default one
          const newView: Omit<View, 'id' | 'createdAt' | 'updatedAt'> = {
            moduleName,
            viewName: `${defaultViewType.charAt(0).toUpperCase() + defaultViewType.slice(1)} View`,
            viewType: defaultViewType,
            filters: [],
            sorts: [],
            isDefault: true,
          };
          await handleCreateView(projectId, newView);
          await loadViewsData();
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load views';
      const errorDetails = err?.stack || String(err);
      console.error('Error loading views:', {
        message: errorMessage,
        details: errorDetails,
        projectId,
        moduleName,
        error: err,
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId, moduleName, loadViews, handleCreateView]);

  useEffect(() => {
    loadViewsData();
  }, [loadViewsData]);

  const createNewView = useCallback(async (view: Omit<View, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    try {
      await handleCreateView(projectId, view);
      // Reload views to get the newly created view with ID
      // Use loadViewsData which properly handles authentication
      const updatedViews = await loadViews(projectId, moduleName);
      if (updatedViews) {
        setViews(updatedViews);
        // Find the view with matching viewType (should be the one we just created)
        const newView = updatedViews.find(v => v.viewType === view.viewType);
        if (newView) {
          setCurrentView(newView);
        } else {
          // Fallback: set to default or first view
          const defaultView = updatedViews.find(v => v.isDefault) || updatedViews[0];
          if (defaultView) {
            setCurrentView(defaultView);
          }
        }
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to create view';
      const errorDetails = err?.stack || String(err);
      console.error('Error creating view:', {
        message: errorMessage,
        details: errorDetails,
        view: view,
        projectId,
        moduleName,
      });
      setError(errorMessage);
      throw err;
    }
  }, [projectId, moduleName, handleCreateView, loadViews]);

  const updateCurrentView = useCallback(async (updates: Partial<View>) => {
    if (!projectId || !currentView) return;
    try {
      await handleUpdateView(projectId, currentView.id, updates);
      setCurrentView({ ...currentView, ...updates });
      await loadViewsData();
    } catch (err: any) {
      setError(err.message || 'Failed to update view');
      throw err;
    }
  }, [projectId, currentView, handleUpdateView, loadViewsData]);

  const deleteCurrentView = useCallback(async () => {
    if (!projectId || !currentView) return;
    try {
      await handleDeleteView(projectId, currentView.id);
      await loadViewsData();
      // Switch to default view or first available
      const remainingViews = views.filter(v => v.id !== currentView.id);
      setCurrentView(remainingViews.find(v => v.isDefault) || remainingViews[0] || null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete view');
      throw err;
    }
  }, [projectId, currentView, handleDeleteView, loadViewsData, views]);

  const setAsDefault = useCallback(async () => {
    if (!projectId || !currentView) return;
    try {
      await handleSetDefault(projectId, moduleName, currentView.id);
      await loadViewsData();
    } catch (err: any) {
      setError(err.message || 'Failed to set default view');
      throw err;
    }
  }, [projectId, moduleName, currentView, handleSetDefault, loadViewsData]);

  const switchViewType = useCallback(async (viewType: ViewType) => {
    // Find existing view of this type, or create one
    const existingView = views.find(v => v.viewType === viewType);
    if (existingView) {
      // Immediately switch to existing view
      setCurrentView(existingView);
      return;
    }
    
    // If no existing view, create a temporary one optimistically
    // This allows the UI to update immediately even if server creation fails
    // Use ISO strings for dates to avoid serialization issues
    const tempView: View = {
      id: `temp-${viewType}-${Date.now()}`,
      moduleName,
      viewName: `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`,
      viewType,
      filters: currentView?.filters || [],
      sorts: currentView?.sorts || [],
      visibleColumns: currentView?.visibleColumns,
      isDefault: views.length === 0,
      createdAt: new Date().toISOString() as any,
      updatedAt: new Date().toISOString() as any,
    };
    
    // Optimistically set the view immediately
    setCurrentView(tempView);
    
    // Try to create the view on the server
    const newView: Omit<View, 'id' | 'createdAt' | 'updatedAt'> = {
      moduleName,
      viewName: `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`,
      viewType,
      filters: currentView?.filters || [],
      sorts: currentView?.sorts || [],
      visibleColumns: currentView?.visibleColumns,
      isDefault: views.length === 0,
    };
    
    try {
      await createNewView(newView);
      // createNewView will update currentView with the real view from server
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error';
      const errorDetails = err?.stack || String(err);
      console.error('Failed to create view on server, using temporary view:', {
        message: errorMessage,
        details: errorDetails,
        viewType,
        projectId,
        moduleName,
        error: err,
      });
      // Keep the temporary view - at least the UI will work
      // Don't set error here as the view switching still works locally
    }
  }, [views, moduleName, createNewView, currentView]);

  return (
    <ViewContext.Provider
      value={{
        views,
        currentView,
        loading,
        error,
        setCurrentView,
        createNewView,
        updateCurrentView,
        deleteCurrentView,
        setAsDefault,
        switchViewType,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
}
