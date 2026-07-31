import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Search, X } from 'lucide-react';
import {
  useDialogFocusManagement,
  type TopMenuItem,
} from '@sdkwork/birdcoder-pc-ui-shell';

export interface BirdcoderCommandGroup {
  id: string;
  items: readonly TopMenuItem[];
  label: string;
}

interface BirdcoderCommandMenuProps {
  closeLabel: string;
  groups: readonly BirdcoderCommandGroup[];
  isOpen: boolean;
  noResultsLabel: string;
  onClose: () => void;
  searchLabel: string;
  title: string;
}

export interface BirdcoderSearchableCommand {
  groupId: string;
  groupLabel: string;
  item: TopMenuItem;
  key: string;
}

function buildSearchableCommands(
  groups: readonly BirdcoderCommandGroup[],
): BirdcoderSearchableCommand[] {
  return groups.flatMap((group) => group.items.flatMap((item, itemIndex) => (
    item.divider || !item.onClick || !item.label.trim()
      ? []
      : [{
          groupId: group.id,
          groupLabel: group.label,
          item,
          key: `${group.id}-${itemIndex}`,
        }]
  )));
}

export function filterBirdcoderCommands(
  groups: readonly BirdcoderCommandGroup[],
  query: string,
): BirdcoderSearchableCommand[] {
  const commands = buildSearchableCommands(groups);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return commands;
  }

  return commands.filter(({ groupLabel, item }) => (
    [groupLabel, item.label, item.shortcut]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  ));
}

export function BirdcoderCommandMenu({
  closeLabel,
  groups,
  isOpen,
  noResultsLabel,
  onClose,
  searchLabel,
  title,
}: BirdcoderCommandMenuProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const optionIdPrefix = useId();
  const { dialogRef, onDialogKeyDown } = useDialogFocusManagement<HTMLDivElement>({
    initialFocusRef: inputRef,
    isOpen,
    onClose,
  });
  const commands = useMemo(
    () => filterBirdcoderCommands(groups, query),
    [groups, query],
  );
  const activeOptionId = commands[selectedIndex]
    ? `${optionIdPrefix}-${commands[selectedIndex]!.key}`
    : undefined;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    setSelectedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (commands.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((current) => Math.min(current, commands.length - 1));
  }, [commands.length]);

  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = useCallback((command: BirdcoderSearchableCommand | undefined) => {
    if (!command) {
      return;
    }
    onClose();
    command.item.onClick?.();
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    onDialogKeyDown(event);
    if (event.defaultPrevented || commands.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % commands.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + commands.length) % commands.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executeCommand(commands[selectedIndex]);
    }
  }, [commands, executeCommand, onDialogKeyDown, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  let renderedGroupId = '';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/45 px-2 pt-[max(3.5rem,10vh)]"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        aria-label={title}
        aria-modal="true"
        className="w-[min(calc(100vw-1rem),42rem)] overflow-hidden rounded-lg border border-white/10 bg-[#18181b] shadow-2xl"
        data-birdcoder-popup-surface="true"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
          <Search aria-hidden="true" className="shrink-0 text-gray-500" size={17} />
          <input
            ref={inputRef}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-label={searchLabel}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder={searchLabel}
            role="combobox"
            type="text"
            value={query}
          />
          <button
            aria-label={closeLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200"
            onClick={onClose}
            title={closeLabel}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div
          id={listboxId}
          aria-label={title}
          className="max-h-[min(60vh,32rem)] overflow-y-auto p-1.5 custom-scrollbar"
          role="listbox"
        >
          {commands.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500" role="status">
              {noResultsLabel}
            </div>
          ) : commands.map((command, index) => {
            const shouldRenderGroup = command.groupId !== renderedGroupId;
            renderedGroupId = command.groupId;
            const optionId = `${optionIdPrefix}-${command.key}`;
            return (
              <div key={command.key}>
                {shouldRenderGroup ? (
                  <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-gray-500">
                    {command.groupLabel}
                  </div>
                ) : null}
                <button
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={optionId}
                  aria-selected={index === selectedIndex}
                  className={`flex min-h-9 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                    index === selectedIndex
                      ? 'bg-white/10 text-white'
                      : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                  onClick={() => executeCommand(command)}
                  onPointerMove={() => setSelectedIndex(index)}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  <span className="min-w-0 flex-1 truncate">{command.item.label}</span>
                  {command.item.shortcut ? (
                    <kbd className="shrink-0 text-[11px] font-normal text-gray-500">
                      {command.item.shortcut}
                    </kbd>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
