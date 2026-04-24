import { cn } from '@sdkwork/birdcoder-ui-shell';
import type {
  ParsedKeyValuePreviewEntry,
  ParsedKeyValuePreviewValue,
} from './contentPreview';

export interface ContentKeyValuePreviewProps {
  className?: string;
  emptyValueLabel?: string;
  globalSectionLabel?: string;
  value: ParsedKeyValuePreviewValue;
}

interface KeyValuePreviewSection {
  entries: ParsedKeyValuePreviewEntry[];
  key: string | null;
  label: string;
}

function formatKeyValuePreviewLabel(format: ParsedKeyValuePreviewValue['format']): string {
  switch (format) {
    case 'dotenv':
      return 'DOTENV';
    case 'ini':
      return 'INI';
    case 'properties':
    default:
      return 'PROPERTIES';
  }
}

function formatSectionSummary(section: KeyValuePreviewSection): string {
  const count = section.entries.length;
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

function buildKeyValuePreviewSections(
  value: ParsedKeyValuePreviewValue,
  globalSectionLabel: string,
): KeyValuePreviewSection[] {
  const orderedKeys: (string | null)[] = [];
  const seenKeys = new Set<string | null>();

  const pushKey = (key: string | null) => {
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    orderedKeys.push(key);
  };

  if (value.entries.some((entry) => entry.section === null)) {
    pushKey(null);
  }

  value.sectionOrder.forEach((section) => pushKey(section));
  value.entries.forEach((entry) => pushKey(entry.section));

  return orderedKeys
    .map((key) => ({
      entries: value.entries.filter((entry) => entry.section === key),
      key,
      label: key ?? globalSectionLabel,
    }))
    .filter((section) => section.entries.length > 0);
}

function renderValueCell(value: string, emptyValueLabel: string) {
  if (!value) {
    return <span className="text-gray-600">{emptyValueLabel}</span>;
  }

  return value;
}

export function ContentKeyValuePreview({
  className,
  emptyValueLabel = 'Empty',
  globalSectionLabel = 'Global',
  value,
}: ContentKeyValuePreviewProps) {
  const sections = buildKeyValuePreviewSections(value, globalSectionLabel);
  const formatLabel = formatKeyValuePreviewLabel(value.format);
  const sectionCount = sections.filter((section) => section.key !== null).length;
  const showSectionHeader = value.hasSections || sections.length > 1;

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-[#0b0d12]', className)}>
      <div className="shrink-0 border-b border-white/10 bg-[#0b0d12]/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-100">Config Preview</div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-400">
            {formatLabel}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {value.entries.length} entries
          {sectionCount > 0 ? ` • ${sectionCount} sections` : ''}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <div className="flex min-h-full flex-col gap-4 px-5 py-4">
          {sections.map((section) => (
            <section
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
              key={section.key ?? '__global__'}
            >
              {showSectionHeader ? (
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="truncate text-sm font-medium text-gray-100">{section.label}</div>
                    <div className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-gray-500">
                      {formatSectionSummary(section)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] leading-6 text-gray-200">
                  <thead className="bg-[#10131a]">
                    <tr>
                      <th className="w-[28%] border-b border-r border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                        Key
                      </th>
                      <th className="border-b border-r border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                        Value
                      </th>
                      <th className="w-20 border-b border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                        Line
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.entries.map((entry) => (
                      <tr key={`${section.key ?? 'global'}:${entry.lineNumber}:${entry.key}`}>
                        <td className="border-b border-r border-white/10 px-4 py-2 align-top font-mono text-[12px] text-sky-300">
                          <div className="max-w-[280px] break-words">{entry.key}</div>
                        </td>
                        <td className="border-b border-r border-white/10 px-4 py-2 align-top">
                          <div className="whitespace-pre-wrap break-words font-mono text-[12px] text-gray-300">
                            {renderValueCell(entry.value, emptyValueLabel)}
                          </div>
                        </td>
                        <td className="border-b border-white/10 px-4 py-2 align-top font-mono text-xs text-gray-500">
                          {entry.lineNumber}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
