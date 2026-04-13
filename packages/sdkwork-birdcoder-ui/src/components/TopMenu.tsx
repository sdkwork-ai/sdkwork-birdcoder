import React, { useState, useRef, useEffect } from 'react';

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  divider?: boolean;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
}

export function TopMenu({ label, items }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2.5 py-1 text-[13px] rounded-md transition-colors ${isOpen ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#18181b] border border-white/10 rounded-md shadow-2xl z-50 py-1">
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="h-px bg-white/10 my-1 mx-2" />;
            }
            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[13px] text-gray-300 hover:bg-blue-600 hover:text-white transition-colors"
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="text-gray-500 text-[11px]">{item.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
