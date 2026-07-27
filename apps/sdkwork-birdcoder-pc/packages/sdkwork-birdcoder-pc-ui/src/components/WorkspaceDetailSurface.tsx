import type { ReactNode } from 'react';

export interface WorkspaceDetailView {
  id: string;
  kind: string;
  content: ReactNode;
  keepMounted?: boolean;
  label?: string;
}

export interface WorkspaceDetailSurfaceProps {
  activeViewId: string;
  views: readonly WorkspaceDetailView[];
  className?: string;
  emptyState?: ReactNode;
}

export function WorkspaceDetailSurface({
  activeViewId,
  views,
  className = '',
  emptyState = null,
}: WorkspaceDetailSurfaceProps) {
  const activeView = views.find((view) => view.id === activeViewId) ?? null;

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`}
      data-workspace-detail-surface="true"
      data-workspace-detail-active-view={activeView?.id ?? ''}
      data-workspace-detail-active-kind={activeView?.kind ?? ''}
    >
      {activeView ? (
        views.map((view) => {
          const isActive = view.id === activeView.id;
          if (!isActive && !view.keepMounted) {
            return null;
          }

          return (
            <section
              key={view.id}
              aria-hidden={!isActive}
              aria-label={view.label}
              className={isActive ? 'flex min-h-0 min-w-0 flex-1' : 'hidden'}
              data-workspace-detail-kind={view.kind}
              data-workspace-detail-view={view.id}
            >
              {view.content}
            </section>
          );
        })
      ) : emptyState}
    </div>
  );
}
