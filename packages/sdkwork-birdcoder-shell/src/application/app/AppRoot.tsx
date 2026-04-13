import LegacyBirdcoderApp from '../../legacy/LegacyBirdcoderApp';
import { AppProviders } from '../providers/AppProviders';

export default function AppRoot() {
  return (
    <AppProviders>
      <LegacyBirdcoderApp />
    </AppProviders>
  );
}
