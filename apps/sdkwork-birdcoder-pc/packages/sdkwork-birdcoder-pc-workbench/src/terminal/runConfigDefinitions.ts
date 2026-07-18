import type { TerminalProfileId } from './profiles.ts';

export type RunConfigurationGroup = 'dev' | 'build' | 'test' | 'custom';
export type RunConfigurationCwdMode = 'project' | 'workspace' | 'custom';

export interface RunConfigurationRecord {
  id: string;
  name: string;
  command: string;
  profileId: TerminalProfileId;
  group: RunConfigurationGroup;
  cwdMode: RunConfigurationCwdMode;
  customCwd: string;
}

const DEFAULT_RUN_CONFIGURATIONS: ReadonlyArray<RunConfigurationRecord> = [
  {
    id: 'dev',
    name: 'Start Development Server',
    command: 'npm run dev',
    profileId: 'powershell',
    group: 'dev',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    id: 'build',
    name: 'Build Project',
    command: 'npm run build',
    profileId: 'powershell',
    group: 'build',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    id: 'test',
    name: 'Run Tests',
    command: 'npm test',
    profileId: 'powershell',
    group: 'test',
    cwdMode: 'project',
    customCwd: '',
  },
] as const;

export function getDefaultRunConfigurations(): RunConfigurationRecord[] {
  return DEFAULT_RUN_CONFIGURATIONS.map((configuration) => ({ ...configuration }));
}
