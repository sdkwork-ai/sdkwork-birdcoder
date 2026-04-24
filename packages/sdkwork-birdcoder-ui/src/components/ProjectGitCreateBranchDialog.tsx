import { memo } from 'react';
import { GitBranch, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-ui-shell';

interface ProjectGitCreateBranchDialogProps {
  branchName: string;
  isCreating?: boolean;
  isOpen: boolean;
  onBranchNameChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}

export const ProjectGitCreateBranchDialog = memo(function ProjectGitCreateBranchDialog({
  branchName,
  isCreating = false,
  isOpen,
  onBranchNameChange,
  onClose,
  onCreate,
}: ProjectGitCreateBranchDialogProps) {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-[#18181b] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/5 bg-[#121214] p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <GitBranch size={18} className="text-blue-400" />
            {t('app.createNewBranch')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('app.branchName')}</label>
            <input
              type="text"
              value={branchName}
              onChange={(event) => {
                onBranchNameChange(event.target.value);
              }}
              disabled={isCreating}
              placeholder={t('app.branchNamePlaceholder')}
              className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-white/5 bg-[#121214] p-4">
          <Button variant="outline" disabled={isCreating} onClick={onClose}>
            {t('app.cancel')}
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-500"
            disabled={!branchName.trim() || isCreating}
            onClick={() => {
              void onCreate();
            }}
          >
            {isCreating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {t('app.createBranch')}
              </span>
            ) : t('app.createBranch')}
          </Button>
        </div>
      </div>
    </div>
  );
});

ProjectGitCreateBranchDialog.displayName = 'ProjectGitCreateBranchDialog';
