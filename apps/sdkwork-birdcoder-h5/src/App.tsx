import {
  BirdCoderAuthGate,
  ShellRuntimeProviders,
} from '@sdkwork/birdcoder-h5-shell';
import { AppProvider } from '@sdkwork/birdcoder-h5-commons';
import {
  BirdCoderSettingsProvider,
} from '@sdkwork/birdcoder-h5-chat';
import { BirdCoderH5AppRoutes } from './routes';

export default function App() {
  return (
    <ShellRuntimeProviders>
      <BirdCoderAuthGate>
        <AppProvider>
          <BirdCoderSettingsProvider>
            <BirdCoderH5AppRoutes />
          </BirdCoderSettingsProvider>
        </AppProvider>
      </BirdCoderAuthGate>
    </ShellRuntimeProviders>
  );
}
