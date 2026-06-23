import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

class HostAdapters {
  final bool cameraAvailable;
  final bool qrScannerAvailable;
  final bool pushNotificationsAvailable;
  final bool deepLinksAvailable;
  final bool secureStorageAvailable;
  final bool biometricAvailable;
  final bool clipboardAvailable;
  final bool filePickerAvailable;

  HostAdapters({
    this.cameraAvailable = false,
    this.qrScannerAvailable = false,
    this.pushNotificationsAvailable = false,
    this.deepLinksAvailable = false,
    this.secureStorageAvailable = false,
    this.biometricAvailable = false,
    this.clipboardAvailable = false,
    this.filePickerAvailable = false,
  });

  static HostAdapters create() {
    final platform = HostPlatform.detect();
    return HostAdapters(
      secureStorageAvailable: platform.secureStorageAvailable,
    );
  }
}
