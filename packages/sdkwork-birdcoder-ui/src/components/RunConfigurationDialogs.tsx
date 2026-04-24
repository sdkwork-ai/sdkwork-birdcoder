import { Terminal, X } from 'lucide-react';
import {
  BUILTIN_TERMINAL_PROFILES,
  type RunConfigurationRecord,
} from '@sdkwork/birdcoder-commons';
import { Button } from '@sdkwork/birdcoder-ui-shell';

export interface RunConfigurationDialogProps {
  open: boolean;
  title: string;
  draft: RunConfigurationRecord;
  onDraftChange: (draft: RunConfigurationRecord) => void;
  onClose: () => void;
  onSubmit: () => void;
  nameLabel: string;
  commandLabel: string;
  profileLabel: string;
  workingDirectoryLabel: string;
  customDirectoryLabel: string;
  taskGroupLabel: string;
  cancelLabel: string;
  submitLabel: string;
  projectLabel: string;
  workspaceLabel: string;
  customLabel: string;
  devLabel: string;
  buildLabel: string;
  testLabel: string;
  customGroupLabel: string;
}

export interface RunTaskDialogProps {
  open: boolean;
  title: string;
  configurations: ReadonlyArray<RunConfigurationRecord>;
  onClose: () => void;
  onRun: (configuration: RunConfigurationRecord) => void;
}

export function RunConfigurationDialog({
  open,
  title,
  draft,
  onDraftChange,
  onClose,
  onSubmit,
  nameLabel,
  commandLabel,
  profileLabel,
  workingDirectoryLabel,
  customDirectoryLabel,
  taskGroupLabel,
  cancelLabel,
  submitLabel,
  projectLabel,
  workspaceLabel,
  customLabel,
  devLabel,
  buildLabel,
  testLabel,
  customGroupLabel,
}: RunConfigurationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{nameLabel}</label>
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  name: event.target.value,
                })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              {commandLabel}
            </label>
            <input
              type="text"
              value={draft.command}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  command: event.target.value,
                })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{profileLabel}</label>
              <select
                value={draft.profileId}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    profileId: event.target.value as RunConfigurationRecord['profileId'],
                  })
                }
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
              >
                {BUILTIN_TERMINAL_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {workingDirectoryLabel}
              </label>
              <select
                value={draft.cwdMode}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    cwdMode: event.target.value as RunConfigurationRecord['cwdMode'],
                  })
                }
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
              >
                <option value="project">{projectLabel}</option>
                <option value="workspace">{workspaceLabel}</option>
                <option value="custom">{customLabel}</option>
              </select>
            </div>
          </div>
          {draft.cwdMode === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {customDirectoryLabel}
              </label>
              <input
                type="text"
                value={draft.customCwd}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    customCwd: event.target.value,
                  })
                }
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{taskGroupLabel}</label>
            <select
              value={draft.group}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  group: event.target.value as RunConfigurationRecord['group'],
                })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="dev">{devLabel}</option>
              <option value="build">{buildLabel}</option>
              <option value="test">{testLabel}</option>
              <option value="custom">{customGroupLabel}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={onSubmit}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunTaskDialog({
  open,
  title,
  configurations,
  onClose,
  onRun,
}: RunTaskDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-200">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-2">
          {configurations.map((configuration) => (
            <button
              key={configuration.id}
              className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-md group flex items-center gap-3 transition-colors"
              onClick={() => onRun(configuration)}
            >
              <Terminal size={14} className="text-gray-500 group-hover:text-blue-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate">
                  {configuration.name}
                </div>
                <div className="text-xs text-gray-500 truncate">{configuration.command}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
