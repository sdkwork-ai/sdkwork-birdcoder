import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ArchivedSelectMenuOption {
  label: string;
  value: string;
}

interface ArchivedSelectMenuProps {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (value: string) => void;
  options: readonly ArchivedSelectMenuOption[];
  value: string;
  widthClassName?: string;
}

export function ArchivedSelectMenu({
  disabled = false,
  icon: Icon,
  label,
  onChange,
  options,
  value,
  widthClassName = 'min-w-0',
}: ArchivedSelectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

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
    <div className={`relative ${widthClassName}`} ref={rootRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/[0.09] bg-[#202022] px-3 text-sm font-medium text-[#e1e1e3] outline-none transition-colors hover:border-white/[0.14] hover:bg-[#242426] focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Icon aria-hidden="true" className="shrink-0 text-[#b8b9bc]" size={16} />
        <span className="min-w-0 flex-1 truncate text-left">{selectedOption?.label}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-[#8c8d91]" size={15} />
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 top-[42px] z-30 max-h-72 w-full min-w-[210px] overflow-y-auto rounded-lg border border-white/10 bg-[#29292b] p-1.5 shadow-2xl"
          id={menuId}
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-[#ededee] hover:bg-white/[0.07]"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.value === value ? <Check aria-hidden="true" size={15} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
