import {
  BirdCoderAuthGate,
  ShellRuntimeProviders,
} from '@sdkwork/birdcoder-h5-shell';
import { AppProvider } from '@sdkwork/birdcoder-h5-commons';
import { MobileShell } from './shell/MobileShell.tsx';

export default function App() {
  return (
    <ShellRuntimeProviders>
      <BirdCoderAuthGate>
        <AppProvider>
          <MobileShell>
            <div className="px-4 py-6">
              <h2 className="text-base font-medium">SDKWork BirdCoder H5</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Mobile shell bootstrap, IAM runtime, and auth gate are active.
              </p>
            </div>
          </MobileShell>
        </AppProvider>
      </BirdCoderAuthGate>
    </ShellRuntimeProviders>
  );
}
