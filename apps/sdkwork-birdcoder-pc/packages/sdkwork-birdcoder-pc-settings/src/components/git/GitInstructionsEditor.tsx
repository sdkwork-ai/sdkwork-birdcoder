import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface GitInstructionsEditorProps {
  description: string;
  onSave: (value: string) => void;
  placeholder: string;
  title: string;
  value: string;
}

export function GitInstructionsEditor({
  description,
  onSave,
  placeholder,
  title,
  value,
}: GitInstructionsEditorProps) {
  const { t } = useTranslation();
  const textareaId = useId();
  const [draft, setDraft] = useState(value);
  const [savedAnnouncement, setSavedAnnouncement] = useState('');
  const hasChanges = draft !== value;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    if (!hasChanges) {
      return;
    }
    onSave(draft);
    setSavedAnnouncement(t('settings.git.instructionsSaved', { title }));
  };

  return (
    <section className="mt-8" aria-labelledby={textareaId}>
      <div className="mb-3 flex min-h-8 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5 text-[#ededee]" id={textareaId}>{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-[#8d8e92]">{description}</p>
        </div>
        <button
          className="h-7 shrink-0 rounded-md px-2.5 text-[11px] font-medium text-[#d7d7d9] outline-none transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:pointer-events-none disabled:text-[#55565a]"
          disabled={!hasChanges}
          onClick={save}
          type="button"
        >
          {t('settings.git.save')}
        </button>
      </div>
      <textarea
        aria-labelledby={textareaId}
        className="block h-[104px] w-full resize-y rounded-md border border-white/[0.075] bg-[#29292b] px-2.5 py-2 text-[12px] leading-5 text-[#e0e0e2] outline-none placeholder:text-[#77787c] focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20"
        maxLength={12_000}
        onChange={(event) => {
          setDraft(event.target.value);
          setSavedAnnouncement('');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
          }
        }}
        placeholder={placeholder}
        value={draft}
      />
      <span aria-live="polite" className="sr-only">{savedAnnouncement}</span>
    </section>
  );
}
