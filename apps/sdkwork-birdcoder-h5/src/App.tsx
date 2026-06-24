import {
  BirdCoderAuthGate,
  ShellRuntimeProviders,
} from '@sdkwork/birdcoder-h5-shell';
import { AppProvider } from '@sdkwork/birdcoder-h5-commons';
import { BirdCoderH5AppRoutes } from './routes';

export default function App() {
  return (
    <ShellRuntimeProviders>
      <BirdCoderAuthGate>
        <AppProvider>
          <BirdCoderH5AppRoutes />
        </AppProvider>
      </BirdCoderAuthGate>
    </ShellRuntimeProviders>
  );
}
