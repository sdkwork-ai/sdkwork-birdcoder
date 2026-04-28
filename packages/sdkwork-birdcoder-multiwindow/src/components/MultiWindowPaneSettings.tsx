import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import { SlidersHorizontal } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  MultiWindowPaneConfig,
} from '../types.ts';
import { MultiWindowPaneConfigurationForm } from './MultiWindowPaneConfigurationForm.tsx';

interface MultiWindowPaneSettingsProps {
  pane: MultiWindowPaneConfig;
  preferences: WorkbenchPreferences;
  onChange: (pane: MultiWindowPaneConfig) => void;
}

export const MultiWindowPaneSettings = memo(function MultiWindowPaneSettings({
  pane,
  preferences,
  onChange,
}: MultiWindowPaneSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute right-3 top-12 z-40 w-[320px] rounded-lg border border-white/10 bg-[#18191f] p-3 shadow-2xl">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-200">
        <SlidersHorizontal size={14} className="text-blue-300" />
        {t('multiWindow.settings')}
      </div>

      <MultiWindowPaneConfigurationForm
        pane={pane}
        preferences={preferences}
        onChange={onChange}
      />
    </div>
  );
});

MultiWindowPaneSettings.displayName = 'MultiWindowPaneSettings';
