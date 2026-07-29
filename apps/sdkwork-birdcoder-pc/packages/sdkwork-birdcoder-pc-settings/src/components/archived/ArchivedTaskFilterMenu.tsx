import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArchivedTaskSort, ArchivedTaskTypeFilter } from './archivedSettingsTypes';

interface ArchivedTaskFilterMenuProps {
  onSortChange: (sort: ArchivedTaskSort) => void;
  onTypeChange: (type: ArchivedTaskTypeFilter) => void;
  sort: ArchivedTaskSort;
  type: ArchivedTaskTypeFilter;
}

const TYPE_OPTIONS: ArchivedTaskTypeFilter[] = ['all', 'local', 'cloud'];
const SORT_OPTIONS: ArchivedTaskSort[] = ['updated', 'created', 'name'];

export function ArchivedTaskFilterMenu({
  onSortChange,
  onTypeChange,
  sort,
  type,
}: ArchivedTaskFilterMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative min-w-0" ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('settings.archived.taskFilterLabel')}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/[0.09] bg-[#202022] px-3 text-sm font-medium text-[#e1e1e3] outline-none transition-colors hover:border-white/[0.14] hover:bg-[#242426] focus-visible:ring-2 focus-visible:ring-white/20"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <ListFilter aria-hidden="true" className="shrink-0 text-[#b8b9bc]" size={16} />
        <span className="min-w-0 flex-1 truncate text-left">
          {t(`settings.archived.taskTypes.${type}`)}
        </span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-[#8c8d91]" size={15} />
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 top-[42px] z-30 w-[250px] rounded-lg border border-white/10 bg-[#29292b] p-1.5 shadow-2xl"
          id={menuId}
          role="menu"
        >
          <div className="px-2.5 pb-1 pt-1 text-xs font-medium text-[#8c8d91]">
            {t('settings.archived.typeSection')}
          </div>
          {TYPE_OPTIONS.map((option) => (
            <button
              aria-checked={option === type}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-[#ededee] hover:bg-white/[0.07]"
              key={option}
              onClick={() => onTypeChange(option)}
              role="menuitemradio"
              type="button"
            >
              <span className="flex-1">{t(`settings.archived.taskTypes.${option}`)}</span>
              {option === type ? <Check aria-hidden="true" size={15} /> : null}
            </button>
          ))}
          <div className="my-1 border-t border-white/[0.08]" />
          <div className="px-2.5 pb-1 pt-1 text-xs font-medium text-[#8c8d91]">
            {t('settings.archived.sortSection')}
          </div>
          {SORT_OPTIONS.map((option) => (
            <button
              aria-checked={option === sort}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-[#ededee] hover:bg-white/[0.07]"
              key={option}
              onClick={() => onSortChange(option)}
              role="menuitemradio"
              type="button"
            >
              <span className="flex-1">{t(`settings.archived.sortOptions.${option}`)}</span>
              {option === sort ? <Check aria-hidden="true" size={15} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
