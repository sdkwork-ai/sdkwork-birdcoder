import { memo, useCallback, useEffect, useRef, useState } from 'react';

export interface TopMenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  divider?: boolean;
}

interface TopMenuProps {
  label: string;
  items: TopMenuItem[];
}

export const TopMenu = memo(function TopMenu({ label, items }: TopMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const handleItemClick = useCallback((onClick?: () => void) => {
    onClick?.();
    setIsOpen(false);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={handleToggle}
        className={`px-2.5 py-1 text-[13px] rounded-md transition-colors ${isOpen ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
      >
        {label}
      </button>

      {isOpen ? (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border border-white/10 bg-[#18181b] py-1 shadow-2xl">
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="mx-2 my-1 h-px bg-white/10" />;
            }
            return (
              <button
                key={index}
                onClick={() => handleItemClick(item.onClick)}
                className="flex w-full items-center justify-between px-4 py-1.5 text-[13px] text-gray-300 transition-colors hover:bg-blue-600 hover:text-white"
              >
                <span>{item.label}</span>
                {item.shortcut ? <span className="text-[11px] text-gray-500">{item.shortcut}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});

TopMenu.displayName = 'TopMenu';
