import { cn } from '@sdkwork/birdcoder-ui-shell';
import type { ParsedTabularDataPreviewValue } from './contentPreview';

export interface ContentTablePreviewProps {
  className?: string;
  value: ParsedTabularDataPreviewValue;
}

function buildColumnLabels(value: ParsedTabularDataPreviewValue): string[] {
  if (value.hasHeaderRow) {
    return (value.rows[0] ?? []).map((cell, index) => cell.trim() || `Column ${index + 1}`);
  }

  return Array.from({ length: value.columnCount }, (_, index) => `Column ${index + 1}`);
}

function buildBodyRows(value: ParsedTabularDataPreviewValue): string[][] {
  return value.hasHeaderRow ? value.rows.slice(1) : value.rows;
}

export function ContentTablePreview({
  className,
  value,
}: ContentTablePreviewProps) {
  const columnLabels = buildColumnLabels(value);
  const bodyRows = buildBodyRows(value);
  const sourceLabel = value.delimiter === '\t' ? 'TSV' : 'CSV';

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-[#0b0d12]', className)}>
      <div className="shrink-0 border-b border-white/10 bg-[#0b0d12]/95 px-5 py-3 backdrop-blur">
        <div className="text-sm font-medium text-gray-100">Table Preview</div>
        <div className="text-xs text-gray-500">
          {sourceLabel} · {columnLabels.length} columns · {bodyRows.length} rows
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] leading-6 text-gray-200">
          <thead className="sticky top-0 z-10 bg-[#10131a]">
            <tr>
              <th className="w-14 border-b border-r border-white/10 bg-[#111827] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500">
                #
              </th>
              {columnLabels.map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  className="border-b border-r border-white/10 bg-[#111827] px-3 py-2 text-xs font-medium text-gray-200 last:border-r-0"
                >
                  <div className="max-w-[320px] truncate" title={label}>
                    {label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.length > 0 ? (
              bodyRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'}
                >
                  <td className="border-b border-r border-white/10 px-3 py-2 align-top font-mono text-xs text-gray-500">
                    {value.hasHeaderRow ? rowIndex + 2 : rowIndex + 1}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-r border-white/10 px-3 py-2 align-top text-gray-300 last:border-r-0"
                    >
                      <div
                        className="max-w-[320px] whitespace-pre-wrap break-words"
                        title={cell}
                      >
                        {cell || <span className="text-gray-600">-</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="border-b border-white/10 px-4 py-6 text-sm text-gray-500"
                  colSpan={columnLabels.length + 1}
                >
                  The table only contains a header row.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
