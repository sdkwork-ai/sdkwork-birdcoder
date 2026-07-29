import { Ellipsis, Folder } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArchivedSessionRow } from './ArchivedSessionRow';
import type { ArchivedProjectGroupView, ArchivedSessionView } from './archivedSettingsTypes';

interface ArchivedProjectGroupProps {
  group: ArchivedProjectGroupView;
  locale: string;
  onDeleteProjectSessions: () => void;
  onDeleteSession: (session: ArchivedSessionView) => void;
  onRestoreAll: () => void;
  onRestoreSession: (sessionId: string) => void;
  pendingSessionIds: ReadonlySet<string>;
}

export function ArchivedProjectGroup({
  group,
  locale,
  onDeleteProjectSessions,
  onDeleteSession,
  onRestoreAll,
  onRestoreSession,
  pendingSessionIds,
}: ArchivedProjectGroupProps) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isGroupPending = group.sessions.some((session) => pendingSessionIds.has(session.id));

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [isMenuOpen]);

  return (
    <section aria-labelledby={`archived-project-${group.projectId}`}>
      <div className="mb-2 flex h-6 items-center gap-2">
        <Folder aria-hidden="true" className="shrink-0 text-[#a0a1a5]" size={14} />
        <h2
          className="min-w-0 flex-1 truncate text-xs font-semibold text-[#d8d8da]"
          id={`archived-project-${group.projectId}`}
          title={group.projectName}
        >
          {group.projectName}
        </h2>
        <span className="shrink-0 text-[11px] text-[#818287]">
          {t('settings.archived.taskCount', { count: group.sessions.length })}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={t('settings.archived.projectActions', { project: group.projectName })}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#77787d] transition-colors hover:bg-white/[0.07] hover:text-[#d4d4d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40"
            disabled={isGroupPending}
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            <Ellipsis aria-hidden="true" size={15} />
          </button>
          {isMenuOpen ? (
            <div
              className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-md border border-white/10 bg-[#252527] p-1 shadow-xl"
              role="menu"
            >
              <button
                className="flex h-8 w-full items-center rounded px-2 text-left text-xs text-[#dedee0] hover:bg-white/[0.08]"
                onClick={() => {
                  setIsMenuOpen(false);
                  onRestoreAll();
                }}
                role="menuitem"
                type="button"
              >
                {t('settings.archived.restoreAll')}
              </button>
              <button
                className="flex h-8 w-full items-center rounded px-2 text-left text-xs text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDeleteProjectSessions();
                }}
                role="menuitem"
                type="button"
              >
                {t('settings.archived.deleteProjectSessions')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-[#1c1c1e]">
        {group.sessions.map((session) => (
          <ArchivedSessionRow
            isPending={pendingSessionIds.has(session.id)}
            key={session.id}
            locale={locale}
            onDelete={() => onDeleteSession(session)}
            onRestore={() => onRestoreSession(session.id)}
            session={session}
          />
        ))}
      </div>
    </section>
  );
}
