library sdkwork_birdcoder_flutter_mobile_host;

import 'session/birdcoder_session_storage.dart';

export 'deep_link/birdcoder_deep_link_adapter.dart';
export 'external_auth/birdcoder_external_auth_launcher.dart';
export 'qr/birdcoder_qr_payload_view.dart';
export 'session/birdcoder_session_record.dart';
export 'session/birdcoder_session_storage.dart';
export 'session/configure_birdcoder_session_storage.dart';
export 'session/iam_session_probe.dart';

const String kFlutterMobileHostVersion = '0.1.0';

class HostPlatform {
  final String name;
  final bool isNative;
  final bool secureStorageAvailable;

  const HostPlatform({
    required this.name,
    required this.isNative,
    required this.secureStorageAvailable,
  });

  static HostPlatform detect() {
    return HostPlatform(
      name: 'flutter-mobile',
      isNative: true,
      secureStorageAvailable: getBirdCoderSessionStorage() is! MemoryBirdCoderSessionStorage,
    );
  }
}
